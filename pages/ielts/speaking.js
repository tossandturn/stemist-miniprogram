const {deviceState,syncDevice}=require('../../utils/page')
const {getIeltsTask}=require('../../utils/ieltsContent')
const {NativeSpeaking}=require('../../utils/nativeSpeaking')
const {requestIeltsLearning}=require('../../utils/ieltsLearning')
const {rememberRecord}=require('../../utils/nativeRecords')
const {readExam,completeExamModule}=require('../../utils/nativeExam')
const {openRecordSettings}=require('../../utils/recordPermission')
const speakingStore=require('../../utils/speakingStore')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const clock=seconds=>String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')
Page({
 data:deviceState({taskId:'',taskTitle:'Speaking',taskLoading:false,active:false,connecting:false,scoring:false,status:'',error:'',turns:[],turnCount:0,elapsed:'00:00',feedback:'',band:null,warning:'',canRetry:false,retryAction:'start',permissionAction:'',privacyContractName:'用户隐私保护指引',viewingArchive:false,hasEarlier:false,hasLater:false,showHistory:false,historyRows:[],historyHasMore:false}),
 onLoad(options={}){
  this.__disposed=false;this.__visible=true;this.__valid=false;this.__dirty=false;this.__startGeneration=0;this.__owner=owner();this.__epoch=epoch();this.__turns=[];this.__baseSnapshot={}
  let taskId=String(options.taskId||'')
  let archived=null
  if(options.sessionId){try{archived=speakingStore.readSession(this.__owner,String(options.sessionId),this.__epoch)}catch{}if(!archived){this.setData({viewingArchive:true,error:'未找到这条本机记录，其他记录未修改。'});return}if(taskId&&taskId!==archived.taskId){this.setData({viewingArchive:true,error:'话题与记录不匹配。'});return}taskId=archived.taskId||''}
  this.__examKey=String(options.examKey||'')
  if(this.__examKey){const exam=readExam(this.__examKey);if(!exam||exam.sources.speaking!==taskId){this.setData({error:'口语题目不属于当前模拟。'});return}}
  this.__scope='stemistIeltsSpeaking:'+this.__owner+':'+(taskId||'general')+(this.__examKey?':'+this.__examKey:'')
  this.__valid=true
  this.setData({taskId,examMode:Boolean(this.__examKey),viewingArchive:Boolean(archived)})
  const saved=archived||wx.getStorageSync(this.__scope)
  this.__sessionId=saved?.epoch===this.__epoch&&saved.sessionId?saved.sessionId:'speech-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)
  if(saved&&saved.epoch===this.__epoch){this.__baseSnapshot={...saved};this.__turns=Array.isArray(saved.turns)?saved.turns:[];this.__elapsed=saved.elapsed||0;this.__lastNote=saved.note||'';this.setData({taskTitle:saved.taskTitle||'Speaking',elapsed:clock(this.__elapsed),status:archived?'历史记录':this.__turns.length?'已恢复口语记录':'',feedback:saved.feedback||'',band:saved.band??null,warning:saved.warning||''});this.renderTurns()}
  if(taskId&&!archived)this.loadTask()
 },
 current(){return !this.__disposed&&this.__valid&&this.__owner===owner()&&this.__epoch===epoch()},
 async loadTask(){this.setData({taskLoading:true});try{this.__task=await getIeltsTask('speaking',this.data.taskId);if(this.current())this.setData({taskTitle:this.__task.title})}catch(e){if(this.current())this.setData({error:e.message})}finally{this.state({taskLoading:false})}},
 onShow(){this.__visible=true;syncDevice(this);if(this.current()&&!this.data.viewingArchive&&!this.__dirty&&!this.data.active&&!this.data.connecting&&!this.data.scoring){const saved=wx.getStorageSync(this.__scope);if(saved&&saved.epoch===this.__epoch&&saved.taskId===this.data.taskId&&(saved.sessionId!==this.__sessionId||(saved.revision||0)!==(this.__baseSnapshot.revision||0))){this.__baseSnapshot={...saved};this.__sessionId=saved.sessionId;this.__turns=saved.turns||[];this.__elapsed=saved.elapsed||0;this.__lastNote=saved.note||'';this.state({feedback:saved.feedback||'',band:saved.band??null,warning:saved.warning||'',elapsed:clock(this.__elapsed),status:'已恢复最新口语记录'});this.renderTurns()}}},onResize(){syncDevice(this)},
 onHide(){this.__visible=false;this.stopSession();this.persist()},
 onUnload(){this.stopSession();this.persist();this.__disposed=true},
 state(patch){if(!this.current())return;const changes=Object.fromEntries(Object.entries(patch).filter(([key,value])=>this.data[key]!==value));if(Object.keys(changes).length)this.setData(changes)},
 snapshot(){return {...this.__baseSnapshot,sessionId:this.__sessionId,note:this.__lastNote||'',turns:this.__turns,elapsed:this.elapsedSeconds(),epoch:this.__epoch,taskId:this.data.taskId,taskTitle:this.data.taskTitle,feedback:this.data.feedback,band:this.data.band,warning:this.data.warning,updatedAt:Date.now()}},
 persist(){if(!this.current()||this.data.viewingArchive||!this.__dirty)return true;try{this.__baseSnapshot=speakingStore.saveSession(this.__scope,this.__owner,this.snapshot());this.__dirty=false;return true}catch{this.state({error:'记录尚未保存，请检查本机空间。已有记录未删除。'});return false}},
 elapsedSeconds(){return (this.__elapsed||0)+(this.__startedAt?Math.floor((Date.now()-this.__startedAt)/1000):0)},
 async start(){
  if(!this.current()||!this.__visible||this.data.viewingArchive||this.data.active||this.data.connecting||this.data.scoring)return
  if(this.__dirty&&!this.persist())return
  if(this.data.taskId&&!this.__task)return this.state({error:'请等待话题加载完成后再开始。'})
  const generation=++this.__startGeneration,newSession=Boolean(this.data.feedback)
  let committed=false
  this.setData({connecting:true,error:'',canRetry:false,permissionAction:'',status:'正在检查麦克风…'})
  const valid=()=>this.current()&&this.__visible&&generation===this.__startGeneration
  const fail=error=>{if(!valid())return;this.stopSession();this.persist();this.state({error:typeof error==='string'?error:error.message||'口语未能启动，请重试。',permissionAction:error?.action&&error.action!=='retry'?error.action:'',privacyContractName:error?.contractName||'用户隐私保护指引',canRetry:true,retryAction:'start',status:'练习已暂停'})}
  const engine=new NativeSpeaking({task:this.__task,turns:newSession?[]:this.__turns,startedAt:Date.now()-(newSession?0:this.__elapsed||0)*1000,
   onState:patch=>{if(valid())this.state(patch)},
   onReady:()=>{
    if(!valid()){engine.close();return}
    if(committed)return
    try{
     if(newSession)speakingStore.archiveSession(this.__owner,this.snapshot())
     const next=newSession?{sessionId:'speech-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),epoch:this.__epoch,taskId:this.data.taskId,taskTitle:this.data.taskTitle,turns:engine.turns,elapsed:0,note:'',feedback:'',band:null,warning:'',updatedAt:Date.now()}:this.snapshot()
     // Persist before replacing the visible record or beginning capture.
     const stored=speakingStore.saveSession(this.__scope,this.__owner,next,{replaceFrom:{sessionId:this.__sessionId,revision:this.__baseSnapshot.revision||0}})
     this.__sessionId=stored.sessionId;this.__baseSnapshot=stored;this.__turns=engine.turns;this.__elapsed=stored.elapsed||0;this.__lastNote=stored.note||'';this.__startedAt=Date.now();this.__dirty=false
     committed=true
     this.state({feedback:stored.feedback||'',band:stored.band??null,warning:stored.warning||'',elapsed:clock(this.__elapsed),connecting:false});this.renderTurns()
     clearInterval(this.__clock);this.__clock=setInterval(()=>this.state({elapsed:clock(this.elapsedSeconds())}),1000)
    }catch{fail(new Error('保存历史记录失败，旧练习未修改。请检查本机空间。'))}
   },
   onTurn:(turn,turns)=>{if(valid()&&committed){this.__turns=turns;this.__dirty=true;this.renderTurns();this.persist()}},
   onError:fail,onFinish:()=>{if(valid())this.finish()}
  });this.__engine=engine
  try{
   await engine.start()
   if(!valid())engine.close()
  }catch(error){fail(error)}
 },
 stopSession(){
  this.__startGeneration=(this.__startGeneration||0)+1
  this.__engine?.close();clearInterval(this.__clock)
  if(this.__startedAt){this.__elapsed=this.elapsedSeconds();this.__startedAt=null;this.__dirty=true}
  this.state({active:false,connecting:false})
 },
 async finish(){
  if(this.data.scoring||!this.current()||this.data.viewingArchive)return
  if(!this.__turns.some(turn=>turn.role==='user')){this.stopSession();this.state({status:'尚未收到有效回答'});return}
  this.setData({scoring:true,error:'',canRetry:false,status:'正在整理口语反馈…'})
  try{
   const note=this.__engine&&!this.__engine.closed?await this.__engine.end():this.__lastNote||''
   this.__lastNote=note;this.__dirty=true
   this.stopSession();this.persist()
   if(!this.current())return
   const transcript=this.__turns.map(t=>(t.role==='user'?'Candidate: ':'Examiner: ')+t.text).join('\n')
   const result=await requestIeltsLearning('/api/speaking/feedback',{set:this.__task?.title||'IELTS Speaking',scope:'full',transcript,realtimeNote:note,audioEvidence:{available:false,warning:'Native live session: no post-session MP3 was attached.'}},{timeout:60000})
   if(!this.current())return
   if(!String(result?.feedback||'').trim())throw new Error('未收到完整反馈，对话已保留。')
   const ai=String(result?.mode||'').startsWith('ai'),score=Number(result?.band)
   const audioObserved=Boolean(result?.evidence?.realtimeNote||result?.evidence?.mp3)
   const band=ai&&audioObserved&&Number.isFinite(score)&&score>=0&&score<=9?score:null
   this.setData({feedback:String(result?.feedback||''),band,warning:!ai?'AI 评分未完成，以下仅为基础建议。':!audioObserved?'本次反馈基于转写，发音评分尚未验证。':'AI 练习估分，仅供复习参考。',canRetry:!ai,retryAction:'score',status:ai?'反馈已生成':'基础建议'})
   this.__dirty=true;if(!this.persist())return
   const record={id:this.__sessionId,category:'ielts',skill:'speaking',taskId:this.data.taskId,title:this.data.taskTitle,answer:result.feedback,band,coachMode:ai?'ai':'local',submittedAt:Date.now()}
   wx.setStorageSync('stemistSubmission:speaking',record);rememberRecord(record)
   if(this.__examKey)completeExamModule(this.__examKey,'speaking',{complete:true,title:this.data.taskTitle,band,feedback:result.feedback})
  }catch(e){if(this.current())this.setData({error:e.message||'反馈未完成，对话已保留。',canRetry:true,retryAction:'score'})}
  finally{this.state({scoring:false})}
 },
 retry(){if(this.data.retryAction==='score')this.finish();else this.start()},
 renderTurns(start=Math.max(0,this.__turns.length-12)){this.__turnStart=start;this.setData({turns:this.__turns.slice(start,start+12),turnCount:this.__turns.length,hasEarlier:start>0,hasLater:start+12<this.__turns.length})},
 showEarlier(){this.renderTurns(Math.max(0,(this.__turnStart||0)-12))},
 showLater(){this.renderTurns(Math.min(Math.max(0,this.__turns.length-12),(this.__turnStart||0)+12))},
 async permissionSettings(){try{const result=await openRecordSettings(this.data.permissionAction);this.state(result.granted?{permissionAction:'',error:'',canRetry:false,status:'麦克风已开启，点击开始练习。'}:{permissionAction:result.action,error:'麦克风尚未开启，原记录保持不变。'})}catch{this.state({error:'设置未能打开，请在微信或系统设置中允许麦克风。'})}},
 openPrivacy(){wx.openPrivacyContract?.({fail:()=>this.state({error:'隐私指引暂时无法打开，请稍后重试。'})})},
 openPermissions(){if(!this.current()||this.data.active||this.data.connecting||this.data.scoring)return;wx.navigateTo({url:'/pages/legal/privacy',fail:()=>this.state({error:'权限设置未能打开，请重试。'})})},
 agreePrivacy(){if(this.current()&&this.__visible)this.start()},
 showSaved(){try{this.__historyRows=speakingStore.sessionHistory(this.__owner,this.__epoch);this.state({showHistory:true});this.renderHistory(0)}catch{this.state({error:'历史暂时无法读取，原记录未修改。'})}},
 renderHistory(page){const rows=this.__historyRows||[];this.__historyPage=Math.max(0,Math.min(page,Math.ceil(rows.length/20)-1));const start=this.__historyPage*20;this.state({historyRows:rows.slice(start,start+20),historyHasMore:start+20<rows.length,historyHasPrevious:start>0})},
 moreHistory(){this.renderHistory((this.__historyPage||0)+1)},
 previousHistory(){this.renderHistory((this.__historyPage||0)-1)},
 closeHistory(){this.state({showHistory:false})},
 openSaved(event){const id=String(event.currentTarget.dataset.id||'');wx.navigateTo({url:'/pages/ielts/speaking?sessionId='+encodeURIComponent(id)})},
 returnToPractice(){wx.redirectTo({url:'/pages/ielts/speaking'+(this.data.taskId?'?taskId='+encodeURIComponent(this.data.taskId):'')})},
 selectTask(){if(!this.data.active&&!this.data.scoring)wx.navigateTo({url:'/pages/ielts/library?module=speaking'})},
 exportTranscript(){
  if(!this.__turns.length||!wx.shareFileMessage)return this.setData({error:'当前设备暂不支持分享文件。'})
  const filePath=wx.env.USER_DATA_PATH+'/ielts-speaking-transcript.txt'
  wx.getFileSystemManager().writeFile({filePath,data:this.__turns.map(t=>(t.role==='user'?'Candidate: ':'Examiner: ')+t.text).join('\n\n'),encoding:'utf8',success:()=>{wx.setStorageSync('stemistSpeakingExportPath',filePath);wx.shareFileMessage({filePath,fileName:'IELTS Speaking.txt'})},fail:()=>this.setData({error:'记录未能导出，请重试。'})})
 },
 openBack(){wx.navigateBack()}
})
