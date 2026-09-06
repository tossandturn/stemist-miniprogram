const {deviceState,syncDevice}=require('../../utils/page')
const {getIeltsTask}=require('../../utils/ieltsContent')
const {NativeSpeaking}=require('../../utils/nativeSpeaking')
const {requestIeltsLearning}=require('../../utils/ieltsLearning')
const {rememberRecord}=require('../../utils/nativeRecords')
const {readExam,completeExamModule}=require('../../utils/nativeExam')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
Page({
 data:deviceState({taskId:'',taskTitle:'Speaking',active:false,connecting:false,scoring:false,status:'',error:'',turns:[],turnCount:0,elapsed:'00:00',feedback:'',band:null,warning:'',canRetry:false}),
 onLoad(options={}){
  this.__disposed=false;this.__valid=false;this.__owner=owner();this.__epoch=epoch();this.__turns=[]
  const taskId=String(options.taskId||'')
  this.__examKey=String(options.examKey||'')
  if(this.__examKey){const exam=readExam(this.__examKey);if(!exam||exam.sources.speaking!==taskId){this.setData({error:'口语题目不属于当前模拟。'});return}}
  this.__scope='stemistIeltsSpeaking:'+this.__owner+':'+(taskId||'general')+(this.__examKey?':'+this.__examKey:'')
  this.__valid=true
  this.setData({taskId,examMode:Boolean(this.__examKey)})
  const saved=wx.getStorageSync(this.__scope)
  this.__sessionId=saved?.sessionId||'speech-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)
  if(saved&&saved.epoch===this.__epoch){this.__turns=saved.turns||[];this.__elapsed=saved.elapsed||0;this.__lastNote=saved.note||'';this.setData({turns:this.__turns.slice(-12),turnCount:this.__turns.length,status:this.__turns.length?'已恢复口语记录':'',feedback:saved.feedback||'',band:saved.band??null,warning:saved.warning||''})}
  if(taskId)this.loadTask()
 },
 current(){return !this.__disposed&&this.__valid&&this.__owner===owner()&&this.__epoch===epoch()},
 async loadTask(){try{this.__task=await getIeltsTask('speaking',this.data.taskId);if(this.current())this.setData({taskTitle:this.__task.title})}catch(e){if(this.current())this.setData({error:e.message})}},
 onShow(){syncDevice(this)},onResize(){syncDevice(this)},
 onHide(){this.stopSession();this.persist()},
 onUnload(){this.stopSession();this.persist();this.__disposed=true},
 state(patch){if(!this.current())return;const changes=Object.fromEntries(Object.entries(patch).filter(([key,value])=>this.data[key]!==value));if(Object.keys(changes).length)this.setData(changes)},
 persist(){if(this.current())wx.setStorageSync(this.__scope,{sessionId:this.__sessionId,note:this.__lastNote||'',turns:this.__turns.slice(-120),elapsed:this.elapsedSeconds(),epoch:this.__epoch,taskId:this.data.taskId,feedback:this.data.feedback,band:this.data.band,warning:this.data.warning})},
 elapsedSeconds(){return (this.__elapsed||0)+(this.__startedAt?Math.floor((Date.now()-this.__startedAt)/1000):0)},
 async start(){
  if(!this.current()||this.data.active||this.data.connecting||this.data.scoring)return
  if(this.data.feedback){this.__sessionId='speech-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);this.__turns=[];this.__elapsed=0;this.__lastNote='';this.setData({turns:[],turnCount:0,elapsed:'00:00'})}
  this.setData({connecting:true,error:'',feedback:'',band:null,warning:'',canRetry:false})
  this.__startedAt=Date.now()
  this.__engine=new NativeSpeaking({task:this.__task,turns:this.__turns,startedAt:Date.now()-(this.__elapsed||0)*1000,
   onState:patch=>this.state(patch),
   onTurn:(turn,turns)=>{if(this.current()){this.__turns=turns;this.setData({turns:turns.slice(-12),turnCount:turns.length});this.persist()}},
   onError:message=>{this.stopSession();this.state({error:message,canRetry:true,status:'练习已暂停'})},
   onFinish:()=>this.finish()
  })
  try{
   await this.__engine.start()
   if(!this.current())return
   this.__clock=setInterval(()=>{const value=this.elapsedSeconds();this.state({elapsed:String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0')})},1000)
  }catch(e){this.stopSession();this.state({error:e.message||'口语未能启动，请重试。',canRetry:true})}
  finally{this.state({connecting:false})}
 },
 stopSession(){
  this.__engine?.close();clearInterval(this.__clock)
  if(this.__startedAt){this.__elapsed=this.elapsedSeconds();this.__startedAt=null}
  this.state({active:false,connecting:false})
 },
 async finish(){
  if(this.data.scoring||!this.current())return
  if(!this.__turns.some(turn=>turn.role==='user')){this.stopSession();this.state({status:'尚未收到有效回答'});return}
  this.setData({scoring:true,error:'',canRetry:false,status:'正在整理口语反馈…'})
  try{
   const note=this.__engine&&!this.__engine.closed?await this.__engine.end():this.__lastNote||''
   this.__lastNote=note
   this.stopSession();this.persist()
   if(!this.current())return
   const transcript=this.__turns.map(t=>(t.role==='user'?'Candidate: ':'Examiner: ')+t.text).join('\n')
   const result=await requestIeltsLearning('/api/speaking/feedback',{set:this.__task?.title||'IELTS Speaking',scope:'full',transcript,realtimeNote:note,audioEvidence:{available:false,warning:'Native live session: no post-session MP3 was attached.'}},{timeout:60000})
   if(!this.current())return
   const ai=String(result?.mode||'').startsWith('ai'),score=Number(result?.band)
   const audioObserved=Boolean(result?.evidence?.realtimeNote||result?.evidence?.mp3)
   const band=ai&&audioObserved&&Number.isFinite(score)&&score>=0&&score<=9?score:null
   this.setData({feedback:String(result?.feedback||''),band,warning:!ai?'AI 评分未完成，以下仅为基础建议。':!audioObserved?'本次反馈基于转写，发音评分尚未验证。':'AI 练习估分，仅供复习参考。',canRetry:!ai,status:ai?'反馈已生成':'基础建议'})
   this.persist()
   const record={id:this.__sessionId,category:'ielts',skill:'speaking',taskId:this.data.taskId,title:this.data.taskTitle,answer:result.feedback,band,coachMode:ai?'ai':'local',submittedAt:Date.now()}
   wx.setStorageSync('stemistSubmission:speaking',record);rememberRecord(record)
   if(this.__examKey)completeExamModule(this.__examKey,'speaking',{complete:true,title:this.data.taskTitle,band,feedback:result.feedback})
  }catch(e){if(this.current())this.setData({error:e.message||'反馈未完成，对话已保留。',canRetry:true})}
  finally{this.state({scoring:false})}
 },
 retry(){if(this.__turns.some(t=>t.role==='user')&&!this.data.active)this.finish();else this.start()},
 showEarlier(){this.setData({turns:this.__turns.slice(-Math.min(120,this.data.turns.length+12))})},
 selectTask(){if(!this.data.active&&!this.data.scoring)wx.navigateTo({url:'/pages/ielts/library?module=speaking'})},
 exportTranscript(){
  if(!this.__turns.length||!wx.shareFileMessage)return this.setData({error:'当前设备暂不支持分享文件。'})
  const filePath=wx.env.USER_DATA_PATH+'/ielts-speaking-transcript.txt'
  wx.getFileSystemManager().writeFile({filePath,data:this.__turns.map(t=>(t.role==='user'?'Candidate: ':'Examiner: ')+t.text).join('\n\n'),encoding:'utf8',success:()=>{wx.setStorageSync('stemistSpeakingExportPath',filePath);wx.shareFileMessage({filePath,fileName:'IELTS Speaking.txt'})},fail:()=>this.setData({error:'记录未能导出，请重试。'})})
 },
 openBack(){wx.navigateBack()}
})
