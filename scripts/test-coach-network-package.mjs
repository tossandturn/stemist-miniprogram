import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
import {transformNativePackageFile} from './helpers/native-package-transform.mjs'
const load=(file,runtime,globals)=>{
 const source=fs.readFileSync(new URL('../'+file+'.js',import.meta.url)),result=transformNativePackageFile(file+'.js',source)
 assert.equal(result.transform,'esbuild-coach-network-identifiers-v1')
 const module={exports:{}}
 vm.runInNewContext(result.bytes.toString('utf8'),{module,exports:module.exports,wx:runtime.wx,getApp:()=>({globalData:{}}),require:name=>runtime.load('utils/'+name.replace('./','')),...globals})
 return module.exports
}
let request,aborts=0,clears=0;const timers=new Map();let serial=0
const globals={setTimeout:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial},clearTimeout:id=>timers.delete(id)}
const r=miniRuntime({modules:{'utils/nativeSession':{refreshNativeSession:async()=>{},captureNativeCookie(){}},'utils/session':{clearLocalSession(){clears++}}},wx:{request:o=>{request=o;return{abort(){aborts++}}}}})
const api=load('utils/api',r,globals)
assert.equal(api.askCoach.name,'askCoach')
const pending=api.askCoach({message:'fixture'}).catch(e=>e);await settle()
assert.equal(request.url,'https://stem.ieltsist.com/api/ai/coach')
assert.equal([...timers.values()][0].ms,55000)
;[...timers.values()][0].fn();assert.equal((await pending).code,'network_timeout');assert.equal(aborts,1)
request.success({statusCode:401,data:{}});assert.equal(clears,0)
const success=api.askCoach({message:'fixture'});await settle();request.success({statusCode:200,data:{answer:'x=4'}});assert.equal((await success).answer,'x=4');assert.equal(timers.size,0)
const jpeg=Buffer.from([255,216,255,224,0,16,74,70,73,70]).toString('base64');let compressed
const imageRuntime=miniRuntime({wx:{getImageInfo:o=>o.success({width:4032,height:3024}),compressImage:o=>{compressed=o;o.success({tempFilePath:'compressed.jpg'})},getFileSystemManager:()=>({readFile:o=>o.success({data:jpeg})})}})
const image=load('utils/image',imageRuntime,{setTimeout,clearTimeout})
assert.equal(image.readAsJpegDataUrl.name,'readImageDataUrl')
assert.equal(await image.readAsJpegDataUrl('photo.jpg',{coach:true}),'data:image/jpeg;base64,'+jpeg);assert.equal(compressed.compressedWidth,2048)
await image.readAsJpegDataUrl('ielts.jpg');assert.equal(compressed.compressedWidth,undefined)
console.log('Packaged Coach network helpers preserve deadlines, late-result isolation, API fields and image resize behavior')
