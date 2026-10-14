import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const r=miniRuntime(),service=r.load('utils/ieltsContent'),bank=await service.loadIeltsContent(),pack=r.load('utils/ieltsTaskBootstrap'),{unpackTask}=r.load('utils/nativeDataPack')
let questions=0,images=0;const started=performance.now()
for(const module of ['listening','reading','speaking'])for(const index of bank[module]){
 const task=service.normalizeTask(unpackTask(pack,index.id),module)
 assert.equal(task.id,index.id);questions+=task.questions.length;images+=task.questionImages.length+task.passageImages.length+task.images.length
 if(module==='reading'||module==='listening')assert.equal(task.questions.length,40)
 assert.ok(!task.questions.some(q=>q.options.length),'unverified OCR choices must not masquerade as a complete option list')
}
if(bank.writing.every(index=>index.sourceMetadataComplete)){
 for(const index of bank.writing){const task=service.normalizeTask(unpackTask(pack,index.id),'writing');assert.equal(task.id,index.id);images+=task.images.length}
}else{
 assert.equal(bank.writing[0].sourceAvailability,'pending-review')
 assert.ok(unpackTask(pack,bank.writing[0].id),'the source-only pack remains reproducibly decodable for backend generation')
}
assert.throws(()=>unpackTask({schemaVersion:'stemist-native-task-pack-v2',names:[],values:[['r',0]],tasks:{x:['r',0]}},'x'))
console.log(JSON.stringify({status:'pass',tasks:Object.values(bank).flat().length,questions,imageReferences:images,networkRequests:0,decodeMs:Math.round(performance.now()-started)}))
