// Opt-in real Qwen transport/model QA using generated speech. No microphone,
// audio output, or student practice record is created. Credentials stay inside
// the existing authenticated Mini Program runtime and never enter this process.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const directory=process.argv[process.argv.indexOf('--audio')+1]
const noisy=process.argv.includes('--room-noise')
const longTurn=process.argv.includes('--long-turn')
if(!process.argv.includes('--run-production')||!directory)throw Error('Use --run-production --audio <synthetic wav directory>')
function pcm(file){const b=fs.readFileSync(file);assert.equal(b.toString('ascii',0,4),'RIFF');let offset=12;while(offset+8<=b.length){const size=b.readUInt32LE(offset+4);if(b.toString('ascii',offset,offset+4)==='data')return b.subarray(offset+8,offset+8+size).toString('base64');offset+=8+size+(size%2)}throw Error('Missing PCM')}
async function main(){
 const status=await call('automation_runtime_info',{action:'currentPage'})
 assert.equal(status.currentPage?.path,'pages/index/index','Return to Home before controlled QA')
 const clips=(noisy||longTurn?[0]:[0,1,2]).map(i=>pcm(path.join(directory,'answer-'+i+'.wav')))
 await evaluate('function(){if(getApp().__liveSpeechQa&&!getApp().__liveSpeechQa.finished)throw Error("Speech QA already running");getApp().__speechQaClips='+JSON.stringify(clips.map(()=>''))+';getApp().__speechQaNoisy='+noisy+';getApp().__speechQaLong='+longTurn+';return true}')
 const input=path.join(directory,'clip-chunk.json')
 for(let i=0;i<clips.length;i++)for(let offset=0;offset<clips[i].length;offset+=16384){
  fs.writeFileSync(input,JSON.stringify([i,clips[i].slice(offset,offset+16384)]))
  await call('automation_evaluate',{'args-file':input,'fn-source':function(index,chunk){getApp().__speechQaClips[index]+=chunk;return true}.toString()})
 }
 await evaluate(function(){
  const clips=getApp().__speechQaClips
  const app=getApp();if(app.__liveSpeechQa&&!app.__liveSpeechQa.finished)throw Error('Speech QA already running')
  const longTurn=app.__speechQaLong,qa={finished:false,results:[],trace:[],audioByAnswer:{},index:0,phase:'connecting',micUsed:false,studentRecordsWritten:false};app.__liveSpeechQa=qa
  const Engine=require('utils/nativeSpeaking.js').NativeSpeaking
  let engine,interval,timeout,micInterval,sending=false
  const roomNoise=app.__speechQaNoisy?Int16Array.from({length:1024},(_,i)=>Math.round(200*Math.SQRT2*Math.sin(2*Math.PI*125*i/16000))).buffer:new ArrayBuffer(2048)
  const done=phase=>{qa.phase=phase;qa.finished=true;clearInterval(interval);clearTimeout(timeout);engine.close();delete app.__speechQaClips;delete app.__speechQaNoisy;delete app.__speechQaLong}
  engine=new Engine({...(longTurn?{startedAt:Date.now()-360000,examinerState:{phase:'part2-long-turn',deadline:480}}:{}),turns:[{role:'assistant',text:longTurn?'Describe a job you would like to do with animals.':'Would you like to have a job working with animals in the future?',at:Date.now()}],onError:()=>done('connection-failed'),onTurn:turn=>qa.results.push({role:turn.role,text:turn.text}),onState:state=>{
   if(qa.finished||(state.status!=='请自然回答'&&!(longTurn&&state.examinerPhase==='part2-long-turn'))||sending)return
   qa.trace.push({state:state.status,index:qa.index,waiting:engine.waiting})
   if(qa.index>=clips.length)return done('complete')
   const bytes=wx.base64ToArrayBuffer(clips[qa.index++]);let offset=0;const started=Date.now();sending=true;qa.phase='audio-'+qa.index
   if(longTurn){engine.startedAt=started-360000;qa.longStarted=started}
   interval=setInterval(()=>{
    if(qa.finished)return
    if(offset<bytes.byteLength){engine.frame(bytes.slice(offset,Math.min(offset+2048,bytes.byteLength)));offset+=2048}
    else engine.frame(roomNoise)
    if(engine.waiting){clearInterval(interval);sending=false;qa.phase='waiting-'+qa.index}
    if(Date.now()-started>(longTurn?135000:30000))done('input-timeout')
   },64)
  }})
  const message=engine.message.bind(engine)
  const send=engine.send.bind(engine);engine.send=event=>{if(event.type==='audio.commit'&&longTurn)qa.commitSeconds=(Date.now()-qa.longStarted)/1000;return send(event)}
  engine.message=event=>{if(event.type==='response.audio.delta'&&qa.index>0)qa.audioByAnswer[qa.index]=true;if(!/delta$/.test(event.type))qa.trace.push({event:event.type,index:qa.index,waiting:engine.waiting,phase:qa.phase});return message(event)}
  engine.recorder={start(){clearInterval(micInterval);micInterval=setInterval(()=>{if(!sending)engine.frame(roomNoise)},64)},stop(){clearInterval(micInterval)}}
  engine.audio={get currentTime(){return Date.now()/1000},close(){}}
  engine.play=()=>{qa.audioReceived=true}
  timeout=setTimeout(()=>done('timeout'),longTurn?175000:140000)
  engine.connect().catch(()=>done('authorization-failed'))
  return {started:true,microphoneUsed:false,studentRecordsWritten:false}
 })
 const result=await until(function(){const q=getApp().__liveSpeechQa;return q?.finished?{phase:q.phase,results:q.results,trace:q.trace.slice(-45),audioAnswers:Object.keys(q.audioByAnswer).length,audioReceived:q.audioReceived,commitSeconds:q.commitSeconds,micUsed:q.micUsed,studentRecordsWritten:q.studentRecordsWritten}:null},'real synthetic speaking dialogue',longTurn?180000:150000)
 console.log(JSON.stringify(result))
 assert.equal(result.phase,'complete')
 assert.ok(result.audioReceived)
 assert.equal(result.audioAnswers,clips.length,'each candidate answer must receive audio, not only the opening')
 assert.equal(result.results.filter(t=>t.role==='user').length,clips.length)
 const firstUser=result.results.findIndex(t=>t.role==='user')
 assert.ok(result.results.slice(firstUser+1).some(t=>t.role==='assistant'))
 const answers=result.results.filter(t=>t.role==='assistant')
 assert.ok(answers.length>=clips.length)
 assert.doesNotMatch(answers.map(t=>t.text).join(' '),/thoughtful of you|interesting thought|sounds (?:lovely|interesting)|wonderful|great answer|next part/i)
 for(const turn of answers)assert.ok((turn.text.match(/\?/g)||[]).length<=1,'One examiner question at a time')
 if(longTurn)assert.ok(result.commitSeconds>=119&&result.commitSeconds<125,'real 120-second buffer must not commit at an ordinary pause')
 if(!noisy&&!longTurn)for(const turn of answers.slice(-2))assert.doesNotMatch(turn.text,/thank you|meant by|are you asking/i,'Unclear audio gets one neutral restatement, not a guessed interpretation')
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
