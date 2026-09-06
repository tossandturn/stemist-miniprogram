import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const requests=[]
const r=miniRuntime({modules:{'utils/ieltsLearning':{requestIeltsLearning:async(path,payload)=>{requests.push(payload);return {jobId:'writing-pair-job-fixture'}}}}})
const service=r.load('utils/ieltsWriting')
const pairs=service.writingPairs([{id:'cam15-w-test1-task1'},{id:'cam15-w-test1-task2'},{id:'cam15-w-test2-task1'}])
assert.equal(pairs.length,1);assert.equal(pairs[0].items[1],'cam15-w-test1-task2')
await assert.rejects(()=>service.startWritingPairFeedback([{prompt:'x',essay:'x'}]))
await service.startWritingPairFeedback(pairs[0].items.map(id=>({id,prompt:'A source prompt',essay:'A student essay'})))
assert.equal(requests[0].items[0].taskNumber,1);assert.equal(requests[0].items[1].taskNumber,2)
const analysis={overall:7,criteria:['TA/TR','CC','LR','GRA'].map(label=>({label,score:7})),taskScores:[{taskNumber:1,overall:6},{taskNumber:2,overall:7.5}]}
assert.equal(service.normalizeWritingResult({mode:'ai:pair',analysis,contract:{review:{required:true}}}).band,null)
assert.equal(service.normalizeWritingResult({mode:'ai:pair',analysis,contract:{review:{required:false}}}).band,7)
console.log('Native Writing pairs: same-test grouping, two required essays, task weighting request and limited-evidence suppression passed.')
