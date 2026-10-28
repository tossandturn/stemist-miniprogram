import assert from 'node:assert/strict'
import {miniRuntime,settle,deferred} from './helpers/mini-runtime.mjs'
const session={id:'mini-set-ui',questions:[{id:'q1'}],index:0,stage:'AS',subjectCode:'9702',routeId:'cie-9702-as-physics'}
let wrong=true
const r=miniRuntime({modules:{'utils/nativePractice':{readSession:()=>session,questionView:()=>({question:{id:'q1',images:[]},objectiveResult:wrong?{available:true,score:0,maxScore:1}:null,results:[]})}}})
const p=r.page('pages/stem/practice');p.onLoad({sessionId:session.id})
assert.equal(p.data.canAskCoach,true)
p.askCoach();p.askCoach();assert.equal(r.calls.length,1)
assert.match(r.calls[0].url,/^\/bundles\/coach\/practice\?sessionId=mini-set-ui&questionId=q1$/)
wrong=false;p.onShow();assert.equal(p.data.canAskCoach,false)
p.askCoach();assert.equal(r.calls.length,1)

const review={identity:{owner:'student',epoch:0},sessionId:session.id,questionId:'q1',number:'1',source:'原卷',message:'我的作答 A',context:{skill:'stem-photo',focusedQuestion:{id:'q1',number:'1'},question:{id:'q1'}}}
let valid=true,renders=0,copies=0,cleared=0
const pending=deferred()
const b=miniRuntime({wx:{createSelectorQuery:()=>({in(){return this},select(){return this},fields(){return this},exec(fn){fn([{node:{getContext(){}}}])}}),redirectTo(o){b.calls.push(o);o.fail?.()}},modules:{
 'bundles/coach/practiceReview':{captureReview:()=>review,currentReview:()=>valid},
 'bundles/coach/practiceRender':{renderReview:async()=>{renders++;return pending.promise},removeTemp(){}},
 'utils/nativeCoachPhoto':{persistCoachPhotos:async(p,w,m)=>{copies++;b.storage.set('stemistCoachPhotoMeta',m);return ['/owned/q.jpg']},clearCoachPhoto(){cleared++}}
}})
b.storage.set('stemistUser',{id:'student'});b.storage.set('stemistSessionToken','test-only')
const bridge=b.page('bundles/coach/practice');bridge.onLoad({sessionId:session.id,questionId:'q1'});bridge.onReady()
await settle();pending.resolve(['/temp/q.jpg']);await settle();await settle()
assert.equal(copies,1);assert.match(b.calls[0].url,/feature=answers/)
assert.match(bridge.data.error,/打开/)
await bridge.prepare();assert.equal(renders,1,'navigation retry must reuse committed handoff')
assert.equal(copies,1)
valid=false;await bridge.prepare();assert.match(bridge.data.error,/变化/)
bridge.onUnload();assert.equal(cleared,1)
const encoded=b.page('bundles/coach/practice');encoded.onLoad({sessionId:session.id,questionId:'paper%3Aq1'});assert.equal(encoded.__options.questionId,'paper:q1','native WeChat query values arrive percent-encoded')
console.log('Chapter Coach page: explicit mistake-only tap, duplicate-tap guard, navigation retry and stale-question cancellation passed.')
