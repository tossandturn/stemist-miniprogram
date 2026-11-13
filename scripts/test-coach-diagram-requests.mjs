import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let received,partial=false
const r=miniRuntime({modules:{
 'utils/api':{askCoach:async o=>{
  received=o
  return{mode:'ai',providerStatus:'connected',answer:'done',partial,diagramOffer:{type:'force',question:'需要我补一张受力图说明吗？'}}
 }},
}})
const initial=await r.load('utils/coach').runCoach({message:'Explain F=ma',feature:'answers'})
assert.equal(received.diagramFormat,'stem-diagram-v1','academic clients explicitly advertise safe diagram rendering')
assert.equal(received.diagramIntent,'ask','default academic request asks for text first and lets the server decide whether to offer a diagram')
assert.deepEqual(JSON.parse(JSON.stringify(initial.diagramOffer)),{type:'force',question:'需要我补一张受力图说明吗？'})
await r.load('utils/coach').runCoach({message:'Draw it',feature:'answers',diagramIntent:'draw'});assert.equal(received.diagramIntent,'draw')
await assert.rejects(()=>r.load('utils/coach').runCoach({message:'bad',diagramIntent:'automatic'}),/diagramIntent|绘图意图/)
partial=true;const incomplete=await r.load('utils/coach').runCoach({message:'partial',feature:'answers'});assert.equal(incomplete.diagramOffer,undefined,'partial answers never expose diagram actions')
const apiRuntime=miniRuntime({modules:{'utils/coachJob':{askCoachJob:p=>p}}})
const wire=apiRuntime.load('utils/api').askCoach({message:'sample',diagramFormat:'stem-diagram-v1',diagramIntent:'draw'})
assert.equal(wire.diagramFormat,'stem-diagram-v1')
assert.equal(wire.diagramIntent,'draw')
const jobRuntime=miniRuntime(),job=jobRuntime.load('utils/coachJob'),legacy={message:'same question',context:{},history:[]},legacyId='cj-legacy-diagram-12345678'
jobRuntime.storage.set('stemistUser',{id:'ielts:42'})
jobRuntime.storage.set('stemistCoachJobs:ielts:42:0',[{id:legacyId,hash:job.fingerprint(legacy),expires:Date.now()+60000}])
const calls=[]
const result=await job.askCoachJob({...legacy,diagramFormat:'stem-diagram-v1',diagramIntent:'ask'},{request:async(url,body,options)=>{calls.push({url,body,method:options.method});return{id:legacyId,status:'succeeded',result:{answer:'old completed answer'}}}})
assert.equal(result.answer,'old completed answer');assert.equal(calls.length,1);assert.equal(calls[0].method,'GET');assert.equal(calls[0].body,undefined,'upgrade restores the old job, never starts a duplicate generation')
const drawCalls=[]
await job.askCoachJob({...legacy,diagramFormat:'stem-diagram-v1',diagramIntent:'draw'},{request:async(url,body,options)=>{const id=url.split('/').at(-1);drawCalls.push({body,method:options.method});return{id,status:'succeeded',result:{answer:'diagram only'}}}})
assert.equal(drawCalls[0].method,'POST','explicit draw is a new authorized request, not the old text job')
console.log('PASS diagram capability transport and legacy request recovery without duplicate generation')
