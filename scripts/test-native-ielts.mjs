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

{
 const players=[]
 const listeningTask={
  id:'cam15-l-test1',module:'listening',title:'Cambridge IELTS 15 Listening',minutes:40,
  questions:[{id:'q1',number:1,text:'Question 1',page:1,type:'text',options:[]}],
  questionImages:[{id:'1',page:1,url:'https://ieltsist.com/generated/listening/page-1.webp'}],passageImages:[],images:[],
  audioUrls:['https://ieltsist.com/cambridge15/audio/test1-section1.mp3','https://ieltsist.com/cambridge15/audio/test1-section2.mp3'],
  audioSections:[{section:1,url:'https://ieltsist.com/cambridge15/audio/test1-section1.mp3'},{section:2,url:'https://ieltsist.com/cambridge15/audio/test1-section2.mp3'}],sections:[],
 }
 const audioRuntime=miniRuntime({
  wx:{createInnerAudioContext(){
   const callbacks={}
   const player={callbacks,currentTime:0,duration:0,playCalls:0,pauseCalls:0,stopCalls:0,destroyCalls:0,seekCalls:[],srcValue:'',startTimeAtSrc:null,
    onPlay(fn){callbacks.play=fn},onPause(fn){callbacks.pause=fn},onEnded(fn){callbacks.ended=fn},onTimeUpdate(fn){callbacks.time=fn},onError(fn){callbacks.error=fn},
    play(){this.playCalls++;callbacks.play?.()},pause(){this.pauseCalls++;callbacks.pause?.()},stop(){this.stopCalls++},seek(time){this.seekCalls.push(time)},destroy(){this.destroyCalls++}}
   Object.defineProperty(player,'src',{get(){return this.srcValue},set(value){this.srcValue=value;this.startTimeAtSrc=this.startTime}})
   players.push(player);return player
  }},
  modules:{'utils/ieltsContent':{getIeltsTask:async()=>listeningTask}},
 })
 const listening=audioRuntime.page('pages/ielts/listening');listening.onLoad({taskId:listeningTask.id});await settle()
 assert.equal(players.length,0,'opening a Listening task must leave audio idle until the student interacts with the player')
 listening.selectAudio({detail:{value:'0'}});assert.equal(players.length,0,'selecting the current track must remain a no-op')
 listening.seekAudio({detail:{value:17.8}});assert.equal(players.length,1);assert.equal(players[0].startTimeAtSrc,17.8,'a first seek must set startTime before src instead of seeking an unready player');assert.equal(players[0].seekCalls.length,0);assert.equal(listening.data.audioPosition,17)
 listening.toggleAudio();assert.equal(players[0].playCalls,1);assert.equal(listening.data.audioPlaying,true);assert.equal(players[0].srcValue,listeningTask.audioUrls[0])
 listening.selectAudio({detail:{value:'1'}});assert.equal(players[0].stopCalls,1);assert.equal(players[0].destroyCalls,1);assert.equal(players.length,1);assert.equal(listening.data.audioIndex,1);assert.equal(listening.data.audioPlaying,false)
 players[0].callbacks.play();players[0].currentTime=99;players[0].duration=100;players[0].callbacks.time();assert.equal(listening.data.audioPlaying,false);assert.equal(listening.data.audioPosition,0,'callbacks from a retired track must not update the selected track')
 listening.toggleAudio();assert.equal(players.length,2);assert.equal(players[1].srcValue,listeningTask.audioUrls[1]);assert.equal(players[1].startTimeAtSrc,0);assert.equal(players[1].playCalls,1)
 listening.onHide();assert.equal(players[1].pauseCalls,1);assert.equal(listening.data.audioPlaying,false)
 listening.onUnload();assert.equal(players[1].destroyCalls,1);players[1].callbacks.play();assert.equal(listening.data.audioPlaying,false,'callbacks after unload must stay inert')
}
console.log('Native IELTS content, bounded question rendering, lazy streaming audio lifecycle, answers, submission, restore and catalog navigation passed.')
