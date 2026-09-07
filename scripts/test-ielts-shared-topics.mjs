import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const task1={id:'cam15-w-test1-task1',module:'writing',type:'Task 1',title:'Chart',source:'Cambridge',book:15,test:1}
const task2={...task1,id:'cam15-w-test1-task2',type:'Task 2',title:'Essay'}
const speaking={id:'cam15-s-test1',module:'speaking',source:'Cambridge',book:15,test:1,title:'Speaking'}
const base={schemaVersion:'native-ielts-catalog-v1',version:'base-v1',listeningTests:[{id:'cam15-l-test1',book:15,test:1}],readingTests:[{id:'cam15-r-test1',book:15,test:1}],writingTasks:[task1,task2],speakingSets:[speaking]}
const publicWriting={id:'public-writing-environment-task2',module:'writing',type:'Task 2',source:'Public topics',sourceKind:'public-topic',title:'Environment',topicKey:'writing-environment-climate',topicLabel:'Environment',topicIcon:'environment',topicEmoji:'🌿',prompt:'An existing public writing prompt.'}
const publicSpeaking={id:'public-speaking-friends',module:'speaking',source:'Public topics',sourceKind:'public-topic',title:'Friends',topicKey:'speaking-friends',topicLabel:'Friends',topicIcon:'society',topicEmoji:'👥',part1:['A question'],part2:'A cue card',part3:['A follow-up']}
let requests=0,decoded=0,version='catalog-v2',incomplete=false
const r=miniRuntime({modules:{
 'utils/ieltsBootstrap':{catalog:base},'utils/ieltsTaskBootstrap':{version:'base-v1'},
 'utils/nativeDataPack':{unpackTask:(_pack,id)=>{decoded++;return id===task1.id?{...task1,prompt:'Original Cambridge prompt'}:null}},
 'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async path=>{requests++;if(path.endsWith('/catalog'))return {...base,version,baseVersion:'base-v1',writingTasks:incomplete?undefined:[{...task1,topicKey:'writing-charts-data',topicLabel:'Charts & data',topicIcon:'business',topicEmoji:'📊'},task2,publicWriting],speakingSets:[speaking,publicSpeaking]};return {schemaVersion:'native-ielts-task-v1',task:publicSpeaking}}},
 'utils/ieltsLearning':{requestIeltsLearning:async()=>({examId:'fixture',examToken:'fixture-capability'})},
}})
const content=r.load('utils/ieltsContent'),page=r.page('pages/ielts/library');page.onLoad({module:'writing'});await settle();assert.equal(page.data.total,2)
await content.loadIeltsContent({refresh:true});assert.equal(page.data.total,3,'open page must receive the new canonical catalog without reopening')
page.chooseScope({currentTarget:{dataset:{scope:'topic'}}});assert.equal(page.__units.length,3,'Cambridge Task 1 and Task 2 both remain in Topics')
assert.ok(page.data.topics.some(t=>t.label==='Environment'&&t.emoji==='🌿'))
const publicIndex=page.data.books.findIndex(b=>b.value==='public');assert.ok(publicIndex>=0);page.chooseBook({detail:{value:publicIndex}});assert.equal(page.data.topics.length,1)
const known=await content.getIeltsTask('writing',task1.id);assert.equal(known.prompt,'Original Cambridge prompt');assert.equal(known.topicLabel,'Charts & data');assert.equal(decoded,1);assert.equal(requests,1,'metadata updates do not force all Cambridge details to download again')
const topic=await content.getIeltsTask('speaking',publicSpeaking.id);assert.equal(topic.part2,publicSpeaking.part2);assert.equal(topic.topicEmoji,'👥');assert.equal(requests,2)
const exam=await r.load('utils/nativeExam').newExam('random');assert.ok(exam.sources.writing.every(id=>id.startsWith('cam')));assert.ok(exam.sources.speaking.startsWith('cam'),'public topics stay separate from Cambridge mock exams')
page.onUnload();const frozen=JSON.stringify(page.data);version='catalog-v3';await content.loadIeltsContent({refresh:true});assert.equal(JSON.stringify(page.data),frozen)
incomplete=true;await assert.rejects(content.loadIeltsContent({refresh:true}),/不完整/);assert.equal((await content.loadIeltsContent()).writing.length,3,'an incomplete server payload cannot erase the known writing catalog')
console.log('IELTS shared data: live source updates, public topic/icons, Task 1+2 topics, public filter, lazy detail, preserved Cambridge bundle and exam-source separation passed.')
