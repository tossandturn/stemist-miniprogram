import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
import {directFixture} from './test-speaking-direct.mjs'
const timers=new Map(),sockets=[],requests=[],states=[];let timerId=0
const recorder={onFrameRecorded(){},onStop(){},onError(){},start(){},stop(){},offFrameRecorded(){},offStop(){},offError(){}}
const audio={currentTime:10,resume(){},close(){}}
const r=miniRuntime({globals:{setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)},modules:{'utils/speakingDirect':{issueDirectSession:async context=>{requests.push(context);return directFixture()}}},wx:{getRecorderManager:()=>recorder,createWebAudioContext:()=>audio,authorize:opts=>opts.success(),connectSocket:options=>{
 const socket={options,sent:[],onOpen(fn){this.open=fn},onMessage(fn){this.message=fn},onClose(fn){this.closeEvent=fn},onError(fn){this.error=fn},send({data}){this.sent.push(JSON.parse(data))},close(){this.closed=true}}
 sockets.push(socket);return socket
}}})
const Engine=r.load('utils/nativeSpeaking').NativeSpeaking,engine=new Engine({task:{id:'topic-a'},turns:[{role:'user',text:'saved answer',at:1}],startedAt:Date.now()-1000,onState:state=>states.push(state)})
await engine.start();sockets[0].open();engine.message({type:'session.updated'})
assert.equal(engine.ready,true);assert.ok(!JSON.stringify(engine.direct).includes('st-only'))
let stopped=0;engine.sources.add({stop(){stopped++},disconnect(){}});engine.playUntil=20
sockets[0].error({errMsg:'connection interrupted'})
assert.equal(stopped,1);assert.equal(engine.playUntil,10)
const recovery=[...timers.values()].find(t=>t.ms===1500);assert.ok(recovery);recovery.fn();await settle()
assert.equal(requests.length,2);assert.equal(requests[1].recovery,true);assert.equal(requests[1].taskId,'topic-a');assert.equal(requests[1].completedDialogue[0].text,'saved answer')
assert.match(sockets[1].options.url,/cn-beijing/);assert.equal(sockets[1].options.header.Authorization,'Bearer st-only-a-test-fixture')
sockets[0].open();assert.equal(sockets[0].sent.length,2,'Stale socket cannot send another session.update')
sockets[1].open();engine.message({type:'session.updated'});assert.equal(engine.turns[0].text,'saved answer')
engine.close();assert.equal(timers.size,0);assert.equal(r.storage.size,0)
const changed=new Engine();await changed.start();const last=sockets.at(-1);r.storage.set('stemistUser',{id:'another-user'});last.open();assert.equal(last.sent.length,0);assert.equal(changed.closed,true)
console.log('Direct speech lifecycle: fresh token on reconnect, old socket suppression, retained dialogue, audio cleanup, no stored credential and account-switch cancellation passed.')
