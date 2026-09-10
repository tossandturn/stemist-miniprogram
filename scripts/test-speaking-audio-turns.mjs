import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
import {directFixture} from './test-speaking-direct.mjs'

let now=100000
const timers=new Map();let id=0
const r=miniRuntime({globals:{Date:{now:()=>now},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)},wx:{arrayBufferToBase64:b=>Buffer.from(b).toString('base64')}})
const Engine=r.load('utils/nativeSpeaking').NativeSpeaking
const source=r.load('utils/nativeSpeaking').recorderSource
assert.equal(await source({getAvailableAudioSources:o=>o.success({audioSources:['auto','voice_communication']})}),'voice_communication')
assert.equal(await source({getAvailableAudioSources:o=>o.success({audioSources:['auto','buildInMic','headsetMic']})}),'auto','iPad keeps platform headset routing')
assert.equal(await source({getAvailableAudioSources:o=>o.fail()}),'auto')
const missing=source({getAvailableAudioSources(){}})
const sourceTimeout=[...timers.values()].find(t=>t.ms===500);sourceTimeout.fn();assert.equal(await missing,'auto')
const sent=[]
const engine=new Engine({startedAt:now})
engine.ready=true;engine.audio={currentTime:10};engine.socket={send:({data})=>sent.push(JSON.parse(data)),close(){}};engine.direct=directFixture()
const block=(amplitude)=>new Int16Array(1024).fill(amplitude).buffer
const frame=(amplitude,ms=64)=>{now+=ms;engine.frame(block(amplitude))}
const events=type=>sent.filter(x=>x.type===type)
frame(0);frame(50);assert.equal(sent.length,0,'idle room noise is never streamed')
frame(900);frame(900);frame(900);frame(900);frame(900)
frame(70);frame(0);frame(80)
const decoded=Buffer.concat(events('input_audio_buffer.append').map(e=>Buffer.from(e.audio,'base64')))
assert.ok(decoded.includes(Buffer.from(block(50))),'pre-roll preserves the beginning of quiet syllables')
assert.ok(decoded.includes(Buffer.from(block(70))),'inside an answer soft syllables are not amplitude-clipped')
frame(0,1900);assert.equal(events('input_audio_buffer.commit').length,0,'a thinking pause does not interrupt a short answer')
frame(900);frame(900);frame(900);frame(900)
frame(0,2900);assert.equal(events('input_audio_buffer.commit').length,1)
assert.equal(events('response.create').length,0,'wait for the transcription before asking the examiner to respond')
engine.message({type:'conversation.item.input_audio_transcription.completed',item_id:'answer-1',transcript:'I would like to work with animals because I enjoy helping them.'})
assert.equal(events('response.create').length,1)
engine.message({type:'conversation.item.input_audio_transcription.completed',item_id:'answer-1',transcript:'I would like to work with animals because I enjoy helping them.'})
assert.equal(events('response.create').length,1,'duplicate ASR does not trigger a second examiner')
engine.message({type:'response.done'})
const before=sent.length
frame(900);assert.equal(sent.length,before,'speaker tail is not captured immediately after output')
engine.audio.currentTime+=0.5
for(let i=0;i<5;i++)frame(900)
frame(0,4100)
engine.message({type:'conversation.item.input_audio_transcription.completed',item_id:'answer-2',transcript:'Future.'})
assert.match(events('response.create').at(-1).response.instructions,/fragment|clarif/i,'single-word fragment asks for meaning rather than praise/advancement')
engine.message({type:'response.done'});engine.audio.currentTime+=0.5
for(let i=0;i<5;i++)frame(900)
frame(0,4100)
const fallback=[...timers.values()].find(t=>t.ms===3000)
assert.ok(fallback);fallback.fn()
const count=events('response.create').length
engine.message({type:'conversation.item.input_audio_transcription.completed',item_id:'answer-3',transcript:'No, I would not.'})
assert.equal(events('response.create').length,count,'late transcription after audio fallback must not create another response')
engine.message({type:'response.done'});engine.audio.currentTime+=.5
const beforeNoise=events('input_audio_buffer.commit').length
frame(900);frame(0,4100)
assert.equal(events('input_audio_buffer.commit').length,beforeNoise,'one click is not a student answer')
assert.equal(events('input_audio_buffer.clear').length,1,'discard the isolated click from the provider buffer')
for(let i=0;i<1000;i++)frame(0)
assert.ok(engine.preRollBytes<=8192,'idle pre-roll stays bounded over a long session')
engine.finishing=true;engine.play=()=>{throw Error('Feedback preparation must not restart audio playback')}
engine.message({type:'response.audio.delta',delta:'fixture'})
engine.close();assert.equal(timers.size,0)
const ending=new Engine({startedAt:now}),finalSent=[]
ending.ready=true;ending.audio={currentTime:10,close(){}};ending.direct=directFixture();ending.socket={send:({data})=>finalSent.push(JSON.parse(data)),close(){}}
for(let i=0;i<5;i++){now+=64;ending.frame(block(900))}
const result=ending.end()
assert.equal(finalSent.filter(e=>e.type==='input_audio_buffer.commit').length,1,'Finish commits the last spoken answer')
ending.message({type:'conversation.item.input_audio_transcription.completed',item_id:'last-answer',transcript:'My final answer is that animals need care.'})
assert.equal(ending.turns.at(-1).role,'user','Final ASR is retained before assessment starts')
assert.match(finalSent.at(-1).response.instructions,/assessment/,'Finish must not ask another question')
ending.message({type:'response.text.done',text:'Final evidence note'})
ending.message({type:'response.done'})
assert.equal(await result,'Final evidence note');ending.close();assert.equal(timers.size,0)
console.log('Speaking continuous PCM: quiet speech/pre-roll, hesitation, playback-tail exclusion, ASR ordering, short-fragment repair, bounded fallback and cleanup passed.')
