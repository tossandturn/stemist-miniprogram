import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
import {directFixture} from './test-speaking-direct.mjs'
function setup(){
 const timers=new Map(),errors=[],states=[],sent=[];let id=0,ready=0
 const recorder={onStart(fn){this.started=fn},onFrameRecorded(fn){this.frame=fn},onStop(fn){this.stopped=fn},onError(fn){this.error=fn},onInterruptionBegin(fn){this.interrupted=fn},start(){},stop(){},offStart(){},offFrameRecorded(){},offStop(){},offError(){},offInterruptionBegin(){}}
 const socket={onOpen(fn){this.open=fn},onMessage(){},onError(){},onClose(){},send({data}){sent.push(JSON.parse(data))},close(){}}
 const audio={currentTime:1,resume(){},close(){}}
 const r=miniRuntime({globals:{setTimeout:(fn,ms)=>{const key=++id;timers.set(key,{fn,ms});return key},clearTimeout:key=>timers.delete(key)},modules:{'utils/speakingDirect':{issueDirectSession:async()=>directFixture()}},wx:{authorize:o=>o.success(),getRecorderManager:()=>recorder,createWebAudioContext:()=>audio,connectSocket:()=>socket}})
 const engine=new (r.load('utils/nativeSpeaking').NativeSpeaking)({onReady:()=>ready++,onError:e=>errors.push(e.message||e),onState:s=>states.push(s)})
 return {engine,recorder,socket,audio,timers,errors,states,sent,get ready(){return ready}}
}
const a=setup();await a.engine.start();a.socket.open();a.engine.message({type:'session.updated'})
assert.equal(a.ready,0,'a WSS acknowledgement is not proof that the microphone started')
assert.equal(a.engine.waiting,true,'candidate audio remains gated until recorder and persistence are ready')
a.recorder.started();assert.equal(a.ready,1);a.recorder.started();assert.equal(a.ready,1,'duplicate recorder callback does not repeat opening')
assert.equal(a.sent.filter(x=>x.type==='response.create').length,1)
const microphoneTimer=[...a.timers.values()].find(x=>x.ms===8000);assert.ok(microphoneTimer);microphoneTimer.fn();assert.match(a.errors[0],/麦克风.*数据/);assert.equal(a.engine.closed,true)
const b=setup();await b.engine.start();b.socket.open();b.engine.message({type:'session.updated'});b.recorder.started();b.recorder.frame({frameBuffer:new ArrayBuffer(2048)})
const openingTimer=[...b.timers.values()].find(x=>x.ms===30000);assert.ok(openingTimer);openingTimer.fn();assert.match(b.errors[0],/考官.*回应/)
const c=setup();await c.engine.start();c.socket.open();c.engine.message({type:'session.updated'});c.recorder.started();c.engine.message({type:'response.done',response:{status:'failed'}});assert.equal(c.engine.closed,true);assert.match(c.errors[0],/考官/)
const d=setup();d.audio.resume=()=>new Promise(()=>{});const starting=d.engine.start();await settle();const timer=[...d.timers.values()].find(x=>x.ms===5000);assert.ok(timer);timer.fn();await assert.rejects(starting,/播放/);d.engine.close()
const e=setup();await e.engine.start();e.socket.open();e.engine.message({type:'session.updated'});e.recorder.started();e.recorder.interrupted();assert.equal(e.engine.closed,true);assert.match(e.errors[0],/录音.*中断/)
const f=setup();f.audio.resume=()=>new Promise(()=>{});const cancelling=f.engine.start();await settle();f.engine.close();await assert.rejects(cancelling,/取消/);assert.equal(f.timers.size,0)
const h=setup();await h.engine.start();h.socket.open();h.engine.message({type:'session.updated'});h.recorder.frame({frameBuffer:new ArrayBuffer(2048)});assert.equal(h.ready,1,'actual PCM also proves recording if onStart arrives late');h.engine.close();assert.equal(h.timers.size,0)
const g=setup();await g.engine.start();g.engine.sources.add({stop(){},disconnect(){}});g.engine.watchPlayback();let watch=g.engine.playbackTimer;g.timers.get(watch).fn();g.timers.delete(watch);assert.equal(g.engine.playbackRetried,true);watch=g.engine.playbackTimer;g.timers.get(watch).fn();g.timers.delete(watch);assert.equal(g.engine.closed,true);assert.match(g.errors[0],/播放/);assert.equal(g.timers.size,0)
for(const item of [a,b,c,d,e]){item.engine.close();assert.equal(item.timers.size,0)}
console.log('Speaking startup: real recorder acknowledgement, missing PCM, opening timeout, failed response, suspended audio startup and interruption cleanup passed.')
