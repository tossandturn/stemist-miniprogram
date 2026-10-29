import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'

const png=Buffer.alloc(1100*1024,127);Buffer.from([137,80,78,71,13,10,26,10]).copy(png)
const qualities=[]
const image=miniRuntime({wx:{getImageInfo:o=>o.success({width:1600,height:1200}),compressImage:o=>{qualities.push(o.quality);o.success({tempFilePath:o.src})},getFileSystemManager:()=>({readFile:o=>o.success({data:png.toString('base64')})})}})
const prepared=await image.load('utils/image').readImageDataUrl('/retained.png',{coach:true})
assert.equal(prepared,'data:image/png;base64,'+png.toString('base64'),'768 KiB is a transfer target, not a new rejection limit for otherwise supported images')
assert.deepEqual(qualities,[82,65,50,35])
const huge=Buffer.alloc(4*1024*1024+1,127);Buffer.from([137,80,78,71,13,10,26,10]).copy(huge)
const oversized=miniRuntime({wx:{getImageInfo:o=>o.success({width:1600,height:1200}),compressImage:o=>o.success({tempFilePath:o.src}),getFileSystemManager:()=>({readFile:o=>o.success({data:huge.toString('base64')})})}})
await assert.rejects(()=>oversized.load('utils/image').readImageDataUrl('/retained-large.png',{coach:true}),e=>e.code==='coach_image_too_large'&&/裁剪图片/.test(e.message))

let exported,fillCount=0,drawCount=0
const canvas={getContext:()=>({fillRect(){fillCount++},drawImage(){drawCount++}}),createImage(){const img={};Object.defineProperty(img,'src',{set(){queueMicrotask(()=>img.onload())}});return img}}
const cropRuntime=miniRuntime({wx:{createSelectorQuery:()=>({in(){return this},select(){return this},fields(){return this},exec:cb=>cb([{node:canvas}])}),canvasToTempFilePath:o=>{exported=o;o.success({tempFilePath:'/qa-crop.jpg'})}}})
cropRuntime.storage.set('stemistCropReturn',{route:'coach-home',context:{contextId:'stem-photo'}})
const jpegCrop=cropRuntime.page('pages/crop/crop');jpegCrop.onLoad({src:'/qa-source.png'});jpegCrop.finish=()=>{}
jpegCrop.exportCrop(0,0,1600,1200);await settle();await new Promise(resolve=>setTimeout(resolve,10))
assert.equal(exported.fileType,'jpg','Coach crop must actually encode JPEG, not rename PNG bytes to .jpg')
assert.ok(exported.quality>=0.8);assert.equal(fillCount,1,'transparent source gets a white background');assert.equal(drawCount,1)
jpegCrop.__transform={x:24,y:31,scale:1.5};jpegCrop.zoomFrame({currentTarget:{dataset:{delta:0.2}}})
assert.equal(jpegCrop.data.scale,1.7,'one-finger zoom controls must work without pinch gestures')
jpegCrop.data.busy=true;jpegCrop.zoomFrame({currentTarget:{dataset:{delta:0.2}}});assert.equal(jpegCrop.data.scale,1.7)
jpegCrop.data.busy=false;jpegCrop.__cropBounds={width:390,height:440};jpegCrop.setData({selection:{left:0,top:0,width:390,height:440}})
jpegCrop.onSelectionStart({currentTarget:{dataset:{corner:'nw'}},touches:[{clientX:20,clientY:20}]})
jpegCrop.onSelectionMove({touches:[{clientX:90,clientY:110}]});jpegCrop.onSelectionEnd()
assert.deepEqual(JSON.parse(JSON.stringify(jpegCrop.data.selection)),{left:70,top:90,width:320,height:350},'single-finger corner drag changes the actual crop box')
jpegCrop.onSelectionStart({currentTarget:{dataset:{corner:'move'}},touches:[{clientX:150,clientY:150}]})
jpegCrop.onSelectionMove({touches:[{clientX:120,clientY:120}]});jpegCrop.onSelectionEnd()
assert.equal(jpegCrop.data.selection.left,40);assert.equal(jpegCrop.data.selection.top,60)

