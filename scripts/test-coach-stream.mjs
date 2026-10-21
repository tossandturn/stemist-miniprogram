import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const event=(name,data)=>`event: ${name}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`
const complete={mode:'ai',providerStatus:'connected',answer:'## 答案\n\\(x=4\\)\n\n## 解题步骤\n由 \\(2x=8\\) 得出结果。'}
function setup({chunks=true}={}){
 let request,chunk,aborts=0,cancel;const previews=[],stages=[],timers=new Map();let sequence=0
 const r=miniRuntime({wx:{request:o=>{request=o;return{abort(){aborts++},...(chunks?{onChunkReceived:f=>chunk=f}:{})}}},globals:{setTimeout:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)},modules:{'utils/nativeSession':{refreshNativeSession:async()=>{},captureNativeCookie(){}}}})
 r.storage.set('stemistUser',{id:'test-owner'});r.storage.set('stemistSessionToken','fixture-token')
 const promise=r.load('utils/api').askCoach({message:'2x+3=11',onPartial:t=>previews.push(t),onStage:s=>stages.push(s),onCancelReady:fn=>cancel=fn})
 return{r,promise,previews,stages,timers,get request(){return request},get aborts(){return aborts},cancel:()=>cancel?.(),feed(text){for(const b of Buffer.from(text)){const data=Uint8Array.of(b).buffer;chunk?.({data})}},flush(){for(const[id,t]of[...timers])if(t.ms===120){timers.delete(id);t.fn()}}}
}
const s=setup();await settle()
assert.ok(s.request.url.endsWith('/api/ai/coach/stream'),'academic streaming must use the existing SSE route')
assert.equal(s.request.enableChunked,true)
assert.equal(s.request.data.onPartial,undefined)
assert.equal(s.request.data.onCancelReady,undefined)
s.feed(event('meta',{mode:'ai',providerStatus:'connecting'}));s.feed(event('delta',{text:'## 答案\n\\(x='}));s.flush()
assert.equal(s.previews.filter(Boolean).length,0,'never render a heading or unfinished formula alone')
s.feed(event('delta',{text:'4\\)\n'}));s.flush()
assert.equal(s.previews.at(-1),'## 答案\n\\(x=4\\)')
s.feed(event('reset',{}));assert.equal(s.previews.at(-1),'')
s.feed(event('delta',{text:complete.answer+'\n'}));s.flush()
s.feed(event('done',complete));s.request.success({statusCode:200,data:''})
assert.equal((await s.promise).answer,complete.answer)
assert.equal(s.timers.size,0)
const count=s.previews.length;s.feed(event('delta',{text:'late'}));assert.equal(s.previews.length,count)

const broken=setup();await settle();broken.feed(event('meta',{mode:'ai'}));broken.feed(event('delta',{text:'可读的部分答案。\n\\frac{'}));broken.flush()
const rejected=assert.rejects(broken.promise,e=>e.code==='stream_incomplete'&&e.partialAnswer==='可读的部分答案。')
broken.request.success({statusCode:200,data:''});await rejected
assert.equal(broken.timers.size,0)

const fallback=setup({chunks:false});await settle()
fallback.request.success({statusCode:200,data:Buffer.from(event('meta',{mode:'ai'})+event('delta',{text:complete.answer})+event('done',complete))})
assert.equal((await fallback.promise).answer,complete.answer,'older native runtime consumes the same request, never a duplicate fallback')

const stale=setup();await settle();stale.r.storage.set('stemistPrivacyEpoch',1)
const staleReject=assert.rejects(stale.promise,e=>e.code==='account_changed')
stale.feed(event('meta',{mode:'ai'}));stale.feed(event('delta',{text:'private answer\n'}));stale.flush();await staleReject
assert.equal(stale.previews.length,0);assert.equal(stale.aborts,1)

const cancelled=setup();await settle();const cancelReject=assert.rejects(cancelled.promise,e=>e.code==='request_cancelled');cancelled.cancel();await cancelReject
assert.equal(cancelled.aborts,1);assert.equal(cancelled.timers.size,0)
const hanging=setup();await settle();const timeoutReject=assert.rejects(hanging.promise,e=>e.code==='network_timeout')
for(const[id,t]of[...hanging.timers])if(t.ms===55000){hanging.timers.delete(id);t.fn()}
await timeoutReject;assert.equal(hanging.aborts,1)

const unauthorized=setup();await settle();const unauthorizedReject=assert.rejects(unauthorized.promise,e=>e.statusCode===401)
unauthorized.request.success({statusCode:401,data:{error:'fixture'}});await unauthorizedReject
assert.equal(unauthorized.previews.length,0)
const parser=miniRuntime().load('utils/coachStream')
assert.equal(parser.stableAnswer('## 答案\n$$x='),'')
assert.equal(parser.stableAnswer('完成。\n**尚未完成'),'完成。')
assert.equal(parser.stableAnswer('完成。\n```\nx='),'完成。')
const bad=setup();await settle();const badReject=assert.rejects(bad.promise,e=>e.code==='stream_invalid');bad.feed('event: delta\ndata: {\n\n');await badReject
const large=setup();await settle();const limitReject=assert.rejects(large.promise,e=>e.code==='stream_limit');large.feed(event('meta',{mode:'ai'}));large.feed(event('delta',{text:'a'.repeat(120001)}));await limitReject
const partial=miniRuntime({modules:{'utils/api':{askCoach:async()=>({mode:'interrupted',providerStatus:'error',partial:true,answer:'部分结果。\n\\(x='})}}})
const partialResult=await partial.load('utils/coach').runCoach({feature:'answers',message:'fixture',onPartial(){}})
assert.equal(partialResult.completed,false);assert.equal(partialResult.answer,'');assert.equal(partialResult.partialAnswer,'部分结果。')
const contradictory=miniRuntime({modules:{'utils/api':{askCoach:async()=>({mode:'ai',providerStatus:'connected',partial:true,answerStatus:'partial',answer:'not finished'})}}})
assert.equal((await contradictory.load('utils/coach').runCoach({feature:'answers',message:'fixture'})).completed,false,'partial receipt never implies completion even with a connected provider')
// An identity change during the throttle delay must not throw out of a timer.
const timerOwner=setup();await settle();timerOwner.feed(event('meta',{mode:'ai'}));timerOwner.feed(event('delta',{text:'第一段。\n'}));timerOwner.feed(event('delta',{text:'第二段。\n'}))
const timerReject=assert.rejects(timerOwner.promise,e=>e.code==='account_changed');timerOwner.r.storage.set('stemistPrivacyEpoch',1);timerOwner.flush();await timerReject
assert.equal(timerOwner.previews.length,1)
console.log('Coach SSE: byte-safe Chinese/math, preview/reset, terminal, incomplete, buffered compatibility, owner, cancellation, deadline and 401 PASS')
