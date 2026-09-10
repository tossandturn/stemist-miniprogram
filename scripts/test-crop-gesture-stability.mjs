import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
let measure
const runtime=miniRuntime({wx:{createSelectorQuery(){
 return {in(){return this},select(){return this},boundingClientRect(){return this},exec(callback){measure=callback}}
}}})
const page=runtime.page('pages/crop/crop'),writes=[]
const setData=page.setData.bind(page);page.setData=(patch,callback)=>{writes.push(patch);setData(patch,callback)}
page.onLoad({src:'local-photo'})
writes.length=0
for(let i=0;i<300;i++)page.onMove({detail:{x:i/3,y:i/5,source:'touch'}})
for(let i=0;i<30;i++)page.onScale({detail:{x:i,y:i,scale:1+i/30}})
assert.equal(writes.length,0,'Native gesture events must not echo x/y/scale through setData')
let resets=0;const reset=page.resetFrame.bind(page);page.resetFrame=()=>resets++
page.onResize();assert.equal(resets,0,'Window resize must not reset a student crop')
page.resetFrame=reset
page.resetFrame();page.onGestureStart();measure([{width:390,height:440}])
assert.equal(writes.filter(p=>'x' in p||'scale' in p).length,0,'Late initial measurement must not override a started gesture')
page.resetFrame();measure([{width:390,height:440}])
assert.equal(page.data.scale,0.68);assert.equal(page.data.x,62.4)
const first=page.data.frameInstances[0].id
page.resetFrame();measure([{width:390,height:440}])
assert.notEqual(page.data.frameInstances[0].id,first,'Explicit reset must reach native view even if bound command coordinates are unchanged')
page.onUnload();writes.length=0;page.onMove({detail:{x:900,y:900}});page.onScale({detail:{scale:3}})
assert.equal(writes.length,0)
const template=fs.readFileSync(new URL('../pages/crop/crop.wxml',import.meta.url),'utf8')
assert.match(template,/out-of-bounds="\{\{false\}\}"/)
assert.match(template,/catch:htouchmove="holdGesture"/);assert.match(template,/catch:vtouchmove="holdGesture"/)
console.log('Crop stability: no gesture feedback loop, no resize reset, stale measurement rejected, explicit keyed reset and no overscroll rebound passed.')
for(const route of ['native-paper','native-practice'])for(const phase of ['compress','copy']){
 const gate=deferred(),removed=[];let copied
 const r=miniRuntime({modules:{'utils/image':{compressImage:async()=>{if(phase==='compress')await gate.promise;return '/fixture-compressed'}}},wx:{env:{USER_DATA_PATH:'/fixture-user-data'},getFileSystemManager:()=>({mkdirSync(){},accessSync(){},copyFile(opts){copied=opts;if(phase==='compress')opts.success()},unlink({filePath}){removed.push(filePath)}})}})
 const old={photo:'/fixture-user-data/old.jpg',revision:1,results:{kept:true}}
 let scope,read
 if(route==='native-paper'){
  const p=r.load('utils/nativePaper'),draft=p.createPaperDraft({id:'cancel-race',subject:'9702'},{routeId:'cie-9702-as-physics',stage:'AS'})
  draft.answers[1]=old;p.savePaperDraft(draft);scope={storageKey:draft.storageKey,sessionId:draft.id,questionNumber:1};read=()=>p.readPaperDraft(draft.storageKey).answers[1]
 }else{
  const p=r.load('utils/nativePractice'),draft={id:'mini-set-cancel-race',schema:1,owner:'',privacyEpoch:0,questions:[{id:'q1'}],answers:{q1:old}}
  p.saveSession(draft);scope={sessionId:draft.id,questionId:'q1',privacyEpoch:0};read=()=>p.readSession(draft.id).answers.q1
 }
 r.storage.set('stemistCropReturn',{route,context:scope});const p=r.page('pages/crop/crop');p.onLoad({src:'/fixture-photo'})
 const finishing=p.finish('/fixture-crop');await settle();p.cancel()
 if(phase==='compress')gate.resolve();else copied.success()
 await finishing;assert.deepEqual(JSON.parse(JSON.stringify(read())),old,'Cancelled '+route+' '+phase+' must preserve original answer')
 assert.ok(!removed.includes(old.photo));assert.equal(removed.length,phase==='copy'?1:0)
}
console.log('Crop async cancellation: paper/practice compression and copy phases retain old photos/results and remove only cancelled new copies.')
