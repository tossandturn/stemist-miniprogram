const {ensureRecordPermission,recordingError}=require('./recordPermission')
const {issueDirectSession}=require('./speakingDirect')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const privacyEpoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0

function pcmRms(buffer) {
 const samples=new Int16Array(buffer,0,Math.floor(buffer.byteLength/2))
 if(!samples.length)return 0
 let energy=0
 for(let i=0;i<samples.length;i+=4)energy+=(samples[i]/32768)**2
 return Math.sqrt(energy/Math.ceil(samples.length/4))
}

class NativeSpeaking {
 constructor({task,turns=[],startedAt=Date.now(),onState=()=>{},onTurn=()=>{},onError=()=>{},onFinish=()=>{},onReady=()=>{}}={}) {
  Object.assign(this,{task,turns:turns.slice(),startedAt,onState,onTurn,onError,onFinish,onReady})
  this.closed=false;this.generation=0;this.retries=0;this.sources=new Set();this.playUntil=0;this.lastVoice=0;this.voicedBytes=0;this.waiting=false;this.assistant=''
  this.owner=owner();this.epoch=privacyEpoch();this.eventSequence=0
 }
 current(){return !this.closed&&this.owner===owner()&&this.epoch===privacyEpoch()}
 async start(){
  if(!wx.getRecorderManager||!wx.createWebAudioContext||!wx.connectSocket)throw new Error('当前微信版本不支持实时口语，请升级微信后重试。')
  await ensureRecordPermission({cancelled:()=>this.closed})
  if(this.closed)return
  const ticket=await issueDirectSession(this.sessionContext())
  if(!this.current()){this.close();return}
  this.audio=wx.createWebAudioContext();await this.audio.resume?.()
  if(this.closed){this.audio?.close?.();return}
  this.recorder=wx.getRecorderManager()
  this.frameHandler=event=>this.frame(event.frameBuffer)
  this.stopHandler=event=>{if(event.tempFilePath)this.lastRecording=event.tempFilePath;if(!this.closed&&this.ready)this.record()}
  this.errorHandler=error=>this.fail(recordingError(error))
  this.recorder.onFrameRecorded(this.frameHandler);this.recorder.onStop(this.stopHandler);this.recorder.onError(this.errorHandler)
  wx.setKeepScreenOn?.({keepScreenOn:true})
  await this.connect(ticket)
 }
 sessionContext(recovery=false){
  return {taskId:this.task?.id||'',recovery,elapsedSeconds:Math.max(0,Math.floor((Date.now()-this.startedAt)/1000)),completedDialogue:this.turns.slice(-16)}
 }
 async connect(ticket=null){
  if(!this.current()){this.close();return}
  const access=ticket||await issueDirectSession(this.sessionContext(this.retries>0||this.turns.length>0))
  if(!this.current()){this.close();return}
  if(Date.parse(access.expiresAt)<=Date.now()+1000)throw Error('语音连接凭证已过期，请重试。')
  const generation=++this.generation
  this.direct={sessionUpdate:access.sessionUpdate,responses:access.responses,maxSessionSeconds:access.maxSessionSeconds}
  this.onState({connecting:true,status:this.retries?'正在恢复连接…':'正在连接考官…'})
  const socket=wx.connectSocket({url:access.endpoint,header:{Authorization:'Bearer '+access.token}})
  // Only the WSS handshake owns the short-lived token; never retain it in
  // page data, session history, logs, or the engine's reusable configuration.
  access.token=''
  this.socket=socket;this.ready=false
  clearTimeout(this.connectionTimer);this.connectionTimer=setTimeout(()=>{if(!this.closed&&generation===this.generation&&!this.ready)this.recover()},18000)
  clearTimeout(this.sessionTimer);this.sessionTimer=setTimeout(()=>{if(!this.closed)this.fail('本次语音练习已到时长上限，对话已保留。')},Math.max(1,access.maxSessionSeconds*1000-(Date.now()-this.startedAt)))
  socket.onOpen(()=>{if(!this.current()){this.close();return}if(generation===this.generation)this.send(this.direct.sessionUpdate)})
  socket.onMessage(event=>{if(!this.current()){this.close();return}if(generation!==this.generation)return;try{this.message(JSON.parse(event.data))}catch{this.fail('语音数据格式异常，请重试。')}})
  socket.onError(error=>{if(!this.closed&&generation===this.generation){if(/domain list|合法域名|not in domain/i.test(error?.errMsg||''))this.fail('国内语音域名尚未配置，请联系管理员。');else this.recover()}})
  socket.onClose(()=>{if(!this.closed&&generation===this.generation)this.recover()})
 }
 send(event){
  if(!this.current()||!this.socket)return
  let message=event
  if(event.type==='audio.commit')message={type:'input_audio_buffer.commit'}
  if(event.type==='response.create'){
   const name=event.intent==='assessment'?'assessment':event.intent==='opening'?'opening':'next',template=this.direct?.responses[name]
   if(!template)return this.fail('考官配置不完整，请重新连接。')
   message={type:'response.create',response:{...template.response}}
   if(name==='next')message.response.instructions+='\nElapsed practice time: '+Math.max(0,Math.min(1200,Math.floor((Date.now()-this.startedAt)/1000)))+' seconds.'
  }
  this.socket.send({data:JSON.stringify({...message,event_id:'mini_'+Date.now().toString(36)+'_'+(++this.eventSequence)}),fail:()=>{if(!this.closed)this.recover()}})
 }
 sendAudio(buffer){this.send({type:'input_audio_buffer.append',audio:wx.arrayBufferToBase64(buffer)})}
 record(){if(!this.closed&&this.ready)this.recorder.start({duration:570000,sampleRate:16000,numberOfChannels:1,format:'PCM',frameSize:2})}
 frame(buffer){
  if(!this.current()||!this.ready||!buffer?.byteLength||this.waiting||this.audio.currentTime<this.playUntil)return
  const rms=pcmRms(buffer),now=Date.now()
  if(rms>.008){this.lastVoice=now;this.voicedBytes+=buffer.byteLength;this.sendAudio(buffer)}
  else if(rms>.0001&&this.lastVoice&&now-this.lastVoice<250)this.sendAudio(buffer)
  if(this.lastVoice&&now-this.lastVoice>=1800&&this.voicedBytes>=8000){
   this.waiting=true;this.voicedBytes=0;this.lastVoice=0
   this.send({type:'audio.commit'})
   const elapsed=Math.floor((now-this.startedAt)/1000)
    this.send({type:'response.create',intent:'next-question',context:{elapsedSeconds:elapsed}})
   this.onState({status:'考官正在回应…'})
   clearTimeout(this.turnTimer);this.turnTimer=setTimeout(()=>{if(!this.closed&&this.waiting)this.fail('本轮回应超时，已保留对话。请重试连接。')},30000)
  }
 }
 addTurn(role,text){
  const value=String(text||'').trim();if(!value)return
  const previous=this.turns[this.turns.length-1]
  if(previous?.role===role&&previous.text===value)return
  const turn={role,text:value,at:Date.now()};this.turns.push(turn);this.onTurn(turn,this.turns)
 }
 message(message){
  if(this.collectingNote){
   if(message.type==='error')return this.finishNote('')
   const payload=message.payload||message,type=message.eventType||payload.type
   if(type==='response.text.delta'||type==='response.output_text.delta')this.noteText+=String(payload.delta||'')
   if(type==='response.text.done'||type==='response.output_text.done')this.noteText=String(payload.text||this.noteText)
   if(type==='response.done')this.finishNote(this.noteText)
   return
  }
  if(message.type==='error'){
   const code=String(message.error?.code||message.code||'')
   if(!this.ready&&['server_error','service_unavailable','internal_error'].includes(code))return this.recover()
   return this.fail(/InvalidApiKey|invalid_api_key|AccessDenied|invalid_authentication/i.test(code)?'国内语音授权失败，请检查专用模型权限。':/rate|Throttl|quota/i.test(code)?'语音服务额度或并发受限，请稍后重试。':'考官暂时不可用，对话已保留，请稍后重试。')
  }
  const payload=message.payload||message,type=message.eventType||payload.type
  if(type==='response.created'){this.assistant='';this.assistantSource='';this.waiting=true}
  if(type==='session.updated'&&!this.ready){
   this.ready=true;clearTimeout(this.connectionTimer);this.onReady();if(this.closed)return;this.record();this.onState({active:true,connecting:false,status:'考官已连接'})
   this.waiting=true
   this.send({type:'response.create',intent:this.retries||this.turns.length?'next-question':'opening'});return
  }
  if(type==='error')return this.fail('语音服务返回错误，对话已保留。')
  if(type==='response.audio.delta'&&payload.delta){this.play(payload.delta);this.onState({status:'考官正在说话…'});return}
  if(type==='response.audio_transcript.delta'){if(this.assistantSource!=='audio')this.assistant='';this.assistantSource='audio';this.assistant+=String(payload.delta||'');return}
  if((type==='response.text.delta'||type==='response.output_text.delta')&&this.assistantSource!=='audio'){this.assistantSource='text';this.assistant+=String(payload.delta||'');return}
  if(type==='conversation.item.input_audio_transcription.completed'||type==='input_audio_transcription.completed')this.addTurn('user',payload.transcript||payload.text)
  if(type==='response.audio_transcript.done'||type==='response.text.done'||type==='response.output_text.done'){
   if(type!=='response.audio_transcript.done'&&this.assistantSource==='audio')return
   this.addTurn('assistant',payload.transcript||payload.text||this.assistant);this.assistant=''
  }
  if(type==='response.done'){
   if(this.assistant){this.addTurn('assistant',this.assistant);this.assistant=''}
   clearTimeout(this.turnTimer);this.waiting=false;this.voicedBytes=0;this.lastVoice=0
   if(this.finishing){this.requestNote();return}
   const delay=Math.max(0,(this.playUntil-this.audio.currentTime)*1000)
   clearTimeout(this.responseTimer);this.responseTimer=setTimeout(()=>{
    if(this.closed)return
    if(Date.now()-this.startedAt>=900000){this.ready=false;this.recorder?.stop();this.onFinish(this.turns)}
    else this.onState({status:'请自然回答'})
   },delay+40)
  }
 }
 requestNote(){
  if(this.closed||this.collectingNote)return
  this.collectingNote=true;this.noteText=''
  this.send({type:'response.create',intent:'assessment',modalities:['text']})
 }
 finishNote(note){clearTimeout(this.noteTimer);const resolve=this.noteResolve;this.noteResolve=null;resolve?.(String(note||''))}
 end(){
  if(this.closed)return Promise.resolve('')
  this.finishing=true;this.ready=false;this.recorder?.stop()
  for(const source of this.sources){try{source.stop()}catch{}source.disconnect?.()}this.sources.clear()
  return new Promise(resolve=>{
   this.noteResolve=resolve;this.noteTimer=setTimeout(()=>this.finishNote(''),12000)
   if(!this.waiting)this.requestNote()
  })
 }
 play(base64){
  const buffer=wx.base64ToArrayBuffer(base64),samples=new Int16Array(buffer,0,Math.floor(buffer.byteLength/2))
  if(!samples.length)return
  if(this.playUntil-this.audio.currentTime>30)return this.fail('语音播放积压，已暂停连接。')
  const audioBuffer=this.audio.createBuffer(1,samples.length,24000),channel=audioBuffer.getChannelData(0)
  for(let i=0;i<samples.length;i++)channel[i]=samples[i]/32768
  const source=this.audio.createBufferSource();source.buffer=audioBuffer;source.connect(this.audio.destination)
  const when=Math.max(this.audio.currentTime+.08,this.playUntil);source.start(when);this.playUntil=when+samples.length/24000
  this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect?.()}
 }
 recover(){
  if(this.closed||this.recovering)return
  this.recovering=true;this.ready=false;this.waiting=false;this.voicedBytes=0;this.lastVoice=0;this.recorder?.stop();this.generation++;this.socket?.close()
  clearTimeout(this.connectionTimer);clearTimeout(this.turnTimer);clearTimeout(this.responseTimer)
  for(const source of this.sources){try{source.stop()}catch{}source.disconnect?.()}this.sources.clear();this.playUntil=this.audio?.currentTime||0;this.assistant=''
  if(++this.retries>2){this.recovering=false;this.fail('连接多次中断，已保留对话。请检查网络后重试。');return}
  this.onState({status:'连接中断，正在恢复…'})
  this.recoveryTimer=setTimeout(()=>{this.recovering=false;this.connect().catch(error=>this.fail(error?.message||'口语连接授权未完成，请重试。'))},this.retries*1500)
 }
 fail(message){if(this.closed)return;this.close();this.onError(message)}
 close(){
  if(this.closed)return
  this.closed=true;this.ready=false;this.generation++
  for(const timer of [this.connectionTimer,this.turnTimer,this.responseTimer,this.recoveryTimer,this.sessionTimer])clearTimeout(timer)
  this.finishNote('')
  this.recorder?.offFrameRecorded?.(this.frameHandler);this.recorder?.offStop?.(this.stopHandler);this.recorder?.offError?.(this.errorHandler);this.recorder?.stop()
  this.socket?.close({code:1000,reason:'practice stopped'})
  this.direct=null
  for(const source of this.sources){try{source.stop()}catch{}source.disconnect?.()}this.sources.clear();this.audio?.close?.()
  wx.setKeepScreenOn?.({keepScreenOn:false});this.onState({active:false,connecting:false,status:'已停止录音'})
 }
}
module.exports={NativeSpeaking,pcmRms}
