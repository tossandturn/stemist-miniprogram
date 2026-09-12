const {deviceState,syncDevice}=require('./page')
const {getIeltsTask}=require('./ieltsContent')
const {sectionTask}=require('./ieltsUnits')
const {loadCaptions,captionFrame}=require('./nativeCaptions')
const {acquireListeningAudio}=require('./listeningAudioCache')
const {requestIeltsJson}=require('./api')
const {requestIeltsLearning}=require('./ieltsLearning')
const {rememberRecord}=require('./nativeRecords')
const {readExam,completeExamModule,startExamModuleClock,clockState}=require('./nativeExam')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const clock=seconds=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`
function makeObjectivePage(module){return{
 data:deviceState({module,title:module==='listening'?'Listening':'Reading',taskId:'',taskTitle:'',loading:true,busy:false,error:'',questions:[],questionNav:[],current:0,total:0,answer:'',answered:0,sourceImages:[],imageIndex:0,imageCount:0,passageText:'',showPassage:false,audioAvailable:false,audioPlaying:false,audioPosition:0,audioDuration:0,audioTracks:[],audioIndex:0,elapsed:'00:00',saveStatus:'',submitted:false,result:null,review:[],captionsEnabled:false,captionBubbles:[],captionStatus:''}),
 onLoad(options={}){this.__disposed=false;this.__epoch=epoch();this.__owner=owner();this.__generation=0;this.__section=Number(options.section)||0;this.__examKey=String(options.examKey||'');this.setData({taskId:String(options.taskId||''),examMode:Boolean(this.__examKey)});if(this.__examKey){this.__exam=readExam(this.__examKey);if(this.__section||!this.__exam||this.__exam.sources[module]!==this.data.taskId){this.setData({loading:false,error:'试题不属于当前模拟。'});return}}if(!this.data.taskId){wx.redirectTo({url:`/pages/ielts/library?module=${module}`});return}this.load()},
 onShow(){this.__visible=true;syncDevice(this);if(this.__task){this.startClock();if(this.data.audioAvailable&&!this.__preparedAudio&&!this.data.audioPreparing)this.prepareAudio()}},onResize(){syncDevice(this)},
 onHide(){this.__visible=false;this.pauseAudio();if(this.data.audioPreparing)this.cancelAudioPreparation();this.flush();this.__baseElapsed=this.__draft?.elapsed||0;this.__activeAt=null;clearInterval(this.__clock)},
 onUnload(){this.flush();this.__disposed=true;this.__visible=false;this.__generation++;clearInterval(this.__clock);clearTimeout(this.__saveTimer);const audio=this.__audio;this.__audio=null;this.__audioTrackIndex=-1;audio?.destroy();this.cancelAudioPreparation()},
 currentOwner(){return !this.__disposed&&this.__epoch===epoch()&&this.__owner===owner()},
 async load(){const generation=++this.__generation;this.setData({loading:true,error:''});try{
  const task=sectionTask(await getIeltsTask(module,this.data.taskId),this.__section);if(!this.currentOwner()||generation!==this.__generation)return
  if(!task.questions.length)throw new Error('这份试题尚未完整导入。')
  this.__task=task;this.__storageKey=`stemistIeltsObjective:${this.__owner}:${task.id}`+(this.__section?':section:'+this.__section:'')+(this.__examKey?':'+this.__examKey:'')
  const saved=wx.getStorageSync(this.__storageKey)
  this.__draft=saved&&saved.epoch===this.__epoch&&saved.taskId===task.id?saved:{taskId:task.id,module,owner:this.__owner,epoch:this.__epoch,answers:{},index:0,startedAt:Date.now(),elapsed:0,submitted:false,clientAttemptKey:'mini_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)}
  if(this.__examKey)this.__examClock=startExamModuleClock(this.__examKey,module,task.minutes)
  this.setData({taskTitle:task.title,current:Math.min(this.__draft.index||0,task.questions.length-1),total:task.questions.length,submitted:Boolean(this.__draft.submitted),result:this.__draft.result||null,review:(this.__draft.review||[]).slice(0,10),audioTracks:task.audioUrls.map((url,index)=>({index,label:'音频 '+(index+1)})),audioAvailable:task.audioUrls.length>0,saveStatus:saved?'已恢复练习':'自动保存'})
  this.renderQuestion();this.startClock();if(this.data.audioAvailable&&this.__visible!==false)this.prepareAudio()
 }catch(error){if(this.currentOwner())this.setData({error:error.message})}finally{if(this.currentOwner()&&generation===this.__generation)this.setData({loading:false})}},
 renderQuestion(){
  const q=this.__task.questions[this.data.current],draft=this.__draft
  const sources=module==='reading'?[...this.__task.passageImages,...this.__task.questionImages]:this.__task.questionImages
  const all=sources.length?sources:this.__task.images
  this.__images=[...new Map(all.map(image=>[image.url,image])).values()].sort((a,b)=>a.page-b.page)
  const imageIndex=Math.max(0,this.__images.findIndex(image=>image.page===q.page))
  this.setData({questions:[q],answer:String(draft.answers[q.id]||''),sourceImages:this.__images[imageIndex]?[this.__images[imageIndex]]:[],imageIndex,imageCount:this.__images.length,
   answered:Object.values(draft.answers).filter(v=>String(v).trim()).length,
   questionNav:this.__task.questions.map((item,index)=>({id:item.id,index,label:item.number||index+1,current:index===this.data.current,answered:Boolean(String(draft.answers[item.id]||'').trim())}))})
 },
 inputAnswer(event){if(!this.__draft||this.data.submitted||!this.currentOwner()||clockState(this.__examClock)?.expired)return;const value=String(event.detail.value||'').slice(0,160),q=this.__task.questions[this.data.current];this.__draft.answers[q.id]=value;this.setData({answer:value,answered:Object.values(this.__draft.answers).filter(v=>String(v).trim()).length,saveStatus:'正在保存…',error:''});this.scheduleSave()},
 scheduleSave(){clearTimeout(this.__saveTimer);this.__saveTimer=setTimeout(()=>this.flush(),180)},
 flush(){if(!this.__draft||!this.currentOwner())return;clearTimeout(this.__saveTimer);this.__draft.index=this.data.current;this.__draft.elapsed=this.elapsedSeconds();try{wx.setStorageSync(this.__storageKey,this.__draft);this.setData({saveStatus:'已保存'})}catch{this.setData({saveStatus:'尚未保存',error:'本机空间不足，请释放空间后重试。'})}},
 elapsedSeconds(){return clockState(this.__examClock)?.elapsed??((Number.isFinite(this.__baseElapsed)?this.__baseElapsed:this.__draft?.elapsed||0)+(this.__activeAt?Math.floor((Date.now()-this.__activeAt)/1000):0))},
 updateClock(){if(!this.currentOwner())return;const status=clockState(this.__examClock);this.setData({elapsed:status?status.label:clock(this.elapsedSeconds()),timeExpired:Boolean(status?.expired),timeLabel:status?'剩余时间':'用时'})},
 startClock(){clearInterval(this.__clock);if(!this.__draft)return;this.__baseElapsed=this.__draft.elapsed||0;this.__activeAt=this.__draft.submitted?null:Date.now();this.updateClock();if(!this.__draft.submitted)this.__clock=setInterval(()=>this.updateClock(),1000)},
 chooseQuestion(event){const index=Number(event.currentTarget.dataset.index);if(this.data.busy||!Number.isInteger(index)||index<0||index>=this.data.total)return;this.flush();this.setData({current:index,error:''});this.__draft.index=index;this.renderQuestion();this.scheduleSave()},
 nextQuestion(){this.chooseQuestion({currentTarget:{dataset:{index:Math.min(this.data.total-1,this.data.current+1)}}})},
 previousQuestion(){this.chooseQuestion({currentTarget:{dataset:{index:Math.max(0,this.data.current-1)}}})},
 jumpTo(event){const target=event.currentTarget.dataset.target==='answer'?'answer':'source';wx.pageScrollTo?.({selector:'.objective-'+target,offsetTop:-60,duration:150})},
 changeImage(event){const index=this.data.imageIndex+(event.currentTarget.dataset.direction==='previous'?-1:1);if(index<0||index>=this.__images.length)return;this.setData({imageIndex:index,sourceImages:[this.__images[index]]})},
 previewImage(){const current=this.data.sourceImages[0]?.url;if(current)wx.previewImage({current,urls:this.__images.map(image=>image.url)})},
 imageFailed(){this.setData({error:'题图未加载，请检查网络或点开原图重试。'})},
 async togglePassage(){const showPassage=!this.data.showPassage;this.setData({showPassage});if(!showPassage||this.data.passageText)return;try{const data=await requestIeltsJson('/api/reading/context?id='+encodeURIComponent(this.data.taskId),undefined,{method:'GET',timeout:12000});if(this.currentOwner())this.setData({passageText:String(data.paperText||'')})}catch(e){if(this.currentOwner())this.setData({error:e.message})}},
 initAudio(startAt=0){
  if(!this.data.audioAvailable||!wx.createInnerAudioContext)return
  const index=this.data.audioIndex,url=this.__preparedAudio?.index===index?this.__preparedAudio.path:''
  if(!url)return
  if(this.__audio&&this.__audioTrackIndex===index)return this.__audio
  const previous=this.__audio;this.__audio=null;this.__audioTrackIndex=-1;previous?.destroy()
  const audio=wx.createInnerAudioContext();this.__audio=audio;this.__audioTrackIndex=index;audio.obeyMuteSwitch=false;audio.startTime=Math.max(0,Number(startAt)||0)
  const active=()=>this.__audio===audio&&this.__audioTrackIndex===index&&this.currentOwner()&&this.__visible!==false
  audio.onPlay(()=>{if(active()){this.__audioWanted=true;this.setData({audioPlaying:true,audioBuffering:false})}else if(this.__audio===audio)audio.pause()})
  audio.onPause(()=>{if(active()){this.__audioWanted=false;this.setData({audioPlaying:false,audioBuffering:false})}})
  audio.onEnded(()=>{if(active()){this.__audioWanted=false;this.setData({audioPlaying:false,audioBuffering:false})}})
  audio.onWaiting?.(()=>{if(active()&&this.__audioWanted)this.setData({audioBuffering:true})})
  audio.onCanplay?.(()=>{if(active())this.setData({audioDuration:Math.floor(audio.duration||0),audioBuffering:false})})
  let updated=0
  audio.onTimeUpdate(()=>{
   if(!active())return
   if(Date.now()-updated>750){updated=Date.now();this.setData({audioPosition:Math.floor(audio.currentTime||0),audioDuration:Math.floor(audio.duration||0),audioBuffering:false})}
   this.updateCaptionFrame(audio.currentTime||0)
  })
  audio.onError(()=>{if(active()){this.__audioWanted=false;this.__audio=null;this.__audioTrackIndex=-1;audio.destroy();this.__audioCacheLease?.invalidate();this.cancelAudioPreparation();this.setData({audioPlaying:false,audioBuffering:false,audioError:'音频暂时无法播放，点击播放重试。'})}})
  audio.src=url
  return audio
 },
 cancelAudioPreparation(){this.__audioPrepareRevision=(this.__audioPrepareRevision||0)+1;this.__audioCacheLease?.release();this.__audioCacheLease=null;this.__preparedAudio=null;if(!this.__disposed)this.setData({audioPreparing:false,audioReady:false})},
 prepareAudio(){
  if(!this.currentOwner()||this.__visible===false||!this.data.audioAvailable)return
  if(this.data.audioPreparing)return this.__audioPreparation
  const index=this.data.audioIndex,url=this.__task.audioUrls[index]
  if(this.__preparedAudio?.index===index)return Promise.resolve(this.__preparedAudio.path)
  this.cancelAudioPreparation()
  const revision=this.__audioPrepareRevision,active=()=>this.currentOwner()&&this.__visible!==false&&revision===this.__audioPrepareRevision&&index===this.data.audioIndex
  this.setData({audioPreparing:true,audioError:'',audioDownloadPercent:null,audioDownloadedLabel:'0 KB',audioReady:false})
  try{
   const lease=acquireListeningAudio(url,{version:this.__task.contentVersion||'',onProgress:p=>{if(active())this.setData({audioDownloadPercent:p.percent,audioDownloadedLabel:p.bytes>=1048576?(p.bytes/1048576).toFixed(1)+' MB':Math.floor(p.bytes/1024)+' KB'})}})
   this.__audioCacheLease=lease
   this.__audioPreparation=lease.promise.then(path=>{
    if(!active()){lease.release();return}
    this.__preparedAudio={index,path};this.setData({audioPreparing:false,audioReady:true,audioDownloadPercent:100})
    if(this.__audioWanted){const audio=this.initAudio(this.data.audioPosition);audio?.play()}
    return path
   }).catch(()=>{if(active()){this.__audioWanted=false;this.setData({audioPreparing:false,audioPlaying:false,audioError:'音频准备失败，点击播放重试。'})}})
   return this.__audioPreparation
  }catch{this.__audioWanted=false;this.setData({audioPreparing:false,audioError:'音频准备失败，点击播放重试。'})}
 },
 toggleCaptions(){if(this.data.examMode)return;this.__captionRequest=(this.__captionRequest||0)+1;this.setData({captionsEnabled:!this.data.captionsEnabled,captionBubbles:[],captionStatus:''});if(this.data.captionsEnabled)this.loadCurrentCaptions()},
 async loadCurrentCaptions(){
  const request=(this.__captionRequest||0)+1;this.__captionRequest=request;this.__captionModel=null;this.__captionIndex=-2
  this.setData({captionStatus:'正在读取字幕…',captionBubbles:[]})
  try{const section=this.__task.audioSections?.[this.data.audioIndex]?.section||this.data.audioIndex+1;const model=await loadCaptions(this.data.taskId,section);if(!this.currentOwner()||request!==this.__captionRequest||!this.data.captionsEnabled)return;this.__captionModel=model;this.setData({captionStatus:''});this.updateCaptionFrame(this.__audio?.currentTime||0)}catch(e){if(this.currentOwner()&&request===this.__captionRequest)this.setData({captionStatus:e.message})}
 },
 updateCaptionFrame(time){if(!this.currentOwner()||!this.data.captionsEnabled||!this.__captionModel)return;const frame=captionFrame(this.__captionModel,time);if(frame.index!==this.__captionIndex){this.__captionIndex=frame.index;this.setData({captionBubbles:frame.bubbles,captionStatus:frame.index<0?'字幕将随语音出现':''})}},
 toggleAudio(){if(!this.currentOwner()||this.__visible===false)return;if(this.__audioWanted||this.data.audioPlaying){this.pauseAudio();return}this.__audioWanted=true;this.setData({audioError:'',audioWaitingToPlay:true});const audio=this.__audio||this.initAudio(this.data.audioPosition);if(audio)audio.play();else this.prepareAudio()},
 pauseAudio(){this.__audioWanted=false;this.__audio?.pause();if(!this.__disposed)this.setData({audioPlaying:false,audioWaitingToPlay:false,audioBuffering:false})},
 selectAudio(event){const index=Number(event.detail.value);if(!this.__task.audioUrls[index]||index===this.data.audioIndex)return;this.__audioWanted=false;const previous=this.__audio;this.__audio=null;this.__audioTrackIndex=-1;previous?.stop();previous?.destroy();this.cancelAudioPreparation();this.setData({audioIndex:index,audioPosition:0,audioDuration:0,audioPlaying:false,audioBuffering:false,audioWaitingToPlay:false,audioError:''});this.prepareAudio();if(this.data.captionsEnabled)this.loadCurrentCaptions()},
 seekAudio(event){const time=Math.max(0,Number(event.detail.value)||0),existing=this.__audio;existing?.seek(time);if(!existing&&this.__preparedAudio)this.initAudio(time);this.setData({audioPosition:Math.floor(time)});this.updateCaptionFrame(time)},
 async submit(){
  if(this.data.busy||this.data.submitted||!this.__draft||!this.currentOwner())return
  this.flush();this.pauseAudio();this.setData({busy:true,error:''})
  try{
   if(!this.__draft.capability){const capability=await requestIeltsLearning('/api/objective/attempts',{clientAttemptKey:this.__draft.clientAttemptKey,context:this.__exam?.context||'single',module,taskId:this.data.taskId,questionIds:this.__task.questions.map(q=>q.id),...(this.__exam?{examId:this.__exam.capability.examId,examToken:this.__exam.capability.examToken}:{})});if(!this.currentOwner())return;if(!capability.attemptId||!capability.attemptToken||capability.taskId!==this.data.taskId)throw new Error('试题提交状态未确认，请重试。');this.__draft.capability=capability;this.flush()}
   if(this.__examKey){completeExamModule(this.__examKey,module,{complete:true,submission:{...this.__draft.capability,taskId:this.data.taskId,answers:this.__draft.answers,questionIds:this.__task.questions.map(q=>q.id)}});this.__draft.submitted=true;this.setData({submitted:true});this.flush();clearInterval(this.__clock);return}
   const submitted=await requestIeltsLearning(`/api/${module}/score`,{...this.__draft.capability,taskId:this.data.taskId,answers:this.__draft.answers,questionIds:this.__task.questions.map(q=>q.id)})
   if(!this.currentOwner())return
   const result=submitted.result||submitted
   if(!Array.isArray(result.details)||typeof result.answerAvailable!=='boolean')throw new Error('未收到有效评分，答案已保留。')
   this.__draft.submitted=true;this.__draft.result={correct:result.correct,total:result.scoredTotal||result.total,band:this.__section?null:result.band,answerAvailable:result.answerAvailable};this.__draft.review=result.details
   this.setData({submitted:true,result:this.__draft.result,review:result.details.slice(0,10)});this.flush();clearInterval(this.__clock)
   rememberRecord({id:this.__draft.capability.attemptId,taskId:this.data.taskId,title:this.__task.title,skill:module,section:this.__section,category:'ielts',band:result.answerAvailable&&!this.__section?result.band:null,submittedAt:Date.now(),coachMode:'server'})
  }catch(e){if(this.currentOwner())this.setData({error:e.message})}finally{if(this.currentOwner())this.setData({busy:false})}
 },
 reviewMore(){if(!this.__draft)return;this.setData({review:this.__draft.review?.slice(0,Math.min(40,this.data.review.length+10))||[]})},
 openBack(){wx.navigateBack({fail:()=>wx.redirectTo({url:`/pages/ielts/library?module=${module}`})})},
 openFullWorkspace(){wx.navigateTo({url:`/pages/ielts/library?module=${module}`})},
 openAccount(){wx.navigateTo({url:'/pages/account/auth'})}
 ,getCoachContext(){
  if(!this.__task||this.data.examMode&&!this.data.submitted)return null
  const question=this.__task.questions[this.data.current]
  if(!question)return null
  const focusedQuestion={module,number:question.number,id:question.id},section=this.__section||this.__task.sections?.find(s=>s.questionIds.includes(question.id))?.number||1
  const playingSection=Number(this.__task.audioSections?.[this.data.audioIndex]?.section)||1
  return {product:'IELTSist',skill:module,taskId:this.data.taskId,title:this.__task.title,section,focusedQuestion,
   coach:{focusedQuestion},surface:{title:this.__task.title,module,view:'native-objective',viewLabel:module,mode:'practice',focusedQuestion},
   [module]:{id:this.data.taskId,title:this.__task.title,mode:'practice',questions:[{id:question.id,number:question.number,question:question.text,type:question.type,studentAnswer:this.data.answer}],paperText:this.data.passageText||'',activeSection:String(section),audioTime:playingSection===section?this.data.audioPosition:0}}
 }
}}
module.exports={makeObjectivePage}
