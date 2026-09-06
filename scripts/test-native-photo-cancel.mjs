import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let captured
const camera=miniRuntime({wx:{createCameraContext:()=>({takePhoto:options=>{captured=options}})}})
const c=camera.page('pages/stem/camera');c.onLoad();c.onReady();c.takePhoto();c.onUnload();captured.success({tempImagePath:'/camera/late.jpg'})
assert.equal(camera.calls.length,0,'camera completion after leaving cannot reopen a crop page')

const r=miniRuntime({modules:{'utils/nativeWritingPhoto':{persistWritingPhoto:async()=>'/owned/photo.jpg',removeWritingPhoto:()=>{}}}})
const a={route:'writing',captureId:'photo-a',context:{writingScope:'ielts-writing:cam15-w-test1-task2',writingTaskId:'cam15-w-test1-task2'}}
const b={route:'writing',captureId:'photo-b',context:{writingScope:'ielts-writing:cam15-w-test2-task2',writingTaskId:'cam15-w-test2-task2'}}
r.storage.set('stemistCropReturn',a)
const crop=r.page('pages/crop/crop');crop.onLoad({src:'/camera/a.jpg'});r.storage.set('stemistCropReturn',b);await crop.finish('/cropped/a.jpg')
assert.equal(r.storage.get('stemistWritingPhotoMeta').scope,a.context.writingScope,'the displayed photo retains its captured question binding')
assert.equal(r.storage.get('stemistCropReturn').captureId,'photo-b','finishing one crop does not delete another pending photo route')
assert.match(r.calls[0].url,/taskId=cam15-w-test1-task2/,'missing parent stack falls back to the same task')
const stopped=miniRuntime({modules:{'utils/nativeWritingPhoto':{persistWritingPhoto:async()=>'/owned/photo.jpg',removeWritingPhoto:()=>{}}}})
stopped.storage.set('stemistCropReturn',a);const q=stopped.page('pages/crop/crop');q.onLoad({src:'/camera/a.jpg'});q.cancel();await q.finish('/cropped/a.jpg')
assert.equal(stopped.storage.has('stemistWritingPhoto'),false,'cancelled crop cannot publish a late image')
const framed=miniRuntime({wx:{createSelectorQuery:()=>({in(){return this},select(){return this},boundingClientRect(){return this},exec(fn){fn([{width:400,height:440}])}})}})
const frame=framed.page('pages/crop/crop');frame.onLoad({src:'/camera/a.jpg'});frame.onReady()
assert.equal(frame.data.x,64);assert.equal(frame.data.y,70.4);assert.equal(frame.data.scale,0.68,'initial photograph is centred wholly inside the crop frame')
console.log('Native photo lifecycle: cancelled camera/crop cannot navigate late; captured question binding and fallback routes remain exact.')
