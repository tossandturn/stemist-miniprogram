import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const source='original-photo.jpg',qualities=[]
let current=82,coach=true
const bytes=size=>{const b=Buffer.alloc(size,1);b[0]=255;b[1]=216;b[2]=255;return b.toString('base64')}
const r=miniRuntime({wx:{getImageInfo:o=>o.success({width:4032,height:3024,orientation:'up'}),compressImage:o=>{assert.equal(o.src,source,'each attempt uses original, never repeatedly recompresses a prior JPEG');assert.equal(o.compressedWidth,coach?2048:undefined);assert.equal(o.compressedHeight,coach?1536:undefined);current=o.quality;qualities.push(current);o.success({tempFilePath:'copy-'+current+'.jpg'})},getFileSystemManager:()=>({readFile:o=>o.success({data:bytes(current>=65?1100*1024:700*1024)}),unlink(){assert.fail('compression must not remove original')}})}})
const result=await r.load('utils/image').readImageDataUrl(source,{coach:true})
assert.deepEqual(qualities,[82,65],'do not degrade math evidence below65 just to hit the latency target')
assert.equal(Buffer.from(result.split(',')[1],'base64').length,1100*1024,'readable larger image remains usable through resumable transport')
qualities.length=0;coach=false
await r.load('utils/image').readImageDataUrl(source)
assert.deepEqual(qualities,[82],'separate IELTS compression contract unchanged')
console.log('PASS Coach compression fidelity floor, original-file preservation, aspect ratio and separate IELTS behavior')
