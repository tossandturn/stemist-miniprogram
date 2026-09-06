import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const fixture={id:'cam15-r-test1',module:'reading',title:'Cambridge IELTS 15 Reading',minutes:60,questions:Array.from({length:40},(_,i)=>({id:'q'+(i+1),text:'Question '+(i+1),answer:'must-not-render',questionPage:18+Math.floor(i/10)})),readingPageImages:[{page:18,url:'/generated/reading-pages/cam15/test1/page-18.webp',layoutLines:Array(100).fill({text:'heavy'})}]}
let requests=0
const runtime=miniRuntime({modules:{
 'utils/api':{
  IELTS_API_BASE:'https://ieltsist.com',
  requestIeltsJson:async()=>{requests++;return{listeningTests:[],readingTests:[fixture],writingTasks:[],speakingSets:[]}}
 },
 'utils/ieltsLearning':{
  requestIeltsLearning:async(path,payload)=>path.includes('/attempts')
   ? {attemptId:'objective_test_id',attemptToken:'test-capability',taskId:fixture.id}
   : {result:{answerAvailable:true,correct:1,scoredTotal:40,band:2.5,details:[{id:'q1',actual:payload.answers.q1,correct:true}]}}
 }
}})
const content=runtime.load('utils/ieltsContent')
await Promise.all([content.loadIeltsContent({refresh:true}),content.loadIeltsContent({refresh:true})]);assert.equal(requests,1)
const task=await content.getIeltsTask('reading',fixture.id);assert.doesNotMatch(JSON.stringify(task),/must-not-render|layoutLines/)
assert.equal(content.assetUrl('https://evil.example/steal'),'')
const p=runtime.page('pages/ielts/reading');p.onLoad({taskId:fixture.id});await settle()
assert.equal(p.data.total,40);assert.equal(p.data.questions.length,1);assert.equal(p.data.sourceImages.length,1)
assert.ok(JSON.stringify(p.data).length<10000)
p.inputAnswer({detail:{value:'original answer'}});p.nextQuestion();p.previousQuestion();assert.equal(p.data.answer,'original answer')
await p.submit();assert.equal(p.data.submitted,true);assert.equal(p.data.result.correct,1)
p.onUnload();const restored=runtime.page('pages/ielts/reading');restored.onLoad({taskId:fixture.id});await settle();assert.equal(restored.data.answer,'original answer');assert.equal(restored.data.submitted,true);restored.onUnload()
const guest=miniRuntime();const navigation=guest.page('pages/ielts/listening');navigation.onLoad();assert.match(guest.calls[0].url,/pages\/ielts\/library\?module=listening/)
console.log('Native IELTS content, bounded question rendering, answers, submission, restore and catalog navigation passed.')
