import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const runtime=miniRuntime()
runtime.storage.set('stemistUser',{id:1})
const {askCoachJob,pollDelay}=runtime.load('utils/coachJob')
assert.equal(typeof pollDelay,'function','polling cadence excludes request time instead of adding an extra fixed second')
assert.equal(pollDelay(1000,600,0),400)
assert.equal(pollDelay(1000,1600,0),100)
assert.equal(pollDelay(1000,600,2),2000,'network failures retain bounded backoff')
let count=0
const result={mode:'ai',providerStatus:'connected',answer:'x = 4',answerStatus:'complete'}
const value=await askCoachJob({message:'synthetic',context:{}},{pollMs:1,request:async path=>{
 const id=path.split('/').pop();count++
 return count===1?{id,status:'running',answer:'x = ' }:{id,status:'succeeded',answer:result.answer,result}
}})
assert.equal(value.answer,result.answer)
assert.equal(value.clientTiming.version,1)
assert.equal(value.clientTiming.posts,1);assert.equal(value.clientTiming.gets,1)
assert.equal(value.clientTiming.replayed,false)
assert.ok(value.clientTiming.ackMs>=0&&value.clientTiming.firstAnswerMs>=0&&value.clientTiming.totalMs>=0)
assert.doesNotMatch(JSON.stringify(value.clientTiming),/synthetic|x =|Bearer/)
console.log('PASS Coach segmented client timing and latency-aware polling cadence.')
