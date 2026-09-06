import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const calls=[],reports=[],image='data:image/png;base64,iVBORw0KGgoAAAAA'
const r=miniRuntime({modules:{
 'utils/image':{readAsJpegDataUrl:async()=>image},
 'utils/ieltsWriting':{startWritingFeedback:async(...args)=>{calls.push(args);return 'photo-job-'+calls.length},writingJob:async()=>({status:'done'})},
 'utils/ieltsLearning':{requestIeltsLearning:async(path,payload)=>{reports.push({path,payload});return {feedback:'Complete source-backed report',mode:'ai'}}}
}})
const api=r.load('utils/nativeExam'),exam={key:'mini-exam-photo-fixture',owner:'guest',epoch:0,context:'random-exam',sources:{writing:['cam15-w-test1-task1','cam16-w-test1-task2']},manifest:{writingSourceIds:['cam15-w-test1-task1','cam16-w-test1-task2']},modules:{listening:{complete:true,submission:{}},reading:{complete:true,submission:{}},writing1:{complete:true,prompt:'Chart task',essay:'Must not replace photo',photoPath:'/owned/answer.jpg'},writing2:{complete:true,prompt:'Essay task',essay:'Typed response'},speaking:{complete:true}},submitted:false}
api.saveExam(exam);await api.submitExam(exam.key)
assert.equal(calls[0][1],'');assert.equal(calls[0][3][0],image,'full-exam photographs go directly to the visual grader')
assert.equal(calls[1][1],'Typed response');assert.equal(calls[1][3].length,0)
assert.deepEqual(Array.from(reports[0].payload.writing.feedbackJobIds),['photo-job-1','photo-job-2'])
assert.doesNotMatch(JSON.stringify(reports),/data:image|Must not replace photo/,'report requests use owned grading jobs, never duplicate image uploads')
assert.doesNotMatch(JSON.stringify(api.readExam(exam.key)),/data:image/,'inline images are not stored in the exam draft')
await api.submitExam(exam.key);assert.equal(calls.length,2);assert.equal(reports.length,1)
console.log('Native photo exam: mixed typed/photo source tasks use asynchronous visual grading and idempotent report assembly.')
