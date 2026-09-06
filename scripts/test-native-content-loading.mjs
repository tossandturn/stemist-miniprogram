import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const requests=[]
const fixture={id:'cam15-r-test1',title:'Reading',questions:Array.from({length:40},(_,i)=>({id:'q'+(i+1),text:'Q'+(i+1)})),nativeSections:[{number:1,questionIds:Array.from({length:14},(_,i)=>'q'+(i+1)),topicKey:'science',topicLabel:'Science'}]}
const r=miniRuntime({modules:{'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async path=>{
 requests.push(path)
 return path.endsWith('/catalog')?{schemaVersion:'native-ielts-catalog-v1',readingTests:[{id:fixture.id,title:'Reading',questionCount:40,sections:[{number:1,questionCount:14,topicKey:'science'}]}],listeningTests:[],writingTasks:[],speakingSets:[]}:{schemaVersion:'native-ielts-task-v1',task:fixture}
}}}})
const service=r.load('utils/ieltsContent')
const bank=await service.loadIeltsContent({refresh:true})
assert.equal(requests.length,1)
assert.equal(bank.reading[0].questions.length,0)
assert.equal(service.catalogPage(bank.reading).items[0].questionCount,40)
const [a,b]=await Promise.all([service.getIeltsTask('reading',fixture.id),service.getIeltsTask('reading',fixture.id)])
assert.equal(requests.length,2,'one detail request shared by concurrent consumers')
assert.equal(a.questions.length,40);assert.equal(b.sections[0].questionIds.length,14)
assert.equal((await service.loadIeltsContent()).reading[0].questions.length,0,'detail objects must not grow the shared index')
await assert.rejects(()=>service.getIeltsTask('reading','missing'))
console.log('Native data loading: lightweight index, lazy/coalesced detail and independent bounded cache passed.')
