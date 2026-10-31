import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const runtime=miniRuntime();runtime.storage.set('stemistUser',{id:'fixture-owner'})
const {askCoachJob}=runtime.load('utils/coachJob'),events=[]
let posts=0
const call=saveTask=>askCoachJob({message:'Solve',reasoningEffort:saveTask?'high':'low',saveTask},{pollMs:1,onStage:x=>events.push(x),request:async(path,payload)=>{
 if(payload)posts++
 const now=Date.now(),retention=saveTask?259200000:600000
 return{id:path.split('/').pop(),status:'succeeded',stage:'complete',createdAt:now-1000,updatedAt:now,expiresAt:now-1000+retention,serverNow:now,task:{schemaVersion:'stem-coach-task-v1',stage:{code:'complete',changedAt:now},persistence:{saved:saveTask,retentionMs:retention},reasoning:{effectiveEffort:saveTask?'high':'low',requestedEffort:saveTask?'high':'low',enabled:true},milestones:{completedAt:now}},result:{answer:'Safe answer',mode:'ai',providerStatus:'connected'}}
}})
await call(false)
const first=events.find(x=>x.phase==='task');assert.ok(first,'real server metadata forwarded even for instant completion')
assert.equal(first.snapshot.answer,undefined);assert.equal(first.snapshot.result,undefined,'progress does not duplicate answers')
const records=()=>runtime.storage.get('stemistCoachJobs:fixture-owner:0')
assert.ok(records()[0].expires-Date.now()<=600000)
await call(false);assert.equal(posts,1,'instant same-content recovery is not a new model call')
await call(true);assert.equal(posts,2,'saving mode changes request identity')
assert.ok(records().at(-1).expires-Date.now()>259100000)
assert.ok(records().every(x=>Object.keys(x).sort().join(',')==='expires,hash,id'),'only recovery references are stored locally')
console.log('PASS task snapshots, mode-specific reference TTL and idempotent retries.')
