import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
for(const route of ['pages/coach/index','pages/stem/coach']){
 const result=deferred();let options,cancelled=0
 const r=miniRuntime({modules:{'utils/coach':{runCoach:o=>{options=o;o.onCancelReady?.(()=>cancelled++);return result.promise}},'utils/image':{readAsJpegDataUrl:async()=> 'data:image/jpeg;base64,fixture'},'utils/coachSession':{warmCoachSession:()=>()=>{}}}})
 const page=r.page(route);page.onLoad({feature:'answers'});page.setData({message:'synthetic equation',imagePath:'/fixture.jpg'})
 const call=route==='pages/coach/index'?page.submit():page.ask();await settle()
 assert.equal(typeof options.onPartial,'function','STEM pages must consume streamed previews')
 options.onPartial('## 答案\n\\(x=4\\)')
 assert.equal(page.data.answer,'## 答案\n\\(x=4\\)');assert.equal(page.data.loading,true)
 assert.equal([...r.storage.keys()].some(k=>k.startsWith('stemistSubmission:')),false,'partial is not a completed submission')
 result.reject(Object.assign(new Error('connection interrupted'),{partialAnswer:'## 答案\n\\(x=4\\)'}));await call
 assert.equal(page.data.loading,false);assert.equal(page.data.canRetry,true);assert.match(page.data.warning,/未完成/)
 assert.equal([...r.storage.keys()].some(k=>k.startsWith('stemistSubmission:')),false)
 options.onPartial('late overwrite');assert.equal(page.data.answer,'## 答案\n\\(x=4\\)')
 page.onUnload();assert.equal(cancelled,0,'completed/failed turn releases cancellation hook')
}
const pending=deferred();let opts,cancels=0
const q=miniRuntime({modules:{'utils/coach':{runCoach:o=>{opts=o;o.onCancelReady?.(()=>{cancels++;pending.reject(new Error('cancel'))});return pending.promise}},'utils/coachSession':{warmCoachSession:()=>()=>{}}}})
const page=q.page('pages/coach/index');page.onLoad({feature:'answers'});page.setData({message:'fixture'});const call=page.submit();await settle();page.onUnload();await call
assert.equal(cancels,1);opts.onPartial('late');assert.equal(page.data.answer,'')
const panel=fs.readFileSync(new URL('../components/coach-panel/index.wxml',import.meta.url),'utf8')
assert.ok(panel.indexOf('warning && academic')>=0&&panel.indexOf('warning && academic')<panel.indexOf('class="result"'),'incomplete warning must appear before partial answer, not below a long response')
let warmed=0
const i=miniRuntime({modules:{'utils/coachSession':{warmCoachSession:()=>{warmed++;return()=>{}}},'utils/coach':{runCoach:async o=>{assert.equal(o.onPartial,undefined);return{completed:true,answer:'IELTS unchanged',mode:'ai',providerStatus:'connected'}}}}})
const ip=i.page('pages/coach/index');ip.onLoad({source:'writing'});ip.onShow();ip.setData({message:'essay'});await ip.submit();ip.onUnload();assert.equal(warmed,0)
console.log('Streaming pages: live preview, partial failure, no false submission, late callback, unload abort, IELTS isolation PASS')
