import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let calls=0
const r=miniRuntime({modules:{'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async()=>{calls++;throw new Error('offline')}}}})
const service=r.load('utils/ieltsContent'),bank=await service.loadIeltsContent()
let questions=0,images=0;const started=performance.now()
for(const module of ['listening','reading','writing','speaking'])for(const index of bank[module]){
 const task=await service.getIeltsTask(module,index.id)
 assert.equal(task.id,index.id);questions+=task.questions.length;images+=task.questionImages.length+task.passageImages.length+task.images.length
 if(module==='reading'||module==='listening')assert.equal(task.questions.length,40)
 assert.ok(!task.questions.some(q=>q.options.length),'unverified OCR choices must not masquerade as a complete option list')
}
assert.equal(calls,0,'all bundled approved task metadata is available without the remote data round trip')
const {unpackTask}=r.load('utils/nativeDataPack')
assert.throws(()=>unpackTask({schemaVersion:'stemist-native-task-pack-v2',names:[],values:[['r',0]],tasks:{x:['r',0]}},'x'))
console.log(JSON.stringify({status:'pass',tasks:Object.values(bank).flat().length,questions,imageReferences:images,networkRequests:0,decodeMs:Math.round(performance.now()-started)}))
