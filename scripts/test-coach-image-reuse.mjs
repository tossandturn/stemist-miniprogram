import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const jpeg=Buffer.from([255,216,255,224,0,16,74,70,73,70]).toString('base64')
async function check({orientation='up',size=10,width=1500,coach=true}={}){
 let compressed=0
 const runtime=miniRuntime({wx:{getImageInfo:o=>o.success({width,height:1500,orientation}),compressImage:o=>{compressed++;o.success({tempFilePath:'compressed.jpg'})},getFileSystemManager:()=>({getFileInfo:o=>o.success({size}),readFile:o=>o.success({data:jpeg})})}})
 const result=await runtime.load('utils/image').readImageDataUrl('synthetic.jpg',{coach})
 assert.equal(result,'data:image/jpeg;base64,'+jpeg)
 return compressed
}
assert.equal(await check(),0,'a small upright prepared image must not be recompressed or enlarged')
assert.equal(await check({orientation:'right'}),1,'orientation correction remains on the original path')
assert.equal(await check({size:900*1024}),1,'large image must still be compressed')
assert.equal(await check({width:4096}),1,'large dimensions must still be resized')
assert.equal(await check({coach:false}),1,'IELTS image preparation stays unchanged')
console.log('PASS small prepared photo reuse, orientation, dimensions, byte budget and IELTS isolation.')
