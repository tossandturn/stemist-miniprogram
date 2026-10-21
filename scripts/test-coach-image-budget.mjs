import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const jpeg=Buffer.from([255,216,255,224,0,16,74,70,73,70]).toString('base64')
const compress=[]
const r=miniRuntime({wx:{getImageInfo:o=>o.success({width:4032,height:3024}),compressImage:o=>{compress.push(o);o.success({tempFilePath:'compressed.jpg'})},getFileSystemManager:()=>({readFile:o=>o.success({data:jpeg})})}})
const api=r.load('utils/image')
await api.readAsJpegDataUrl('original.jpg',{coach:true})
assert.equal(compress[0].compressedWidth,2048,'STEM photo requests resize camera-resolution images before base64 upload')
assert.equal(compress[0].compressedHeight,1536)
assert.equal(compress[0].quality,82)
compress.length=0;await api.readAsJpegDataUrl('ielts-original.jpg')
assert.equal(compress[0].compressedWidth,undefined,'IELTS and other existing photo consumers are unchanged')
const small=[];const s=miniRuntime({wx:{getImageInfo:o=>o.success({width:500,height:800}),compressImage:o=>{small.push(o);o.success({tempFilePath:o.src})},getFileSystemManager:()=>({readFile:o=>o.success({data:jpeg})})}})
await s.load('utils/image').readAsJpegDataUrl('small.jpg',{coach:true});assert.equal(small[0].compressedWidth,undefined,'never enlarge small photos')
const timers=new Map();let id=0
const blocked=miniRuntime({globals:{setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)},wx:{compressImage(){},getFileSystemManager:()=>({})}})
const wait=blocked.load('utils/image').readAsJpegDataUrl('retained.jpg',{coach:true}).catch(e=>e)
assert.ok([...timers.values()].some(t=>t.ms===12000),'image SDK stalls are also bounded')
;[...timers.values()].find(t=>t.ms===12000).fn()
assert.match((await wait).message,/图片.*超时/)
console.log('STEM Coach image budget: proportional resize, preserved quality, no upscale, bounded preparation and unchanged IELTS PASS')