const first='/owned/native-coach/coach-first.jpg',second='/owned/native-coach/coach-second.jpg',files=new Set([first,second]),requests=[];let pages=[]
const rt=miniRuntime({globals:{getCurrentPages:()=>pages},wx:{env:{USER_DATA_PATH:'/owned'},getFileSystemManager:()=>({mkdirSync(){},accessSync(){},copyFile:o=>{assert.ok(files.has(o.srcPath)||o.srcPath==='/new-crop.jpg');files.add(o.destPath);o.success()},unlink:o=>{files.delete(o.filePath);o.success?.()}})},modules:{'utils/coachEntry':{takeCoachEntry:()=>({skill:'stem-photo',title:'Original fixture',imagePaths:[first,second]})},'utils/image':{compressImage:async p=>p,readAsJpegDataUrl:async p=>{assert.ok(files.has(p),'never submit the stale deleted pre-crop attachment');return'data:image/jpeg;base64,'+p}},'utils/coach':{runCoach:async r=>{requests.push(r);return{mode:'ai',providerStatus:'connected',completed:true,answer:'Synthetic answer'}}}}})
rt.storage.set('stemistUser',{id:'ielts:crop-qa'});rt.storage.set('stemistCoachPhoto',first);rt.storage.set('stemistCoachPhotoMeta',{owner:'ielts:crop-qa',epoch:0,path:first,paths:[first,second],entryKey:'qa-entry',contextId:'stem-photo',feature:'answers'})
const p=rt.page('pages/coach/index');p.onLoad({source:'alevel',entry:'qa-entry',feature:'answers'});p.onShow();p.setData({message:'Keep my question',error:'照片较大'})
const cached={key:'existing-request-bytes',images:['synthetic-prepared-bytes']};p.__coachImageCache=cached
assert.equal(typeof p.recropImage,'function','existing photo needs an actionable recrop entry')
p.recropImage();assert.equal(rt.storage.get('stemistCropReturn').recrop,true);assert.equal(rt.storage.get('stemistCropReturn').context.entryKey,'qa-entry')
const cancelled=rt.page('pages/crop/crop');cancelled.onLoad({src:first});cancelled.cancel();p.onShow()
assert.equal(p.data.imagePath,first);assert.equal(p.data.message,'Keep my question');assert.ok(files.has(first));assert.equal(requests.length,0)
assert.equal(p.__coachImageCache,cached,'cancelled recrop must retain prepared bytes for the original resumable AI job')
p.recropImage();const finished=rt.page('pages/crop/crop');finished.onLoad({src:first});pages=[p,finished]
await finished.finish('/new-crop.jpg');p.onShow();await settle()
const meta=rt.storage.get('stemistCoachPhotoMeta');assert.equal(meta.entryKey,'qa-entry');assert.equal(meta.paths.length,2);assert.ok(meta.paths.every(x=>files.has(x)));assert.equal(requests.length,0,'recrop does not silently resend/charge an AI task')
assert.notEqual(p.data.imagePath,first);assert.equal(p.data.message,'Keep my question');assert.equal(p.data.error,'');assert.equal(p.data.canRetry,false)
await p.submit();assert.equal(requests.length,1);assert.equal(requests[0].imageDataUrls.length,2)
p.onUnload();jpegCrop.onUnload()
const wxml=fs.readFileSync(new URL('../pages/coach/index.wxml',import.meta.url),'utf8')
assert.match(wxml,/bindtap="recropImage"/);assert.match(wxml,/裁剪图片/)
console.log('Coach recrop PASS: soft upload target, real JPEG, zoom controls, cancel retention, entry/multipage ownership and no automatic resend.')
