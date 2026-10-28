import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const drawn=[],exports=[],removed=[],progress=[]
const ctx={clearRect(){},fillRect(...a){drawn.push(['background',...a])},fillText(...a){drawn.push(['text',...a])},drawImage(...a){drawn.push(['image',...a.slice(1)])},measureText:t=>({width:String(t).length*26})}
const canvas={getContext:()=>ctx,createImage(){const img={width:1000,height:1400};Object.defineProperty(img,'src',{set(){queueMicrotask(()=>img.onload())}});return img}}
const runtime=miniRuntime({wx:{env:{USER_DATA_PATH:'/owned'},downloadFile(o){queueMicrotask(()=>o.success({statusCode:200,tempFilePath:'/temp/source.jpg'}));return{abort(){},onProgressUpdate(fn){fn({totalBytesWritten:100,totalBytesExpectedToWrite:100})}}},getFileSystemManager:()=>({statSync(){return{size:1000}},unlink(o){removed.push(o.filePath)}}),canvasToTempFilePath(o){exports.push([o.destWidth,o.destHeight]);o.success({tempFilePath:'/temp/export-'+exports.length+'.jpg'})}},modules:{'utils/nativePractice':{}}})
const render=runtime.load('bundles/coach/practiceRender')
const review={number:'1',source:'9702 s25 qp 12',prompt:'',assets:[{url:'https://stem.ieltsist.com/question-assets/paper/qp-1.jpg',kind:'question',page:1,region:[0,.25,1,.75],imageSize:[1000,1400]}]}
const paths=await render.renderReview(review,canvas,{guard(){},onProgress:p=>progress.push(p)})
assert.equal(paths.length,1)
assert.equal(drawn.filter(a=>a[0]==='image').length,1)
assert.deepEqual(drawn.find(a=>a[0]==='image').slice(1,5),[0,350,1000,700],'crop must use source pixels, not CSS offsets')
assert.ok(drawn.some(a=>a[0]==='background'))
assert.ok(drawn.some(a=>a[0]==='text'&&String(a[1]).includes('第 1 题')))
assert.ok(progress.some(p=>p.loaded===100&&p.total===100))
assert.ok(removed.includes('/temp/source.jpg'))
assert.ok(!removed.includes(paths[0]),'keep generated outputs until handoff copy completes')
drawn.length=0
await render.renderReview({...review,assets:[],prompt:'原创基础练习\nWhat is acceleration?\nA. 1\nB. 2'},canvas,{guard(){}})
assert.ok(drawn.some(a=>a[0]==='text'&&String(a[1]).includes('What is')))
let checks=0
await assert.rejects(render.renderReview(review,canvas,{guard(){if(++checks>2)throw Error('cancelled')}}),/cancelled/)
console.log('Chapter Coach render: real image draw, pixel crop, white background, original text, byte progress, cancellation and temporary cleanup passed.')
