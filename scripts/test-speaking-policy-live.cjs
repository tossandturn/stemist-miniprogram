// Opt-in real production examiner responses. Synthetic text, no microphone or
// student records; auth and short-lived credentials remain inside the runtime.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {evaluate,until}=require('./helpers/wechat-cli.cjs'),account=require('./helpers/native-qa-account.cjs')
if(!process.argv.includes('--run-production'))throw Error('Explicit --run-production required')
async function main(){
 try{
  await account.begin()
  await evaluate(async function(){
   const app=getApp(),Engine=require('utils/nativeSpeaking.js').NativeSpeaking
   const task=await require('utils/ieltsContent.js').getIeltsTask('speaking','cam4-s-test1')
   const qa={ready:false,failed:false,turns:[],audioResponses:0};app.__policyQa=qa
   const engine=new Engine({task,turns:[{role:'assistant',text:'Do you enjoy visiting historic places?'}],onTurn:t=>qa.turns.push({role:t.role,text:t.text}),onError:message=>{qa.failed=true;qa.error=message},onState:s=>{if(s.status==='请自然回答'||s.examinerPhase==='part2-prep')qa.ready=true}})
   let capture
   qa.engine=engine;engine.audio={get currentTime(){return Date.now()/1000},close(){}};engine.recorder={start(){capture=setInterval(()=>engine.frame(new ArrayBuffer(2048)),64)},stop(){clearInterval(capture)}}
   const original=engine.message.bind(engine);engine.message=m=>{if(m.type==='response.created')qa.audioCurrent=false;if(m.type==='response.audio.delta'&&!qa.audioCurrent){qa.audioCurrent=true;qa.audioResponses++}original(m)}
   engine.play=()=>{};engine.connect().catch(error=>{qa.failed=true;qa.error='authorization-failed: '+String(error.code||error.message||'unknown')})
   return {started:true,microphoneUsed:false}
  })
  const wait=label=>until(function(){const q=getApp().__policyQa;return q?.failed?{failed:true,error:q.error}:q?.ready?{ready:true,turns:q.turns,audioResponses:q.audioResponses,phase:q.engine.stageState.phase,policy:q.engine.direct?.examinerPolicy?.schemaVersion}:null},label,45000)
  const results=[]
  let result=await wait('recovered question');assert.equal(result.failed,undefined,JSON.stringify(result));assert.equal(result.policy,'ielts-native-examiner-v2');results.push({case:'recover',...result})
  for(const item of [
   {name:'part1-short-valid',text:'Yes.',phase:'part1',seconds:60,quality:'brief'},
   {name:'part1-clarification',text:'When you say historic places, do you mean old buildings?',phase:'part1',seconds:90,quality:'complete'},
   {name:'part2-cue',text:'I visited an old castle with my family. The tower and the museum helped me understand local history.',phase:'part1',seconds:300,quality:'complete'},
   {name:'part3-answer-led',text:'Local government should preserve historic buildings, but it must also fund schools. One way is to use tourist ticket income for restoration.',phase:'part3',seconds:800,quality:'complete'}
  ]){
   await evaluate('function(){const q=getApp().__policyQa,e=q.engine,x='+JSON.stringify(item)+';q.ready=false;e.stageState={phase:x.phase};e.startedAt=Date.now()-x.seconds*1000;e.send({type:"conversation.item.create",item:{type:"message",role:"user",content:[{type:"input_text",text:x.text}]}});e.addTurn("user",x.text);e.pendingTranscript=true;e.respondToAnswer(x.quality);return true}')
   result=await wait(item.name);assert.equal(result.failed,undefined,JSON.stringify({case:item.name,...result}));const reply=result.turns.at(-1)?.text||'';assert.ok(reply);results.push({case:item.name,reply,phase:result.phase,audioResponses:result.audioResponses})
   assert.doesNotMatch(reply,/great answer|excellent answer|interesting thought|thoughtful of you|sounds lovely/i)
   if(item.name==='part2-cue'){
    assert.equal(result.phase,'part2-prep');assert.match(reply,/historic place/i);assert.match(reply,/where|located/i);assert.match(reply,/see/i);assert.match(reply,/why|interesting/i)
   }else{assert.ok((reply.match(/\?/g)||[]).length<=1);if(item.name==='part1-short-valid')assert.doesNotMatch(reply,/did not catch|didn't catch|couldn't hear/i);if(item.name==='part3-answer-led'){assert.equal(result.phase,'part3');assert.match(reply,/school|fund|touris|ticket|restor|budget|preserv|government/i);assert.doesNotMatch(reply,/one minute to prepare|describe an interesting historic place/i)}}
  }
  assert.ok(result.audioResponses>=5,'each response must include audio')
  const output={status:'pass',kind:'synthetic-text-real-qwen-audio',microphoneUsed:false,studentRecordsWritten:false,results}
  const index=process.argv.indexOf('--output');if(index>=0){const dir=path.resolve(process.argv[index+1]);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'speaking-policy-live.json'),JSON.stringify(output,null,2))}
  console.log(JSON.stringify(output))
 }finally{await evaluate(function(){getApp().__policyQa?.engine?.close();delete getApp().__policyQa;return true}).catch(()=>{});await account.end()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
