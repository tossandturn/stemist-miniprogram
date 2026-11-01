import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let received
const r=miniRuntime({modules:{'utils/api':{askCoach:async o=>{received=o;return{mode:'ai',providerStatus:'connected',answer:'done'}}}}})
await r.load('utils/coach').runCoach({message:'Explain F=ma',feature:'answers'})
assert.equal(received.diagramFormat,'stem-diagram-v1','academic clients explicitly advertise safe diagram rendering')
const apiRuntime=miniRuntime({modules:{'utils/coachJob':{askCoachJob:p=>p}}})
const wire=apiRuntime.load('utils/api').askCoach({message:'sample',diagramFormat:'stem-diagram-v1'})
assert.equal(wire.diagramFormat,'stem-diagram-v1')
const jobRuntime=miniRuntime(),job=jobRuntime.load('utils/coachJob'),legacy={message:'same question',context:{},history:[]},legacyId='cj-legacy-diagram-12345678'
jobRuntime.storage.set('stemistUser',{id:'ielts:42'})
jobRuntime.storage.set('stemistCoachJobs:ielts:42:0',[{id:legacyId,hash:job.fingerprint(legacy),expires:Date.now()+60000}])
const calls=[]
const result=await job.askCoachJob({...legacy,diagramFormat:'stem-diagram-v1'},{request:async(url,body,options)=>{calls.push({url,body,method:options.method});return{id:legacyId,status:'succeeded',result:{answer:'old completed answer'}}}})
assert.equal(result.answer,'old completed answer');assert.equal(calls.length,1);assert.equal(calls[0].method,'GET');assert.equal(calls[0].body,undefined,'upgrade restores the old job, never starts a duplicate generation')
console.log('PASS diagram capability transport and legacy request recovery without duplicate generation')
