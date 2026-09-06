import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
const image='data:image/png;base64,iVBORw0KGgoAAAAA'
const calls=[];let reads=0,polls=0
const r=miniRuntime({modules:{
 'utils/image':{readAsJpegDataUrl:async()=>{reads++;return image}},
 'utils/nativeWritingPhoto':{removeWritingPhoto:()=>{}},
 'utils/coach':{runCoach:async()=>{throw Error('Photographs must not be diverted through transcription')}},
 'utils/ieltsWriting':{
  startWritingFeedback:async(...args)=>{calls.push(args);return 'photo-writing-job-fixture'},
  writingJob:async()=>{if(polls++===0)throw Error('Network timeout');return {status:'done',result:{ai:true,gradeReady:true,feedback:'Photo-backed feedback',band:6,criteria:[],warning:'',reportUrl:'/api/report/pdf/photo-fixture'}}}
 }
}})
const p=r.page('pages/ielts/writing');p.onLoad({});p.onPromptInput({detail:{value:'Discuss this task.'}});p.onInput({detail:{value:'An older typed draft must not be sent with the new photograph.'}})
r.storage.set('stemistWritingPhoto','/owned/new-photo.png');r.storage.set('stemistWritingPhotoMeta',{owner:'guest',epoch:0,scope:p.__scope});p.onShow()
assert.equal(p.data.inputMode,'photo')
await p.submit();assert.equal(calls.length,1);assert.equal(calls[0][1],'');assert.equal(calls[0][3][0],image)
assert.equal(p.data.photoPath,'/owned/new-photo.png');assert.equal(p.data.band,null)
await p.retry();assert.equal(calls.length,1,'polling retry keeps the existing grading job')
assert.equal(reads,1,'polling retry must not recompress or reread the photograph')
assert.equal(p.data.answer,'Photo-backed feedback')
r.storage.set('stemistWritingPhoto','/owned/replacement.png');r.storage.set('stemistWritingPhotoMeta',{owner:'guest',epoch:0,scope:p.__scope});p.onShow()
assert.equal(p.data.answer,'');assert.equal(p.data.reportUrl,'');assert.equal(p.data.band,null,'retake invalidates the previous score')
p.onUnload()

const waiting=deferred();let starts=0
const logout=miniRuntime({modules:{'utils/image':{readAsJpegDataUrl:()=>waiting.promise},'utils/ieltsWriting':{startWritingFeedback:async()=>{starts++;return 'should-not-start'}}}})
const q=logout.page('pages/ielts/writing');q.onLoad({});q.onPromptInput({detail:{value:'Source prompt'}});q.setData({inputMode:'photo',photoPath:'/owned/photo.png'})
const sending=q.submit();logout.storage.set('stemistPrivacyEpoch',1);waiting.resolve(image);await sending;assert.equal(starts,0,'logout during image processing cancels the upload');q.onUnload()

const denied=miniRuntime({modules:{'utils/image':{readAsJpegDataUrl:async()=>image},'utils/ieltsWriting':{startWritingFeedback:async()=>{throw Object.assign(Error('Sign in'),{statusCode:401})}}}})
const a=denied.page('pages/ielts/writing');a.onLoad({});a.onPromptInput({detail:{value:'Source task'}});a.setData({inputMode:'photo',photoPath:'/owned/photo.png'});await a.submit()
assert.equal(a.data.authRequired,true,'401 provides account recovery rather than an endless retry button')
assert.equal(a.data.canRetry,false);assert.equal(a.data.photoPath,'/owned/photo.png');a.onUnload()
let resumeReads=0,resumeStarts=0,resumePolls=0
const resume=miniRuntime({modules:{'utils/image':{readAsJpegDataUrl:async()=>{resumeReads++;return image}},'utils/ieltsWriting':{startWritingFeedback:async()=>{resumeStarts++;return 'restored-photo-job'},writingJob:async()=>{if(resumePolls++===0)throw Error('Connection interrupted');return {status:'done',result:{ai:true,gradeReady:true,feedback:'Recovered feedback',band:7,criteria:[],warning:''}}}}}})
let restored=resume.page('pages/ielts/writing');restored.onLoad();restored.onPromptInput({detail:{value:'Source task'}});restored.setData({inputMode:'photo',photoPath:'/owned/photo.png'});await restored.submit();restored.onUnload()
restored=resume.page('pages/ielts/writing');restored.onLoad();restored.onShow();await settle()
assert.equal(restored.data.answer,'Recovered feedback');assert.equal(resumeStarts,1);assert.equal(resumeReads,1,'reopening queries the saved job automatically without resending its photograph');restored.onUnload()
console.log('Native photo Writing: direct image input, no OCR detour, old-text isolation, retry without reupload, retake invalidation and account recovery passed.')
