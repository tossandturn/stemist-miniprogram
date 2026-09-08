import assert from 'node:assert/strict'
import {miniRuntime,settle,deferred} from './helpers/mini-runtime.mjs'

const result={ai:true,feedback:'Reviewed essay feedback',band:6.5,criteria:[{label:'Task Response',score:6}],warning:''}
const revision='1'.repeat(64)
let starts=0, polls=0
const writing=miniRuntime({modules:{
 'utils/ieltsContent':{getIeltsTask:async()=>({id:'cam15-w-test1-task2',title:'Writing 2',type:'Task 2',prompt:'Discuss both views.',images:[],sourceAvailability:'ready',sourceRevision:revision})},
 'utils/ieltsWriting':{startWritingFeedback:async()=>{starts++;return 'writing-job-fixture'},writingJob:async()=>{polls++;return{status:'done',result}}},
}})
let p=writing.page('pages/ielts/writing')
p.onLoad({taskId:'cam15-w-test1-task2'});await settle()
p.onInput({detail:{value:'An original student essay.'}})
await p.submit();assert.equal(p.data.answer,result.feedback)
p.onUnload()
p=writing.page('pages/ielts/writing');p.onLoad({taskId:'cam15-w-test1-task2'});await settle()
assert.equal(p.data.answer,result.feedback,'completed writing feedback must survive reopening')
assert.equal(p.data.band,6.5)
p.onInput({detail:{value:'A revised essay.'}});assert.equal(p.data.answer,'');p.onUnload()

let failOnce=true
const resume=miniRuntime({modules:{
 'utils/ieltsWriting':{startWritingFeedback:async()=>{starts++;return 'writing-pending-fixture'},writingJob:async()=>{if(failOnce){failOnce=false;throw new Error('Network timeout')}return{status:'done',result}}},
}})
const q=resume.page('pages/ielts/writing');q.onLoad({});q.onPromptInput({detail:{value:'Discuss the issue.'}});q.onInput({detail:{value:'My essay.'}})
await q.submit();const issued=starts;await q.retry();assert.equal(starts,issued,'a transient polling failure must resume the same job, not bill a second job');q.onUnload()

const detail=deferred()
const vocab=miniRuntime({modules:{'utils/nativeVocabulary':{vocabularyIndex:async()=>[{id:'i',word:'word',bank:'ielts',meaning:'meaning'},{id:'s',word:'scalar',bank:'stem',meaning:'scalar'}],vocabularyDetail:()=>detail.promise}}})
const v=vocab.page('pages/ielts/vocabulary');v.onLoad({});await settle()
const opening=v.openWord({currentTarget:{dataset:{id:'i'}}});v.switchBank({currentTarget:{dataset:{bank:'stem'}}})
detail.resolve({id:'i',word:'old IELTS word'});await opening
assert.equal(v.data.word,null,'old-bank response cannot reopen a stale detail');assert.equal(v.data.detailBusy,false);v.onUnload()

const requests=[]
const http=miniRuntime({modules:{'utils/ieltsLearning':{requestIeltsLearning:async(path)=>{requests.push(path);return {jobId:'writing-job-fixture',status:'done',result:{mode:'ai:test',feedback:'feedback',analysis:{overall:6,criteria:['Task Response','Coherence','Lexical','Grammar'].map(label=>({label,score:6,feedback:'Specific feedback'}))},pdfUrl:'/api/report/pdf/fixture'}}}}}})
const service=http.load('utils/ieltsWriting');await service.startWritingFeedback('prompt','essay');const graded=await service.writingJob('writing-job-fixture')
assert.equal(requests.length,2);assert.equal(graded.result.criteria[0].reason,'Specific feedback');assert.equal(graded.result.reportUrl,'/api/report/pdf/fixture')
for(const analysis of [{overall:null,criteria:[]},{overall:7,confidence:'low',criteria:graded.result.criteria},{overall:7,reviewRequired:true,criteria:graded.result.criteria}])assert.equal(service.normalizeWritingResult({mode:'ai:test',analysis}).band,null,'missing/low-confidence grading is not a headline score')
let copiedPath=''
const photo=miniRuntime({wx:{env:{USER_DATA_PATH:'/owned'},getFileSystemManager:()=>({mkdirSync(){},accessSync(){},copyFile(options){copiedPath=options.destPath;options.success()},unlink(){}})},modules:{'utils/image':{compressImage:async path=>path}}})
const photos=photo.load('utils/nativeWritingPhoto')
assert.equal(await photos.persistWritingPhoto('/camera/source.jpg',{owner:'guest',epoch:0}),copiedPath)
assert.match(copiedPath,/^\/owned\/native-writing\/writing-[a-z0-9-]+\.jpg$/)
photo.storage.set('stemistPrivacyEpoch',1)
await assert.rejects(()=>photos.persistWritingPhoto('/camera/source.jpg',{owner:'guest',epoch:0}))
console.log('Native recovery: writing feedback and pending-job restore, native auth transport, report shape and stale vocabulary response passed.')
