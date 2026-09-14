import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
import {directFixture} from './test-speaking-direct.mjs'
let now=300000,id=0;const timers=new Map(),sent=[],states=[]
const r=miniRuntime({globals:{Date:{now:()=>now},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)},wx:{arrayBufferToBase64:b=>Buffer.from(b).toString('base64')}})
const Engine=r.load('utils/nativeSpeaking').NativeSpeaking,engine=new Engine({startedAt:0,onState:s=>states.push(s)})
engine.ready=true;engine.audio={currentTime:100,close(){}};engine.recorder={stop(){}};engine.socket={send:({data})=>sent.push(JSON.parse(data)),close(){}}
const fixture=directFixture();fixture.examinerPolicy={schemaVersion:'ielts-native-examiner-v2',part1Seconds:300,part2PreparationSeconds:60,part2AnswerSeconds:120};fixture.responses.part2Cue={type:'response.create',response:{instructions:'one complete cue card',modalities:['text','audio']}};engine.direct=fixture
engine.send({type:'response.create',intent:'next-question',inputQuality:'complete'});assert.equal(engine.stageState.phase,'part2-cue');assert.match(sent.at(-1).response.instructions,/one complete cue card/)
engine.message({type:'response.done'});timers.get(engine.responseTimer).fn();assert.equal(engine.stageState.phase,'part2-prep');assert.equal(engine.stageState.deadline,360)
const count=sent.length;now=359000;engine.frame(new Int16Array(1024).fill(2000).buffer);assert.equal(sent.length,count,'preparation must not send speech or trigger an examiner response')
now=360000;engine.audio.currentTime=200
for(let i=0;i<10;i++){now+=64;engine.frame(new Int16Array(1024).fill(1000).buffer)}
assert.equal(engine.stageState.phase,'part2-long-turn')
now+=10000;engine.frame(new ArrayBuffer(2048));assert.equal(sent.filter(x=>x.type==='input_audio_buffer.commit').length,0,'thinking pause must not interrupt the Part 2 long turn')
now=480000;engine.frame(new ArrayBuffer(2048));assert.equal(sent.filter(x=>x.type==='input_audio_buffer.commit').length,1);assert.equal(engine.stageState.phase,'part2-rounding')
engine.message({type:'conversation.item.input_audio_transcription.completed',item_id:'long',transcript:'My full long answer.'});assert.equal(engine.stageState.phase,'part2-rounding');assert.equal(engine.stageState.rounded,true)
engine.message({type:'response.done'});engine.pendingTranscript=true;engine.message({type:'conversation.item.input_audio_transcription.completed',item_id:'rounding',transcript:'Yes, I would.'});assert.equal(engine.stageState.phase,'part3');assert.match(sent.at(-1).response.instructions,/"phase":"part3"/)
engine.close();assert.equal(timers.size,0)
const saved={phase:'part2-prep',deadline:400};const resumed=new Engine({examinerState:saved,startedAt:0});assert.equal(resumed.stageState.deadline,400);resumed.stageState.deadline=401;assert.equal(saved.deadline,400);resumed.close()
now=100000
const remaining=new Engine({startedAt:0,examinerState:{phase:'part2-long-turn',deadline:130}})
remaining.ready=true;remaining.direct=fixture;remaining.activate()
assert.equal(remaining.stageState.deadline,130,'reconnecting with 30 seconds remaining must not grant a fresh 120 seconds')
now=129000;assert.equal(remaining.stageTick(),false);assert.equal(remaining.closed,false)
now=130000;remaining.stageTick();assert.equal(remaining.closed,true,'an expired resumed answer with no valid audio must stop, not extend the deadline')
assert.equal(remaining.stageState.phase,'part2-cue','explicit retry after an empty long turn must not be trapped behind an expired deadline')
const retried=new Engine({startedAt:0,examinerState:remaining.stageState,turns:[{role:'assistant',text:'The previous cue card.'}]});retried.ready=true;retried.direct=fixture;retried.socket={send:({data})=>sent.push(JSON.parse(data)),close(){}};retried.activate();assert.match(sent.at(-1).response.instructions,/one complete cue card/);retried.close()
console.log('Speaking stages: capability-gated Part 1, complete cue/preparation, 120-second long turn, no silence interruption, one rounding and Part 3 continuation passed.')
