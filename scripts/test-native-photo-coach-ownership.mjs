import assert from 'node:assert/strict'
import {miniRuntime,deferred} from './helpers/mini-runtime.mjs'
const waiting=deferred();let syncs=0
const r=miniRuntime({modules:{
 'utils/image':{readAsJpegDataUrl:async()=>'data:image/png;base64,iVBORw0KGgoAAAAA'},
 'utils/coach':{runCoach:()=>waiting.promise},
 'utils/attemptSync':{nextAttemptId:()=> 'qa-photo-fixture',syncStemPhotoAttempt:async()=>{syncs++;return {ok:true}}}
}})
r.storage.set('stemistUser',{id:'ielts:1'});r.storage.set('stemistCroppedImage','/owned/first-photo.jpg')
r.storage.set('stemistCroppedImageMeta',{owner:'ielts:1',epoch:0,path:'/owned/first-photo.jpg'})
r.storage.set('stemistCoachContext',{product:'STEM Studio',routeId:'cie-9702-as-physics',stage:'AS',subjectCode:'9702'})
const p=r.page('pages/stem/coach');p.onLoad({});const asking=p.ask()
await new Promise(resolve=>setImmediate(resolve))
r.storage.set('stemistUser',{id:'ielts:2'});r.storage.set('stemistPrivacyEpoch',1)
waiting.resolve({mode:'ai',providerStatus:'connected',answer:'Private first-account answer'})
await asking
assert.equal(syncs,0,'a late answer cannot be synchronized into the new account')
assert.equal(r.storage.has('stemistSubmission:stem-photo'),false)
assert.equal(p.data.answer,'')
p.onUnload()
console.log('Native STEM photo Coach: late image replies cannot cross account/privacy boundaries.')
