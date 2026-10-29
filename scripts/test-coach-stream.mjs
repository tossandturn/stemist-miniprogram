import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const event=(name,data)=>`event: ${name}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`
const complete={mode:'ai',providerStatus:'connected',answer:'## 答案\n\\(x=4\\)\n\n## 解题步骤\n由 \\(2x=8\\) 得出结果。'}
function setup(){
 const previews=[],timers=new Map();let serial=0
 const r=miniRuntime({globals:{setTimeout:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial},clearTimeout:id=>timers.delete(id)}})
 const parser=r.load('bundles/coach/responseStream').createCoachStream({onPreview:t=>previews.push(t)})
 return {parser,previews,timers,feed(text){for(const b of Buffer.from(text))parser.push(Uint8Array.of(b).buffer)},flush(){for(const [id,t] of [...timers]){timers.delete(id);t.fn()}}}
}
// Transport recovery is covered by test-coach-job-recovery and request-deadline.
const s=setup()
s.feed(event('meta',{mode:'ai'}));s.feed(event('delta',{text:'## 答案\n\\(x='}));s.flush()
assert.equal(s.previews.filter(Boolean).length,0)
s.feed(event('delta',{text:'4\\)\n'}));s.flush();assert.equal(s.previews.at(-1),'## 答案\n\\(x=4\\)')
s.feed(event('reset',{}));assert.equal(s.previews.at(-1),'')
s.feed(event('delta',{text:complete.answer+'\n'}));s.flush();s.feed(event('done',complete))
assert.equal(s.parser.finish('').answer,complete.answer);s.parser.close();assert.equal(s.timers.size,0)
const count=s.previews.length;s.feed(event('delta',{text:'late'}));assert.equal(s.previews.length,count)
const broken=setup();broken.feed(event('meta',{mode:'ai'}));broken.feed(event('delta',{text:'可读的部分答案。\n\\frac{'}));broken.flush()
assert.throws(()=>broken.parser.finish(''),e=>e.code==='stream_incomplete'&&e.partialAnswer==='可读的部分答案。');broken.parser.close()
const buffered=setup();assert.equal(buffered.parser.finish(Buffer.from(event('meta',{mode:'ai'})+event('done',complete))).answer,complete.answer);buffered.parser.close()
const bad=setup();assert.throws(()=>bad.feed('event: delta\ndata: {\n\n'),e=>e.code==='stream_invalid');bad.parser.close()
const large=setup();large.feed(event('meta',{mode:'ai'}));assert.throws(()=>large.feed(event('delta',{text:'a'.repeat(120001)})),e=>e.code==='stream_limit');large.parser.close()
const parser=miniRuntime().load('utils/coachStream')
assert.equal(parser.liveAnswer('## 答案\n答案是'),'## 答案\n答案是')
assert.equal(parser.liveAnswer('## 答案\n\\(x=4\\)'),'## 答案\n\\(x=4\\)')
assert.equal(parser.liveAnswer('## 答案\n\\(x='),'')
assert.equal(parser.stableAnswer('## 答案\n$$x='),'')
assert.equal(parser.stableAnswer('完成。\n**尚未完成'),'完成。')
assert.equal(parser.stableAnswer('完成。\n'+String.fromCharCode(96).repeat(3)+'\nx='),'完成。')
const partial=miniRuntime({modules:{'utils/api':{askCoach:async()=>({mode:'interrupted',providerStatus:'error',partial:true,answer:'部分结果。\n\\(x='})}}})
const partialResult=await partial.load('utils/coach').runCoach({feature:'answers',message:'fixture',onPartial(){}})
assert.equal(partialResult.completed,false);assert.equal(partialResult.answer,'');assert.equal(partialResult.partialAnswer,'部分结果。')
const contradictory=miniRuntime({modules:{'utils/api':{askCoach:async()=>({mode:'ai',providerStatus:'connected',partial:true,answerStatus:'partial',answer:'not finished'})}}})
assert.equal((await contradictory.load('utils/coach').runCoach({feature:'answers',message:'fixture'})).completed,false)
console.log('Coach preview protocol: Chinese/math, reset, terminal, partial, buffered, malformed and size limits PASS')
