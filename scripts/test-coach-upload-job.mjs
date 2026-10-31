import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
const r=miniRuntime();r.storage.set('stemistUser',{id:'ielts:303'})
const {askCoachJob}=r.load('utils/coachJob')
const payload={message:'fixture',feature:'answers',imageDataUrls:['data:image/png;base64,QUJDRA==']}
const result={mode:'ai',providerStatus:'connected',answer:'synthetic answer',answerStatus:'complete'}
let prepares=0,posts=0,gets=0
const preparePayload=async(p,options)=>{prepares++;assert.equal(typeof options.isCancelled,'function');return{...p,imageDataUrls:[],imageUploadIds:['cu-synthetic-0123456789012345']}}
const request=async(path,data)=>{
 if(data){posts++;assert.deepEqual([...data.imageDataUrls],[],'large image is not embedded in the job POST');assert.equal(data.imageUploadIds.length,1);throw Object.assign(Error('lost job ack'),{code:'network_timeout'})}
 gets++;return{id:path.split('/').pop(),status:'succeeded',result}
}
await askCoachJob(payload,{request,preparePayload,pollMs:1})
assert.equal(prepares,1);assert.equal(posts,1);assert.equal(gets,1)
await askCoachJob(payload,{request,preparePayload,pollMs:1})
assert.equal(prepares,1,'existing job result is read before preparing or uploading images again')
assert.equal(posts,1);assert.equal(gets,2)
let options
const wired=miniRuntime({modules:{'utils/coachJob':{askCoachJob:(p,o)=>{options=o;return Promise.resolve(result)}}}})
await wired.load('utils/api').askCoach(payload)
assert.equal(typeof options.preparePayload,'function','production API wires the image preparer')
const blocked=deferred();let cancel,dispatched=0
const inUpload=askCoachJob({...payload,message:'pause during transfer'},{request:async()=>{dispatched++},preparePayload:async(p,o)=>{o.onStage({phase:'uploading',uploadedBytes:4,totalBytes:8});await blocked.promise;return p},onCancelReady:f=>cancel=f})
await settle();cancel()
await assert.rejects(inUpload,e=>e.code==='request_cancelled'&&/上传/.test(e.message),'pause during upload cannot pretend an AI answer already exists')
blocked.resolve(payload);await settle();assert.equal(dispatched,0)
await assert.rejects(askCoachJob({...payload,message:'invalid upload response'},{preparePayload:async()=>{throw Object.assign(Error('invalid upload protocol'),{code:'coach_upload_protocol',statusCode:502})},request:async()=>assert.fail('invalid transfer metadata must stop before querying or creating a model task'),pollMs:1}),e=>e.code==='coach_upload_protocol')
console.log('PASS Coach upload/job boundary: small POST, lost ACK, query before upload and production wiring')
