import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const calls=[]
const r=miniRuntime({modules:{
 'utils/ieltsLearning':{
  requestIeltsLearning:async(path,payload)=>{
   calls.push({path,payload})
   if(path.includes('/profile'))return {profile:{targetBand:payload.targetBand,updatedAt:new Date().toISOString()}}
   if(path.includes('/state'))return {profile:{targetBand:7,updatedAt:new Date().toISOString()},attempts:[{attemptId:'objective-cloud-id',module:'reading',itemId:'cam15-r-test1::section::2',mode:'native-section',score:{correct:8,total:13},submittedAt:new Date().toISOString()}]}
   if(path.includes('/attempts/'))return {attempt:{result:{answerAvailable:true,correct:8,total:13,details:Array.from({length:13},(_,i)=>({id:'q'+(i+14),actual:'a',expected:'b'}))}}}
   return {}
  }
 }
}})
r.storage.set('stemistUser',{id:'ielts:7'});r.storage.set('stemistSessionToken','fixture')
const p=r.page('pages/ielts/home');p.onLoad({view:'records'});p.onShow();await settle()
assert.equal(p.data.records.length,1);assert.equal(p.data.records[0].band,null);assert.match(p.data.records[0].title,/Passage 2/)
await p.openRecord({currentTarget:{dataset:{index:0}}});assert.equal(p.data.reportRows.length,10);p.moreReport();assert.equal(p.data.reportRows.length,13);p.closeReport()
p.chooseTarget({detail:{value:5}});await p.__goalQueue
assert.equal(r.storage.get('stemistGoal:ielts:7').target,7.5);assert.equal(r.storage.get('stemistGoal:ielts:7').syncPending,false)
assert.ok(calls.some(c=>c.path==='/api/learning/profile'&&c.payload.targetBand===7.5))
p.onUnload()
console.log('Native cloud learning: summaries, lazy report paging, source section identity and synchronized target passed.')
