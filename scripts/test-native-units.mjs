import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const service=miniRuntime().load('utils/ieltsUnits')
const task={id:'cam15-r-test1',module:'reading',title:'Reading',questions:Array.from({length:40},(_,i)=>({id:'q'+(i+1),number:i+1,page:i<14?12:i<27?22:32})),sections:[{number:1,label:'Passage 1',questionIds:Array.from({length:14},(_,i)=>'q'+(i+1)),questionCount:14,topicKey:'science',topicLabel:'Science',title:'Source subject',minutes:20}],passageStarts:{1:10,2:20},questionImages:[{page:12},{page:22}],passageImages:[{page:10},{page:11},{page:20}],images:[],audioUrls:[],audioSections:[]}
const unit=service.sectionTask(task,1)
assert.equal(unit.questions.length,14);assert.equal(unit.questions.at(-1).id,'q14')
assert.deepEqual(unit.passageImages.map(i=>i.page),[10,11])
assert.throws(()=>service.sectionTask(task,2))
const topics=service.libraryUnits([task],'topic','science')
assert.equal(topics.length,1);assert.equal(topics[0].title,'Source subject');assert.equal(topics[0].baseTaskId,task.id)
assert.equal(service.libraryUnits([task],'topic','question-type').length,0)
console.log('Native units: exact source question IDs, all passage pages, semantic topics and missing-scope rejection passed.')
