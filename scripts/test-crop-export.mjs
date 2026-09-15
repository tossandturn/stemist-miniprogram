import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'

let drawArgs,exportArgs,finished
const canvas={width:0,height:0,getContext(){return{clearRect(){},drawImage(...args){drawArgs=args}}},createImage(){const image={};Object.defineProperty(image,'src',{set(value){image.source=value;queueMicrotask(()=>image.onload?.())}});return image}}
const runtime=miniRuntime({wx:{createSelectorQuery(){return{in(){return this},select(){return this},fields(){return this},exec(callback){callback([{node:canvas,width:320,height:440}])}}},canvasToTempFilePath(options){exportArgs=options;options.success({tempFilePath:'/tmp/cropped.png'})},getImageInfo(options){options.success({width:640,height:480})}}})
const page=runtime.page('pages/crop/crop')
page.onLoad({src:'/tmp/source.jpg'})
page.finish=path=>{finished=path}
page.exportCrop(10,20,640,480,'/tmp/normalized-source.jpg')
await settle();await new Promise(resolve=>setTimeout(resolve,10))
assert.deepEqual([canvas.width,canvas.height],[640,480])
assert.equal(drawArgs[0].source,'/tmp/normalized-source.jpg')
assert.deepEqual(drawArgs.slice(1),[10,20,640,480,0,0,640,480])
assert.equal(exportArgs.canvas,canvas)
assert.equal(exportArgs.fileType,'png')
assert.equal(finished,'/tmp/cropped.png')
console.log('Crop export: 2D canvas waits for image load, exports PNG pixels and verifies the result before persistence passed.')
