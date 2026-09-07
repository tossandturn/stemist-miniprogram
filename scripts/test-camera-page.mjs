import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let chosenSource=''
const r=miniRuntime({wx:{
 getSetting:o=>o.success({authSetting:{'scope.camera':true}}),
 createCameraContext:()=>null,
 chooseMedia:options=>{chosenSource=options.sourceType[0];options.success({tempFiles:[{tempFilePath:'/tmp/camera.jpg'}]})},
}})
r.storage.set('stemistCameraReturn',{route:'stem',context:{category:'alevel',family:'exam',subjectCode:'9702',routeId:'cie-9702-as-physics',stage:'AS'}})
const page=r.page('pages/stem/camera');page.onLoad();assert.equal(page.data.category,'alevel');assert.equal(page.data.family,'exam')
await page.onReady();assert.equal(page.data.ready,false);page.onCameraInitialized();assert.equal(page.data.ready,false,'missing native context is not ready')
await page.useSystemCamera();assert.equal(chosenSource,'camera','explicit fallback must be camera-only');assert.match(r.calls[0].url,/^\/pages\/crop\/crop\?src=/)
assert.equal(r.storage.get('stemistCropReturn').context.routeId,'cie-9702-as-physics');page.onUnload()
console.log('Native camera page and explicit camera-only fallback contract passed.')
