const {readAsJpegDataUrl}=require('../../utils/image')
const {deviceState,syncDevice,readDraft,scheduleDraft,cancelDraft,clearDraft}=require('../../utils/page')
const {getIeltsTask}=require('../../utils/ieltsContent')
const {startWritingFeedback,writingJob}=require('../../utils/ieltsWriting')
const {rememberRecord}=require('../../utils/nativeRecords')
const {readExam,completeExamModule,startExamModuleClock,clockState}=require('../../utils/nativeExam')
const {removeWritingPhoto}=require('../../utils/nativeWritingPhoto')
const {archiveWritingSource,hasWritingSourceArchives}=require('../../utils/writingSourceArchive')
const {IELTS_API_BASE}=require('../../utils/api')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const CAMBRIDGE_WRITING=/^cam\d+-w-test\d+-task[12]$/
const SOURCE_REVISION=/^[a-f0-9]{64}$/
const hasWork=(draft,jobId='')=>Boolean(String(draft.text||'').trim()||draft.photoPath||draft.answer||draft.warning||draft.reportUrl||Array.isArray(draft.criteria)&&draft.criteria.length||jobId||draft.band!==undefined&&draft.band!==null)

Page({
 data:deviceState({text:'',inputMode:'typed',prompt:'',taskId:'',taskTitle:'',taskImages:[],photoPath:'',taskType:'Task 2',loading:false,error:'',canRetry:false,authRequired:false,answer:'',warning:'',coachStatus:'',draftStatus:'自动保存',band:null,criteria:[],reportUrl:'',remaining:'60:00',timeExpired:false,sourceGuarded:false,sourceResolved:true,sourceAvailability:'ready',sourceRevision:'',sourceReviewRequired:false,sourcePreview:false,latestPrompt:'',latestTaskImages:[],latestSourceRevision:'',latestSourceAvailability:'',sourceArchiveNotice:''}),
 onLoad(options={}){
  this.__disposed=false;this.__valid=false;this.__generation=0;this.__owner=owner();this.__epoch=epoch()
  const taskId=String(options.taskId||'')
  const sourceGuarded=CAMBRIDGE_WRITING.test(taskId);this.__taskResolved=!sourceGuarded;this.__latestTask=null;this.__resumeQueryStarted=false
  this.__examKey=String(options.examKey||'')
  if(this.__examKey){const exam=readExam(this.__examKey);if(!exam||!exam.sources.writing.includes(taskId)){this.setData({error:'写作题目不属于当前模拟。'});return}this.__examModule=exam.sources.writing[0]===taskId?'writing1':'writing2';this.__examClock=exam.clocks?.writing||null}
  this.__scope=(taskId?'ielts-writing:'+taskId:'writing')+(this.__examKey?':'+this.__examKey:'')
  this.__valid=true
  if(this.__examClock){this.__timer=setInterval(()=>this.updateClock(),1000);this.updateClock()}
  const saved=readDraft(this.__scope)||{}
  const draft=(!saved.owner&&this.__owner==='guest')||saved.owner===this.__owner&&saved.epoch===this.__epoch?saved:{}
  this.__jobId=String(draft.jobId||'')
  this.__sourceArchiveRef=draft.sourceArchiveRef||null
  this.setData({taskId,examMode:Boolean(this.__examKey),inputMode:draft.inputMode==='photo'?'photo':'typed',text:draft.text||'',prompt:draft.prompt||'',taskImages:Array.isArray(draft.taskImages)?draft.taskImages:[],photoPath:draft.photoPath||'',taskType:draft.taskType||'Task 2',draftStatus:draft.text||draft.photoPath?'已恢复作文':'自动保存',answer:draft.answer||'',band:draft.band??null,criteria:draft.criteria||[],warning:draft.warning||'',reportUrl:draft.reportUrl||'',canRetry:Boolean(this.__jobId),coachStatus:this.__jobId?'上次批改待查询':'',sourceGuarded,sourceResolved:!sourceGuarded,sourceAvailability:sourceGuarded?'pending-review':'ready',sourceRevision:SOURCE_REVISION.test(String(draft.sourceRevision||''))?String(draft.sourceRevision):'',sourceArchiveNotice:this.__sourceArchiveRef||hasWritingSourceArchives(this.__scope,this.__owner,this.__epoch)?'旧题批改记录已保留。':''})
  if(taskId)this.loadTask()
 },
 onShow(){
  syncDevice(this)
  if(this.__authResumeRequested&&wx.getStorageSync('stemistSessionToken')&&owner()!=='guest'&&(this.__owner==='guest'||this.__owner===owner())){
   this.__owner=owner();this.__epoch=epoch();this.__generation++;this.__authResumeRequested=false;this.setData({authRequired:false,error:'',canRetry:false});this.saveDraft()
  }
  if(this.__valid&&!this.current()){this.__generation++;this.__jobId='';this.__sourceArchiveRef=null;this.__latestTask=null;this.__taskResolved=false;this.__resumeQueryStarted=true;this.setData({text:'',inputMode:'typed',prompt:'',taskTitle:'',taskImages:[],photoPath:'',answer:'',criteria:[],band:null,warning:'',reportUrl:'',coachStatus:'',draftStatus:'',error:'账号已变化，请重新打开这道题目。',canRetry:false,authRequired:false,sourceResolved:false,sourceAvailability:'pending-review',sourceRevision:'',sourceReviewRequired:false,sourcePreview:false,latestPrompt:'',latestTaskImages:[],latestSourceRevision:'',latestSourceAvailability:'',sourceArchiveNotice:''});return}
  if(this.__examClock){clearInterval(this.__timer);this.updateClock();this.__timer=setInterval(()=>this.updateClock(),1000)}
  const photo=wx.getStorageSync('stemistWritingPhoto')
  const photoMeta=wx.getStorageSync('stemistWritingPhotoMeta')
  if(photo&&this.current()&&!this.data.loading&&((!photoMeta&&this.__owner==='guest')||photoMeta?.owner===this.__owner&&photoMeta.epoch===this.__epoch&&photoMeta.scope===this.__scope)){
   const previous=this.data.photoPath
   this.__jobId='';this.setData({photoPath:photo,inputMode:'photo',error:'',answer:'',band:null,criteria:[],reportUrl:'',warning:'',coachStatus:'',canRetry:false,authRequired:false,draftStatus:'照片已保存'})
   wx.removeStorageSync('stemistWritingPhoto');wx.removeStorageSync('stemistWritingPhotoMeta');this.saveDraft();cancelDraft(this)
   if(previous&&previous!==photo)removeWritingPhoto(previous)
  }
  this.resumePendingJob()
 },
 onResize(){syncDevice(this)},
 onHide(){cancelDraft(this);clearInterval(this.__timer)},
 onUnload(){this.__disposed=true;this.__generation++;clearInterval(this.__timer);clearTimeout(this.__pollTimer);this.__pollResolve?.();this.__pollResolve=null;cancelDraft(this)},
 updateClock(){if(!this.current())return;const clock=clockState(this.__examClock);if(clock)this.setData({remaining:clock.label,timeExpired:clock.expired})},
 current(){return !this.__disposed&&this.__valid&&this.__owner===owner()&&this.__epoch===epoch()},
 sourceReady(){return !this.data.sourceGuarded||this.__taskResolved&&this.data.sourceAvailability==='ready'&&SOURCE_REVISION.test(this.data.sourceRevision)&&!this.data.sourceReviewRequired},
 ensureExamClock(){if(!this.__examKey||this.__examClock||!this.current()||!this.sourceReady())return;this.__examClock=startExamModuleClock(this.__examKey,this.__examModule,60);clearInterval(this.__timer);this.updateClock();this.__timer=setInterval(()=>this.updateClock(),1000)},
 resumePendingJob(){if(this.__jobId&&!this.data.loading&&!this.__resumeQueryStarted&&this.current()&&this.sourceReady()){this.__resumeQueryStarted=true;this.submit()}},
 async loadTask({refresh=false,forceReview=false,forcePending=false}={}){
  try{
   const task=await getIeltsTask('writing',this.data.taskId,{refresh})
   if(!this.current())return
   const revision=SOURCE_REVISION.test(String(task.sourceRevision||''))?String(task.sourceRevision):''
   const availability=!forcePending&&task.sourceAvailability==='ready'&&revision?'ready':'pending-review'
   const latest={...task,sourceRevision:revision,sourceAvailability:availability};this.__latestTask=latest;this.__taskResolved=true
   const changed=availability==='ready'&&hasWork(this.data,this.__jobId)&&(forceReview||!this.data.sourceRevision||this.data.sourceRevision!==revision)
   const common={taskTitle:task.title,taskType:/1/.test(task.type)||/task1$/i.test(task.id)?'Task 1':'Task 2',sourceResolved:true,sourceAvailability:availability,latestSourceAvailability:availability,latestSourceRevision:revision}
   if(changed)this.setData({...common,sourceReviewRequired:true,sourcePreview:false,latestPrompt:task.prompt||task.data||'',latestTaskImages:(task.images||[]).slice(0,4),coachStatus:'题目来源已更新，确认前不会重新批改',canRetry:false,error:''})
   else if(availability==='ready')this.setData({...common,sourceReviewRequired:false,sourcePreview:false,prompt:task.prompt||task.data||'',taskImages:(task.images||[]).slice(0,4),sourceRevision:revision,latestPrompt:'',latestTaskImages:[],error:''})
   else this.setData({...common,sourceReviewRequired:false,sourcePreview:false,latestPrompt:'',latestTaskImages:[],coachStatus:'题目正在核验，作文已保留',canRetry:false,error:'这道题正在核验，暂不提交批改。',...(hasWork(this.data,this.__jobId)?{}:{prompt:'',taskImages:[],sourceRevision:revision})})
   this.ensureExamClock();this.saveDraft();this.resumePendingJob()
  }catch(e){if(this.current()){this.__taskResolved=false;this.setData({sourceResolved:false,sourceAvailability:'pending-review',error:e.message||'题目来源未能确认，作文已保留。',coachStatus:'题目来源尚未确认',canRetry:false})}}
 },
 saveDraft(){
  if(!this.current())return
  const {text,inputMode,prompt,taskImages,photoPath,taskType,taskId,answer,band,criteria,warning,reportUrl,sourceAvailability,sourceRevision}=this.data
  scheduleDraft(this,this.__scope,{owner:this.__owner,epoch:this.__epoch,text,inputMode,prompt,taskImages,photoPath,taskType,taskId,answer,band,criteria,warning,reportUrl,jobId:this.__jobId,sourceAvailability,sourceRevision,sourceArchiveRef:this.__sourceArchiveRef})
 },
  onInput(event){if(this.data.loading||!this.current()||!this.sourceReady()||clockState(this.__examClock)?.expired)return;this.__jobId='';this.setData({text:String(event.detail.value||''),error:'',draftStatus:'正在保存…',answer:'',band:null,criteria:[],reportUrl:''});this.saveDraft()},
  onPromptInput(event){if(this.data.loading||!this.current()||!this.sourceReady()||clockState(this.__examClock)?.expired)return;this.__jobId='';this.setData({prompt:String(event.detail.value||''),error:'',answer:'',band:null,criteria:[],reportUrl:''});this.saveDraft()},
 chooseTask(event){if(this.data.loading||this.data.taskId)return;this.setData({taskType:event.currentTarget.dataset.task});this.saveDraft()},
 chooseInputMode(event){const inputMode=event.currentTarget.dataset.mode;if(!this.current()||this.data.loading||!this.sourceReady()||clockState(this.__examClock)?.expired||!['typed','photo'].includes(inputMode)||inputMode===this.data.inputMode)return;this.__jobId='';this.setData({inputMode,answer:'',band:null,criteria:[],warning:'',reportUrl:'',error:'',canRetry:false,authRequired:false,coachStatus:''});this.saveDraft()},
  takePhoto(){if(this.data.loading||!this.current()||!this.sourceReady()||clockState(this.__examClock)?.expired)return;wx.setStorageSync('stemistCameraReturn',{route:'writing',context:{product:'IELTSist',skill:'writing',writingScope:this.__scope,writingTaskId:this.data.taskId,writingExamKey:this.__examKey},createdAt:Date.now()});wx.navigateTo({url:'/pages/stem/camera',fail:()=>this.setData({error:'相机未能打开，请重试。'})})},
 previewTask(event){const current=this.data.taskImages[Number(event.currentTarget.dataset.index)]?.url;if(current)wx.previewImage({current,urls:this.data.taskImages.map(i=>i.url)})},
 previewLatestSource(event){const current=this.data.latestTaskImages[Number(event.currentTarget.dataset.index)]?.url;if(current)wx.previewImage({current,urls:this.data.latestTaskImages.map(i=>i.url)})},
 previewPhoto(){if(this.current()&&this.data.photoPath)wx.previewImage({current:this.data.photoPath,urls:[this.data.photoPath]})},
 async submit(){
  if(this.data.loading||!this.current())return
  if(!this.sourceReady())return this.setData({error:this.data.sourceReviewRequired?'请先查看新题并确认，再提交批改。':this.data.sourceResolved?'这道题正在核验，作文已保留，暂不提交批改。':'题目来源尚未确认，请检查网络后重试。',canRetry:false,coachStatus:'作文和照片已保留'})
  const photoMode=this.data.inputMode==='photo',text=photoMode?'':this.data.text.trim(),prompt=this.data.prompt.trim()
  if(photoMode?!this.data.photoPath:!text)return this.setData({error:photoMode?'请先拍摄作文。':'请先输入作文。'})
  this.setData({loading:true,error:'',canRetry:false,answer:'',band:null,criteria:[],warning:'',coachStatus:photoMode?'正在提交照片批改…':'正在提交作文…'})
  const generation=++this.__generation
  try{
   if(!prompt)throw new Error('请先选择题目或填写写作要求。')
   if(this.__examKey){completeExamModule(this.__examKey,this.__examModule,{complete:true,title:this.data.taskTitle,prompt,essay:text,photoPath:photoMode?this.data.photoPath:'',sourceAvailability:this.data.sourceAvailability,sourceRevision:this.data.sourceRevision});this.saveDraft();this.setData({coachStatus:'本项已保存，请返回模拟继续',draftStatus:'已保存'});return}
   if(!this.__jobId){const imageDataUrls=photoMode?[await readAsJpegDataUrl(this.data.photoPath)]:[];if(!this.current()||generation!==this.__generation)return;this.__jobId=await startWritingFeedback(prompt,text,this.data.taskId,imageDataUrls,this.data.sourceRevision)}
   if(!this.current()||generation!==this.__generation)return
   this.saveDraft();cancelDraft(this)
   this.setData({coachStatus:'正在批改，作文已保存…'})
   await this.pollFeedback(generation,Date.now())
  }catch(e){if(this.current()&&generation===this.__generation){if(e.code==='writing_source_changed'||e.code==='writing_source_review_required'){await this.handleSourceError(e)}else{if(e.terminalJob||e.statusCode===404)this.__jobId='';this.saveDraft();this.setData({error:e.message||'批改未完成，作文已保留。',canRetry:Number(e.statusCode)!==401,authRequired:Number(e.statusCode)===401,coachStatus:'尚未完成批改'})}}}
  finally{if(this.current()&&generation===this.__generation)this.setData({loading:false})}
 },
 async handleSourceError(error){
  const changed=error.code==='writing_source_changed'
  this.__taskResolved=!changed
  this.setData({sourceResolved:!changed,sourceAvailability:'pending-review',sourceReviewRequired:false,sourcePreview:false,error:error.message||'题目来源已变化，作文已保留。',coachStatus:'作文和照片已保留',canRetry:false})
  this.saveDraft();cancelDraft(this)
  if(this.data.sourceGuarded)await this.loadTask({refresh:true,forceReview:changed,forcePending:!changed})
 },
 viewSourceUpdate(){if(!this.current()||!this.data.sourceReviewRequired)return;this.setData({sourcePreview:!this.data.sourcePreview})},
 confirmSourceUpdate(){
  if(!this.current()||!this.data.sourceReviewRequired||!this.data.sourcePreview||!this.__latestTask||this.__latestTask.sourceAvailability!=='ready'||!SOURCE_REVISION.test(this.__latestTask.sourceRevision))return
  const previousData={...this.data},previousJob=this.__jobId,previousRef=this.__sourceArchiveRef
  let archiveRef
  try{archiveRef=archiveWritingSource(this.__scope,this.__owner,this.__epoch,{sourceRevision:this.data.sourceRevision,prompt:this.data.prompt,taskImages:this.data.taskImages,text:this.data.text,inputMode:this.data.inputMode,photoPath:this.data.photoPath,feedback:this.data.answer,band:this.data.band,criteria:this.data.criteria,warning:this.data.warning,reportUrl:this.data.reportUrl,jobId:this.__jobId})}catch(error){this.setData({error:error.message||'旧稿保存失败，题目尚未切换。'});return}
  this.__sourceArchiveRef=archiveRef;this.__jobId='';this.__resumeQueryStarted=false
  this.setData({prompt:this.__latestTask.prompt||this.__latestTask.data||'',taskImages:(this.__latestTask.images||[]).slice(0,4),sourceAvailability:'ready',sourceRevision:this.__latestTask.sourceRevision,sourceReviewRequired:false,sourcePreview:false,latestPrompt:'',latestTaskImages:[],latestSourceRevision:'',latestSourceAvailability:'',answer:'',band:null,criteria:[],warning:'',reportUrl:'',canRetry:false,authRequired:false,error:'',coachStatus:'已改用新题，旧题批改记录已保留',draftStatus:'作文与照片已保留',sourceArchiveNotice:'旧题批改记录已保留。'})
  try{this.saveDraft();cancelDraft(this)}catch(error){this.__sourceArchiveRef=previousRef;this.__jobId=previousJob;this.__resumeQueryStarted=false;this.setData({...previousData,error:'旧稿虽已归档，但当前题目状态保存失败；题目尚未切换，请释放存储空间后重试。'});return}
  this.ensureExamClock()
 },
 async pollFeedback(generation,started){
  while(this.current()&&generation===this.__generation){
   const job=await writingJob(this.__jobId)
   if(!this.current()||generation!==this.__generation)return
   if(job.status==='done'){
    const result=job.result,jobId=this.__jobId
    this.__jobId=''
    this.setData({answer:result.feedback,band:result.band,criteria:result.criteria,warning:result.warning,reportUrl:result.reportUrl||'',canRetry:!result.ai||result.gradeReady===false,coachStatus:!result.ai?'基础建议':result.gradeReady===false?'反馈待复核':'AI 批改完成',draftStatus:'作文与反馈已保存'})
    this.saveDraft()
    const record={id:'writing-'+jobId,category:'ielts',skill:'writing',taskId:this.data.taskId,title:this.data.taskTitle||this.data.taskType,inputMode:this.data.inputMode,text:this.data.inputMode==='photo'?'':this.data.text,prompt:this.data.prompt,answer:result.feedback,band:result.band,coachMode:result.ai?'ai':'local',submittedAt:Date.now()}
    wx.setStorageSync('stemistSubmission:writing',record);rememberRecord(record)
    return
   }
   if(Date.now()-started>210000){this.setData({canRetry:true,coachStatus:'批改仍在进行，可稍后继续查看。'});return}
   await new Promise(resolve=>{this.__pollResolve=resolve;this.__pollTimer=setTimeout(resolve,1800)})
  }
 },
 retry(){return this.submit()},
 downloadReport(){
  if(!/^\/api\/report\/pdf\/[a-zA-Z0-9_-]+$/.test(this.data.reportUrl)||this.data.downloading||!this.current())return
  this.setData({downloading:true,error:''})
  wx.downloadFile({url:IELTS_API_BASE+this.data.reportUrl,timeout:20000,success:result=>{
   if(!this.current())return
   if(result.statusCode!==200)return this.setData({error:'报告下载链接已失效，作文与反馈仍保留。',downloading:false})
   wx.openDocument({filePath:result.tempFilePath,fileType:'pdf',showMenu:true,fail:()=>{if(this.current())this.setData({error:'当前设备无法打开 PDF 报告。'})},complete:()=>{if(this.current())this.setData({downloading:false})}})
  },fail:()=>{if(this.current())this.setData({downloading:false,error:'下载未完成，请检查网络后重试。'})}})
 },
 openAccount(){this.__authResumeRequested=true;wx.navigateTo({url:'/pages/account/auth'})},
 openFullWorkspace(){wx.navigateTo({url:'/pages/ielts/library?module=writing'})},
 clear(){
  if(this.data.loading)return
  wx.showModal({title:'清空当前作文？',confirmText:'清空',success:({confirm})=>{
   if(!confirm||!this.current())return
   const photo=this.data.photoPath
   clearDraft(this.__scope);this.__jobId=''
   this.setData({text:'',inputMode:'typed',photoPath:'',answer:'',band:null,criteria:[],reportUrl:'',warning:'',error:'',canRetry:false,coachStatus:'',draftStatus:'已清空'})
   if(photo)removeWritingPhoto(photo)
  }})
 },
 openBack(){wx.navigateBack()}
 ,getCoachContext(){if(!this.current()||this.data.examMode)return null;const photo=this.data.inputMode==='photo',guarded=this.data.sourceGuarded&&!this.sourceReady();return {product:'IELTSist',skill:'writing',taskId:guarded?'':this.data.taskId,title:guarded?'Writing':this.data.taskTitle||this.data.taskType,...(photo&&this.data.photoPath?{imagePaths:[this.data.photoPath]}:{}),surface:{title:guarded?'Writing':this.data.taskTitle||this.data.taskType,module:'writing',view:'native-writing',mode:'practice'},contextText:(guarded?['Student draft:',photo?'See the attached photograph.':this.data.text]:['Writing task:',this.data.prompt,'Student draft:',photo?'See the attached photograph.':this.data.text]).join('\n').slice(0,18000)}}
})
