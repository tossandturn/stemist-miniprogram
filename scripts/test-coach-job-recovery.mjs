import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const runtime=miniRuntime(),saved=runtime.storage
saved.set('stemistUser',{id:1})
const {askCoachJob}=runtime.load('utils/coachJob')
const payload={message:'提示这道题',feature:'steps',context:{},imageDataUrls:[]}
let posts=0,reads=0,firstId='',stages=[]
const result={mode:'ai',providerStatus:'connected',answer:'先列方程',answerStatus:'complete'}
const request=async(path,data)=>{
 const id=path.split('/').pop()
 if(data){posts++;firstId=id;throw Object.assign(Error('lost ack'),{code:'network_timeout'})}
 reads++;assert.equal(id,firstId)
 if(reads===1)throw Object.assign(Error('offline'),{code:'network_error'})
 return {id,status:'succeeded',result}
}
const recovered=await askCoachJob(payload,{request,onStage:s=>stages.push(s),pollMs:1})
const {clientTiming,...answerResult}=recovered
assert.deepEqual(answerResult,result)
assert.equal(clientTiming.posts,1);assert.equal(clientTiming.gets,2)
assert.equal(posts,1);assert.equal(reads,2);assert.ok(stages.includes('recovering'))
await askCoachJob(payload,{request:async(path,data)=>{assert.equal(data,undefined);return{id:path.split('/').pop(),status:'succeeded',result}},pollMs:1})
assert.equal(posts,1,'same content recovers result without a second upload or generation')
let cancel,resolveGet
const wait=askCoachJob({...payload,message:'second'},{request:(path,data)=>data?Promise.resolve({id:path.split('/').pop(),status:'running'}):new Promise(r=>{resolveGet=r}),onCancelReady:f=>cancel=f,pollMs:1})
await new Promise(r=>setTimeout(r,8));cancel()
await assert.rejects(wait,e=>e.code==='request_cancelled')
resolveGet?.({status:'succeeded',result})
let finish
const late=askCoachJob({...payload,message:'third'},{request:(path)=>new Promise(r=>{finish=()=>r({id:path.split('/').pop(),status:'succeeded',result})}),pollMs:1})
saved.set('stemistUser',{id:2});finish()
await assert.rejects(late,e=>e.code==='account_changed')
console.log('PASS Coach reconnect: lost acknowledgement, offline GET, original task, cancel, identity switch.')
