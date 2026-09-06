const {readAsJpegDataUrl}=require('../../utils/image')
const {deviceState,syncDevice,readDraft,scheduleDraft,cancelDraft,clearDraft}=require('../../utils/page')
const {getIeltsTask}=require('../../utils/ieltsContent')
const {startWritingFeedback,writingJob}=require('../../utils/ieltsWriting')
const {rememberRecord}=require('../../utils/nativeRecords')
const {readExam,completeExamModule,startExamModuleClock,clockState}=require('../../utils/nativeExam')
const {removeWritingPhoto}=require('../../utils/nativeWritingPhoto')
const {IELTS_API_BASE}=require('../../utils/api')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0

Page({
 data:deviceState({text:'',inputMode:'typed',prompt:'',taskId:'',taskTitle:'',taskImages:[],photoPath:'',taskType:'Task 2',loading:false,error:'',canRetry:false,authRequired:false,answer:'',warning:'',coachStatus:'',draftStatus:'自动保存',band:null,criteria:[],reportUrl:''}),
 onLoad(options={}){
  this.__disposed=false;this.__valid=false;this.__generation=0;this.__owner=owner();this.__epoch=epoch()
  const taskId=String(options.taskId||'')
  this.__examKey=String(options.examKey||'')
  if(this.__examKey){const exam=readExam(this.__examKey);if(!exam||!exam.sources.writing.includes(taskId)){this.setData({error:'写作题目不属于当前模拟。'});return}this.__examModule=exam.sources.writing[0]===taskId?'writing1':'writing2'}
  this.__scope=(taskId?'ielts-writing:'+taskId:'writing')+(this.__examKey?':'+this.__examKey:'')
  this.__valid=true
  if(this.__examKey){this.__examClock=startExamModuleClock(this.__examKey,this.__examModule,60);this.__timer=setInterval(()=>this.updateClock(),1000);this.updateClock()}
  const saved=readDraft(this.__scope)||{}
  const draft=(!saved.owner&&this.__owner==='guest')||saved.owner===this.__owner&&saved.epoch===this.__epoch?saved:{}
  this.__jobId=String(draft.jobId||'')
  this.setData({taskId,examMode:Boolean(this.__examKey),inputMode:draft.inputMode==='photo'?'photo':'typed',text:draft.text||'',prompt:draft.prompt||'',photoPath:draft.photoPath||'',taskType:draft.taskType||'Task 2',draftStatus:draft.text?'已恢复作文':'自动保存',answer:draft.answer||'',band:draft.band??null,criteria:draft.criteria||[],warning:draft.warning||'',reportUrl:draft.reportUrl||'',canRetry:Boolean(this.__jobId),coachStatus:this.__jobId?'上次批改待查询':''})
  if(taskId)this.loadTask()
 },
 onShow(){
  syncDevice(this)
  if(this.__authResumeRequested&&wx.getStorageSync('stemistSessionToken')&&owner()!=='guest'&&(this.__owner==='guest'||this.__owner===owner())){
   this.__owner=owner();this.__epoch=epoch();this.__generation++;this.__authResumeRequested=false;this.setData({authRequired:false,error:'',canRetry:false});this.saveDraft()
  }
  if(this.__valid&&!this.current()){this.setData({text:'',photoPath:'',answer:'',criteria:[],band:null,reportUrl:'',error:'账号已变化，请重新打开这道题目。',canRetry:false,authRequired:false});return}
  if(this.__examClock){clearInterval(this.__timer);this.updateClock();this.__timer=setInterval(()=>this.updateClock(),1000)}
  const photo=wx.getStorageSync('stemistWritingPhoto')
  const photoMeta=wx.getStorageSync('stemistWritingPhotoMeta')
  if(photo&&this.current()&&!this.data.loading&&((!photoMeta&&this.__owner==='guest')||photoMeta?.owner===this.__owner&&photoMeta.epoch===this.__epoch&&photoMeta.scope===this.__scope)){
   const previous=this.data.photoPath
   this.__jobId='';this.setData({photoPath:photo,inputMode:'photo',error:'',answer:'',band:null,criteria:[],reportUrl:'',warning:'',coachStatus:'',canRetry:false,authRequired:false,draftStatus:'照片已保存'})
   wx.removeStorageSync('stemistWritingPhoto');wx.removeStorageSync('stemistWritingPhotoMeta');this.saveDraft();cancelDraft(this)
   if(previous&&previous!==photo)removeWritingPhoto(previous)
  }
  if(this.__jobId&&!this.data.loading&&!this.__resumeQueryStarted&&this.current()){
   this.__resumeQueryStarted=true;this.submit()
  }
 },
 onResize(){syncDevice(this)},
 onHide(){cancelDraft(this);clearInterval(this.__timer)},
 onUnload(){this.__disposed=true;this.__generation++;clearInterval(this.__timer);clearTimeout(this.__pollTimer);this.__pollResolve?.();this.__pollResolve=null;cancelDraft(this)},
 updateClock(){if(!this.current())return;const clock=clockState(this.__examClock);if(clock)this.setData({remaining:clock.label,timeExpired:clock.expired})},
 current(){return !this.__disposed&&this.__valid&&this.__owner===owner()&&this.__epoch===epoch()},
 async loadTask(){
  try{
   const task=await getIeltsTask('writing',this.data.taskId)
   if(!this.current())return
   this.setData({taskTitle:task.title,taskImages:task.images.slice(0,4),taskType:/1/.test(task.type)||/task1$/i.test(task.id)?'Task 1':'Task 2',prompt:task.prompt||task.data})
   this.saveDraft()
  }catch(e){if(this.current())this.setData({error:e.message})}
 },
 saveDraft(){
  if(!this.current())return
  const {text,inputMode,prompt,photoPath,taskType,taskId,answer,band,criteria,warning,reportUrl}=this.data
  scheduleDraft(this,this.__scope,{owner:this.__owner,epoch:this.__epoch,text,inputMode,prompt,photoPath,taskType,taskId,answer,band,criteria,warning,reportUrl,jobId:this.__jobId})
 },
  onInput(event){if(this.data.loading||!this.current()||clockState(this.__examClock)?.expired)return;this.__jobId='';this.setData({text:String(event.detail.value||''),error:'',draftStatus:'正在保存…',answer:'',band:null,criteria:[],reportUrl:''});this.saveDraft()},
  onPromptInput(event){if(this.data.loading||!this.current()||clockState(this.__examClock)?.expired)return;this.__jobId='';this.setData({prompt:String(event.detail.value||''),error:'',answer:'',band:null,criteria:[],reportUrl:''});this.saveDraft()},
 chooseTask(event){if(this.data.loading||this.data.taskId)return;this.setData({taskType:event.currentTarget.dataset.task});this.saveDraft()},
 chooseInputMode(event){const inputMode=event.currentTarget.dataset.mode;if(!this.current()||this.data.loading||clockState(this.__examClock)?.expired||!['typed','photo'].includes(inputMode)||inputMode===this.data.inputMode)return;this.__jobId='';this.setData({inputMode,answer:'',band:null,criteria:[],warning:'',reportUrl:'',error:'',canRetry:false,authRequired:false,coachStatus:''});this.saveDraft()},
  takePhoto(){if(this.data.loading||!this.current()||clockState(this.__examClock)?.expired)return;wx.setStorageSync('stemistCameraReturn',{route:'writing',context:{product:'IELTSist',skill:'writing',writingScope:this.__scope,writingTaskId:this.data.taskId,writingExamKey:this.__examKey},createdAt:Date.now()});wx.navigateTo({url:'/pages/stem/camera',fail:()=>this.setData({error:'相机未能打开，请重试。'})})},
 previewTask(event){const current=this.data.taskImages[Number(event.currentTarget.dataset.index)]?.url;if(current)wx.previewImage({current,urls:this.data.taskImages.map(i=>i.url)})},
 previewPhoto(){if(this.current()&&this.data.photoPath)wx.previewImage({current:this.data.photoPath,urls:[this.data.photoPath]})},
 async submit(){
  if(this.data.loading||!this.current())return
  const photoMode=this.data.inputMode==='photo',text=photoMode?'':this.data.text.trim(),prompt=this.data.prompt.trim()
  if(photoMode?!this.data.photoPath:!text)return this.setData({error:photoMode?'请先拍摄作文。':'请先输入作文。'})
  this.setData({loading:true,error:'',canRetry:false,answer:'',band:null,criteria:[],warning:'',coachStatus:photoMode?'正在提交照片批改…':'正在提交作文…'})
  const generation=++this.__generation
  try{
   if(!prompt)throw new Error('请先选择题目或填写写作要求。')
   if(this.__examKey){completeExamModule(this.__examKey,this.__examModule,{complete:true,title:this.data.taskTitle,prompt,essay:text,photoPath:photoMode?this.data.photoPath:''});this.saveDraft();this.setData({coachStatus:'本项已保存，请返回模拟继续',draftStatus:'已保存'});return}
   if(!this.__jobId){const imageDataUrls=photoMode?[await readAsJpegDataUrl(this.data.photoPath)]:[];if(!this.current()||generation!==this.__generation)return;this.__jobId=await startWritingFeedback(prompt,text,this.data.taskId,imageDataUrls)}
   if(!this.current()||generation!==this.__generation)return
   this.saveDraft();cancelDraft(this)
   this.setData({coachStatus:'正在批改，作文已保存…'})
   await this.pollFeedback(generation,Date.now())
  }catch(e){if(this.current()&&generation===this.__generation){if(e.terminalJob||e.statusCode===404)this.__jobId='';this.saveDraft();this.setData({error:e.message||'批改未完成，作文已保留。',canRetry:Number(e.statusCode)!==401,authRequired:Number(e.statusCode)===401,coachStatus:'尚未完成批改'})}}
  finally{if(this.current()&&generation===this.__generation)this.setData({loading:false})}
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
 ,getCoachContext(){if(!this.current()||this.data.examMode)return null;const photo=this.data.inputMode==='photo';return {product:'IELTSist',skill:'writing',taskId:this.data.taskId,title:this.data.taskTitle||this.data.taskType,...(photo&&this.data.photoPath?{imagePaths:[this.data.photoPath]}:{}),surface:{title:this.data.taskTitle||this.data.taskType,module:'writing',view:'native-writing',mode:'practice'},contextText:['Writing task:',this.data.prompt,'Student draft:',photo?'See the attached photograph.':this.data.text].join('\n').slice(0,18000)}}
})
