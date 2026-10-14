import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const requests=[]
let proofOwner='ielts:42',proofEpoch=0
const fixture={id:'cam15-r-test1',title:'Reading',questions:Array.from({length:40},(_,i)=>({id:'q'+(i+1),text:'Q'+(i+1)})),nativeSections:[{number:1,questionIds:Array.from({length:14},(_,i)=>'q'+(i+1)),topicKey:'science',topicLabel:'Science'}]}
const r=miniRuntime({modules:{'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async path=>{
 requests.push(path)
 return{schemaVersion:'native-ielts-catalog-v1',readingTests:[{id:fixture.id,title:'Reading',questionCount:40,questions:[{id:'must-not-leak',text:'private'}],readingPageImages:[{url:'/generated/reading-pages/cam15/test1/page-1.webp'}],prompt:'private prompt',sections:[{number:1,questionCount:14,questionIds:['must-not-leak'],topicKey:'science'}]}],listeningTests:[],writingTasks:[],speakingSets:[]}
}},'utils/ieltsLearning':{requestIeltsLearning:async path=>{requests.push(path);return{schemaVersion:'native-ielts-task-v1',task:fixture}}},'utils/membershipProof':{ensureMembershipAccess:async()=>({owner:proofOwner,epoch:proofEpoch,enforcementEnabled:true,active:true}),sameScope:(_wx,expected)=>expected.owner===proofOwner&&expected.epoch===proofEpoch}}})
const service=r.load('utils/ieltsContent')
const bank=await service.loadIeltsContent({refresh:true})
assert.equal(requests.length,1)
assert.equal(bank.reading[0].questions.length,0)
assert.equal(bank.reading[0].images.length,0)
assert.equal(bank.reading[0].prompt,'')
assert.equal(bank.reading[0].sections[0].questionIds.length,0,'the public catalog remains metadata-only even if a server mistakenly adds task detail fields')
assert.equal(service.catalogPage(bank.reading).items[0].questionCount,40)
const [a,b]=await Promise.all([service.getIeltsTask('reading',fixture.id),service.getIeltsTask('reading',fixture.id)])
assert.equal(requests.length,2,'one detail request shared by concurrent consumers')
assert.equal(a.questions.length,40);assert.equal(b.sections[0].questionIds.length,14)
assert.equal((await service.loadIeltsContent()).reading[0].questions.length,0,'detail objects must not grow the shared index')
proofOwner='ielts:99';proofEpoch=1;await service.getIeltsTask('reading',fixture.id);assert.equal(requests.length,3,'private task detail cache is owner/privacy-epoch scoped')
await assert.rejects(()=>service.getIeltsTask('reading','missing'))
{
 let privateCalls=0
 const unavailable=miniRuntime({modules:{'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async()=>{throw Object.assign(Error('missing catalog'),{statusCode:404})}},'utils/ieltsLearning':{requestIeltsLearning:async()=>{privateCalls++;return{}}},'utils/membershipProof':{ensureMembershipAccess:async()=>({owner:'guest',epoch:0,enforcementEnabled:false,active:false}),sameScope:()=>true}}})
 await assert.rejects(unavailable.load('utils/ieltsContent').loadIeltsContent({refresh:true}),/missing catalog/)
 assert.equal(privateCalls,0,'an unavailable public catalog never falls back to downloading full private /api/tasks anonymously')
}
{
 const unsafe=miniRuntime({modules:{'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async()=>({schemaVersion:'legacy-full-tasks',readingTests:[fixture],listeningTests:[],writingTasks:[],speakingSets:[]})}}})
 await assert.rejects(unsafe.load('utils/ieltsContent').loadIeltsContent({refresh:true}),/题库返回不完整/,'a public catalog cannot be treated as a full task response')
}
{
 const paths=[],catalog={schemaVersion:'native-ielts-catalog-v1',version:'v2',baseVersion:'none',readingTests:[{id:fixture.id,title:'Reading',questionCount:40}],listeningTests:[],writingTasks:[],speakingSets:[]}
 const fallback=miniRuntime({modules:{'utils/ieltsBootstrap':{catalog},'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async()=>catalog},'utils/ieltsLearning':{requestIeltsLearning:async path=>{paths.push(path);if(path.startsWith('/api/native/ielts/tasks/'))throw Object.assign(Error('not deployed'),{statusCode:404});return{readingTests:[fixture]}}},'utils/membershipProof':{ensureMembershipAccess:async()=>({owner:'ielts:42',epoch:0,enforcementEnabled:true,active:true}),sameScope:()=>true}}})
 assert.equal((await fallback.load('utils/ieltsContent').getIeltsTask('reading',fixture.id)).questions.length,40)
 assert.deepEqual(paths,['/api/native/ielts/tasks/reading/'+fixture.id,'/api/tasks'],'task-detail compatibility fallback remains on the authenticated IELTS native-session transport')
}
console.log('Native data loading: lightweight index, lazy/coalesced detail and independent bounded cache passed.')
