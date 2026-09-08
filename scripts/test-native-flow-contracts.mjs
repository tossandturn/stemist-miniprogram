import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const source={book:15,test:1,title:'Cambridge 15 Test 1'}
const revisions=['3'.repeat(64),'4'.repeat(64)]
const bank={listening:[{...source,id:'cam15-l-test1'}],reading:[{...source,id:'cam15-r-test1'}],writing:[{...source,id:'cam15-w-test1-task1',sourceAvailability:'ready',sourceRevision:revisions[0]},{...source,id:'cam15-w-test1-task2',sourceAvailability:'ready',sourceRevision:revisions[1]}],speaking:[{...source,id:'cam15-s-test1'}]}
const requests=[]
const r=miniRuntime({modules:{
 'utils/ieltsContent':{loadIeltsContent:async()=>bank},
 'utils/ieltsWriting':{startWritingFeedback:async(prompt,essay,id)=>'job-'+id,writingJob:async()=>({status:'done'})},
 'utils/ieltsLearning':{requestIeltsLearning:async(path,payload)=>{
  requests.push({path,payload})
  return path==='/api/objective/exams'
   ? {examId:'objective_exam_fixture',examToken:'fixture-capability',manifest:payload.manifest}
   : {feedback:'native full exam report',mode:'local'}
 }}
}})
const api=r.load('utils/nativeExam')
assert.equal(api.completeSets(bank).length,1)
assert.equal(api.completeSets({...bank,reading:[{...source,test:2,id:'cam15-r-test2'}]}).length,0)
const exam=await api.newExam('same-test','cam15-test1')
assert.equal(requests[0].payload.manifest.writingSourceIds.length,2)
assert.equal(api.readExam(exam.key).sources.speaking,'cam15-s-test1')
await assert.rejects(()=>api.submitExam(exam.key))
for(const name of ['listening','reading','writing1','writing2','speaking']){const writingIndex=name==='writing1'?0:name==='writing2'?1:-1;api.completeExamModule(exam.key,name,{complete:true,submission:{answers:{}},prompt:'prompt',essay:'essay',title:name,...(writingIndex>=0?{sourceAvailability:'ready',sourceRevision:revisions[writingIndex]}:{})})}
assert.equal((await api.submitExam(exam.key)).submitted,true)
assert.equal(requests[1].payload.fullExamManifest.speakingSourceId,'cam15-s-test1')
r.storage.set('stemistPrivacyEpoch',1);assert.equal(api.readExam(exam.key),null)

const calls=[]
const sessions=miniRuntime({wx:{request(options){calls.push(options);options.success(options.url.endsWith('/native-session')?{statusCode:200,data:{protocol:'ielts-native-session-v1',token:'ielts-native-session',expiresAt:new Date(Date.now()+1800000).toISOString(),user:{id:7}}}:{statusCode:200,data:{ok:true}})}}})
sessions.storage.set('stemistUser',{id:'ielts:7'});sessions.storage.set('stemistSessionToken','signed-stem-identity')
const learning=sessions.load('utils/ieltsLearning')
await learning.requestIeltsLearning('/api/vocabulary',{term:'scalar'})
await learning.requestIeltsLearning('/api/me',undefined,{method:'GET'})
assert.equal(calls.length,3)
assert.equal(calls[0].header['X-Stem-Identity'],'signed-stem-identity')
assert.equal(calls[1].header.Authorization,'Bearer ielts-native-session')
assert.equal(calls[1].header['X-Stem-Identity'],undefined)
const records=sessions.load('utils/nativeRecords')
records.rememberRecord({id:'a',title:'A',skill:'writing',submittedAt:Date.now(),text:'private essay',answer:'large feedback',photoPath:'private-photo'})
assert.doesNotMatch(JSON.stringify(records.recentRecords()),/private essay|large feedback|private-photo/)
console.log('Native flow contracts: full-exam sources/completion/ownership, native session scope and compact records passed.')
