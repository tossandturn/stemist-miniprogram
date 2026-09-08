import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let calls=0
const r=miniRuntime({modules:{'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async()=>{calls++;throw new Error('offline')}}}})
const service=r.load('utils/ieltsContent'),bank=await service.loadIeltsContent()
let questions=0,images=0;const started=performance.now()
for(const module of ['listening','reading','speaking'])for(const index of bank[module]){
 const task=await service.getIeltsTask(module,index.id)
 assert.equal(task.id,index.id);questions+=task.questions.length;images+=task.questionImages.length+task.passageImages.length+task.images.length
 if(module==='reading'||module==='listening')assert.equal(task.questions.length,40)
 assert.ok(!task.questions.some(q=>q.options.length),'unverified OCR choices must not masquerade as a complete option list')
}
if(bank.writing.every(index=>index.sourceMetadataComplete)){
 for(const index of bank.writing){const task=await service.getIeltsTask('writing',index.id);assert.equal(task.id,index.id);images+=task.images.length}
 assert.equal(calls,0,'a revision-complete Writing catalog and matching bundle remain available offline')
}else{
 assert.equal(bank.writing[0].sourceAvailability,'pending-review')
 await assert.rejects(()=>service.getIeltsTask('writing',bank.writing[0].id),/offline/)
 assert.equal(calls,1,'legacy Writing bundles must refresh source metadata instead of bypassing the gate')
}
const {unpackTask}=r.load('utils/nativeDataPack')
assert.throws(()=>unpackTask({schemaVersion:'stemist-native-task-pack-v2',names:[],values:[['r',0]],tasks:{x:['r',0]}},'x'))
console.log(JSON.stringify({status:'pass',tasks:Object.values(bank).flat().length,questions,imageReferences:images,networkRequests:calls,decodeMs:Math.round(performance.now()-started)}))
