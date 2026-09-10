import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
import {directFixture} from './test-speaking-direct.mjs'
const sent=[],turns=[],states=[]
let options,stopped=0,closed=0,ticketCalls=0,socketOptions
const recorder={onFrameRecorded(fn){this.frame=fn},onStop(fn){this.stopEvent=fn},onError(fn){this.error=fn},start(value){options=value},stop(){stopped++},offFrameRecorded(){},offStop(){},offError(){}}
const socket={onOpen(fn){this.open=fn},onMessage(fn){this.message=fn},onClose(fn){this.closeEvent=fn},onError(fn){this.error=fn},send({data}){sent.push(data)},close(){closed++}}
const audio={currentTime:0,resume(){},close(){},createBuffer(ch,length){return{getChannelData:()=>new Float32Array(length)}},createBufferSource(){return{connect(){},disconnect(){},start(){},stop(){}}}}
const r=miniRuntime({
 modules:{'utils/speakingDirect':{issueDirectSession:async()=>{ticketCalls++;return directFixture()}}},
 wx:{getRecorderManager:()=>recorder,createWebAudioContext:()=>audio,authorize:opts=>opts.success(),connectSocket:value=>{socketOptions=value;return socket},setKeepScreenOn(){},base64ToArrayBuffer:()=>new ArrayBuffer(100),arrayBufferToBase64:value=>Buffer.from(value).toString('base64')}
})
const {NativeSpeaking,pcmRms}=r.load('utils/nativeSpeaking')
const previousTurns=[{role:'user',text:'saved answer',at:1}],isolated=new NativeSpeaking({turns:previousTurns})
isolated.addTurn('assistant','next question');assert.equal(previousTurns.length,1,'engine must not mutate a saved snapshot before its page commits');isolated.close()
assert.equal(pcmRms(new Int16Array(100).buffer),0)
const engine=new NativeSpeaking({onTurn:turn=>turns.push(turn),onState:state=>states.push(state)})
await engine.start();assert.equal(ticketCalls,1);assert.match(socketOptions.url,/cn-beijing\.maas\.aliyuncs\.com/);assert.equal(socketOptions.header.Authorization,'Bearer st-only-a-test-fixture');assert.equal(socketOptions.header['X-STEMist-Realtime-Ticket'],undefined);socket.open();assert.equal(JSON.parse(sent[0]).type,'session.update');assert.ok(JSON.parse(sent[0]).session.instructions)
socket.message({data:JSON.stringify({type:'session.updated'})})
assert.match(sent.map(value=>typeof value==='string'?JSON.parse(value):null).find(event=>event?.type==='response.create')?.response.instructions,/opening/)
assert.equal(options.format,'PCM');assert.equal(options.sampleRate,16000);assert.equal(options.numberOfChannels,1)
engine.message({type:'event',eventType:'response.done',payload:{}})
audio.currentTime=1
const silence=new Int16Array(2048).buffer,voice=new Int16Array(2048).fill(1200).buffer
const before=sent.length;engine.frame(silence);assert.equal(sent.length,before)
engine.frame(voice);engine.frame(voice);engine.lastVoice=Date.now()-4100;engine.frame(silence);engine.frame(silence)
assert.equal(sent.filter(value=>typeof value==='string'&&JSON.parse(value).type==='input_audio_buffer.commit').length,1)
assert.ok(sent.some(value=>JSON.parse(value).type==='input_audio_buffer.append'&&JSON.parse(value).audio))
assert.equal(sent.filter(value=>typeof value==='string'&&/next examiner/.test(JSON.parse(value).response?.instructions||'')).length,0)
engine.message({type:'event',eventType:'conversation.item.input_audio_transcription.completed',payload:{transcript:'I enjoy studying physics.'}})
assert.equal(sent.filter(value=>typeof value==='string'&&/next examiner/.test(JSON.parse(value).response?.instructions||'')).length,1)
engine.message({type:'event',eventType:'response.created',payload:{}})
engine.message({type:'event',eventType:'response.text.delta',payload:{delta:'Hello'}})
engine.message({type:'event',eventType:'response.audio_transcript.delta',payload:{delta:'Hello'}})
engine.message({type:'event',eventType:'response.audio_transcript.done',payload:{transcript:'Hello'}})
engine.message({type:'event',eventType:'response.text.done',payload:{text:'Hello'}})
engine.message({type:'event',eventType:'response.done',payload:{}})
assert.equal(turns.filter(turn=>turn.role==='assistant').length,1)
const ending=engine.end();assert.ok(stopped>0)
assert.equal(sent.filter(value=>typeof value==='string'&&/assessment examiner/.test(JSON.parse(value).response?.instructions||'')).length,1)
engine.message({type:'event',eventType:'response.text.done',payload:{text:'Evidence-based examiner note'}})
engine.message({type:'event',eventType:'response.done',payload:{}})
assert.equal(await ending,'Evidence-based examiner note')
engine.close();assert.ok(closed>0)
const after=sent.length;engine.frame(voice);assert.equal(sent.length,after)
assert.equal(states.at(-1).active,false)
console.log('Native speaking: PCM capture, silence gate, one-turn commit, transcript dedupe, examiner note and cleanup passed; mocked transport only.')
await import('./test-speaking-ticket.mjs')
await import('./test-record-permission.mjs')
await import('./test-speaking-retention.mjs')
await import('./test-speaking-direct-lifecycle.mjs')
await import('./test-speaking-audio-turns.mjs')
