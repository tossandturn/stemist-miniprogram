const {deviceState,syncDevice,readDraft,scheduleDraft,cancelDraft,clearDraft}=require('../../utils/page')
const {loadIeltsContent,getIeltsTask}=require('../../utils/ieltsContent')
const {writingPairs,startWritingPairFeedback,writingJob}=require('../../utils/ieltsWriting')
const {createClock,clockState}=require('../../utils/practiceClock')
const {readAsJpegDataUrl}=require('../../utils/image')
const {rememberRecord}=require('../../utils/nativeRecords')
const {removeWritingPhoto}=require('../../utils/nativeWritingPhoto')
const {archiveWritingSource,hasWritingSourceArchives}=require('../../utils/writingSourceArchive')
const {IELTS_API_BASE}=require('../../utils/api')
const owner=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const SOURCE_REVISION=/^[a-f0-9]{64}$/
const sourceReady=task=>task?.sourceAvailability==='ready'&&SOURCE_REVISION.test(String(task.sourceRevision||''))
const hasDraftWork=draft=>Boolean(draft.jobId||draft.feedback||draft.warning||draft.reportUrl||draft.band!==undefined&&draft.band!==null||(draft.taskScores||[]).length||(draft.items||[]).some(item=>String(item?.text||'').trim()||item?.photo))
const emptyResult=()=>({feedback:'',band:null,taskScores:[],warning:'',reportUrl:'',canRetry:false})
Page({
 data:deviceState({loading:true,busy:false,error:'',authRequired:false,pairId:'',title:'完整写作',items:[],remaining:'60:00',timeExpired:false,phase:'draft',...emptyResult(),status:'自动保存',downloading:false,sourceResolved:false,sourceAvailability:'pending-review',sourceReviewRequired:false,sourcePreview:false,sourceArchiveNotice:''}),
 onLoad(options={}){this.__disposed=false;this.__owner=owner();this.__epoch=epoch();this.__resumeQueryStarted=false;this.setData({pairId:String(options.pairId||'')});this.__scope='writing-pair:'+this.__owner+':'+this.data.pairId;this.load()},
 current(){return !this.__disposed&&this.__owner===owner()&&this.__epoch===epoch()},
 sourceReady(){return this.data.sourceResolved&&this.data.sourceAvailability==='ready'&&!this.data.sourceReviewRequired&&this.data.items.length===2&&this.data.items.every(item=>SOURCE_REVISION.test(String(item.sourceRevision||'')))},
 editable(){return this.current()&&this.sourceReady()&&!this.data.busy&&this.data.phase==='draft'&&!clockState(this.__clock)?.expired},
 resumePendingJob(){if(this.__jobId&&!this.data.busy&&!this.__resumeQueryStarted&&this.current()&&this.sourceReady()){this.__resumeQueryStarted=true;this.submit()}},
 async load(refresh=false,forceReview=false,forcePending=false){
  try{
   const bank=await loadIeltsContent(refresh?{refresh:true}:{}),pair=writingPairs(bank.writing).find(p=>p.id===this.data.pairId)
   if(!pair)throw new Error('未找到完整写作题组。')
   const tasks=await Promise.all(pair.items.map(id=>getIeltsTask('writing',id,refresh?{refresh:true}:{})))
   if(!this.current())return
   this.__tasks=tasks;const draft=readDraft(this.__scope)||{}
   this.__jobId=draft.jobId||'';this.__sourceArchiveRef=draft.sourceArchiveRef||null
   const phase=this.__jobId?'pending':draft.feedback?'done':'draft'
   const ready=!forcePending&&tasks.every(sourceReady),work=hasDraftWork(draft),changed=ready&&work&&(forceReview||tasks.some((task,index)=>draft.items?.[index]?.sourceRevision!==task.sourceRevision))
   this.__clock=clockState(draft.clock)?draft.clock:ready&&!changed?createClock(60):null
   if(this.__clock&&phase==='draft')delete this.__clock.finishedAt
   const preserve=work&&(changed||!ready)
   const items=tasks.map((task,index)=>{const saved=draft.items?.[index]||{};return {id:task.id,number:index+1,prompt:preserve?String(saved.prompt||''):task.prompt||task.data||'',images:preserve&&Array.isArray(saved.sourceImages)?saved.sourceImages:preserve?[]:task.images||[],text:saved.text||'',photo:saved.photo||'',inputMode:saved.inputMode==='photo'?'photo':'typed',sourceAvailability:task.sourceAvailability,sourceRevision:preserve?String(saved.sourceRevision||''):task.sourceRevision,latestPrompt:changed?task.prompt||task.data||'':'',latestImages:changed?task.images||[]:[],latestSourceRevision:changed?task.sourceRevision:'',latestSourceAvailability:task.sourceAvailability}})
   this.setData({title:pair.title,items,feedback:draft.feedback||'',band:draft.band??null,taskScores:draft.taskScores||[],warning:draft.warning||'',reportUrl:draft.reportUrl||'',phase,canRetry:phase==='pending'&&ready&&!changed,status:!ready?'题目正在核验，作文已保留':changed?'题目来源已更新，确认前不会重新批改':phase==='done'?'已恢复批改结果':phase==='pending'?'可继续查看批改':'自动保存',sourceResolved:true,sourceAvailability:ready?'ready':'pending-review',sourceReviewRequired:changed,sourcePreview:false,sourceArchiveNotice:this.__sourceArchiveRef||hasWritingSourceArchives(this.__scope,this.__owner,this.__epoch)?'旧题批改记录已保留。':'',error:!ready?'完整写作中有题目正在核验，暂不提交批改。':''})
   this.consumePhoto();this.tick();this.startTimer();this.save()
  }catch(e){if(this.current())this.setData({sourceResolved:false,sourceAvailability:'pending-review',error:e.message||'题目来源未能确认，作文已保留。',status:'作文已保留'})}finally{if(this.current()){this.setData({loading:false});this.resumePendingJob()}}
 },
 onShow(){syncDevice(this);if(this.__authResumeRequested&&wx.getStorageSync('stemistSessionToken')&&owner()!=='guest'&&(this.__owner==='guest'||this.__owner===owner())){const oldScope=this.__scope;this.__owner=owner();this.__epoch=epoch();this.__scope='writing-pair:'+this.__owner+':'+this.data.pairId;this.__authResumeRequested=false;if(oldScope!==this.__scope)clearDraft(oldScope);this.setData({authRequired:false,error:''});this.save()}if(!this.current()){this.__jobId='';this.__sourceArchiveRef=null;this.__tasks=null;this.__resumeQueryStarted=true;this.setData({items:[],...emptyResult(),status:'',sourceResolved:false,sourceAvailability:'pending-review',sourceReviewRequired:false,sourcePreview:false,sourceArchiveNotice:'',error:'账号已变化，请重新打开题组。'});return}this.startTimer();this.consumePhoto()},
 consumePhoto(){const photo=wx.getStorageSync('stemistWritingPhoto'),meta=wx.getStorageSync('stemistWritingPhotoMeta');if(!this.current()||!this.sourceReady()||this.data.busy||this.data.phase!=='draft'||!photo||meta?.scope!==this.__scope||meta.owner!==this.__owner||meta.epoch!==this.__epoch||!this.data.items[meta.slot])return;const previous=this.data.items[meta.slot].photo;this.setData({['items['+meta.slot+'].photo']:photo,['items['+meta.slot+'].inputMode']:'photo'});wx.removeStorageSync('stemistWritingPhoto');wx.removeStorageSync('stemistWritingPhotoMeta');this.save();cancelDraft(this);if(previous&&previous!==photo)removeWritingPhoto(previous)},
 onHide(){cancelDraft(this);clearInterval(this.__timer)},onResize(){syncDevice(this)},onUnload(){cancelDraft(this);this.__disposed=true;clearInterval(this.__timer);clearTimeout(this.__pollTimer);this.__pollResolve?.()},
 startTimer(){clearInterval(this.__timer);if(this.__clock){this.tick();this.__timer=setInterval(()=>this.tick(),1000)}},
 tick(){if(this.current()&&this.__clock){const state=clockState(this.__clock);if(state.label!==this.data.remaining||state.expired!==this.data.timeExpired)this.setData({remaining:state.label,timeExpired:state.expired})}},
 save(){if(this.current()&&this.__tasks)scheduleDraft(this,this.__scope,{clock:this.__clock,items:this.data.items.map(item=>({text:item.text,photo:item.photo,inputMode:item.inputMode,prompt:item.prompt,sourceImages:item.images,sourceAvailability:item.sourceAvailability,sourceRevision:item.sourceRevision})),jobId:this.__jobId,feedback:this.data.feedback,band:this.data.band,taskScores:this.data.taskScores,warning:this.data.warning,reportUrl:this.data.reportUrl,sourceArchiveRef:this.__sourceArchiveRef})},
 input(event){const index=Number(event.currentTarget.dataset.index);if(!this.editable()||!this.data.items[index])return;this.setData({['items['+index+'].text']:String(event.detail.value||'').slice(0,20000),error:''});this.save()},
 takePhoto(event){const slot=Number(event.currentTarget.dataset.index);if(!this.editable()||!this.data.items[slot])return;wx.setStorageSync('stemistCameraReturn',{route:'writing',context:{product:'IELTSist',skill:'writing',writingScope:this.__scope,writingSlot:slot,writingReturnRoute:'pages/ielts/writing-full',pairId:this.data.pairId}});wx.navigateTo({url:'/pages/stem/camera'})},
 preview(event){const item=this.data.items[Number(event.currentTarget.dataset.index)];if(item?.images.length)wx.previewImage({current:item.images[0].url,urls:item.images.map(image=>image.url)})},
 chooseInputMode(event){const index=Number(event.currentTarget.dataset.index),mode=event.currentTarget.dataset.mode;if(!this.editable()||!this.data.items[index]||!['typed','photo'].includes(mode))return;this.setData({['items['+index+'].inputMode']:mode});this.save()},
 async submit(){
  if(this.data.busy||!this.current()||this.data.phase==='done')return
  if(!this.sourceReady())return this.setData({error:this.data.sourceReviewRequired?'请先查看两道新题并确认，再提交批改。':this.data.sourceResolved?'完整写作中有题目正在核验，作文已保留。':'题目来源尚未确认，请检查网络后重试。',canRetry:false,status:'作文与照片已保留'})
  if(this.data.items.length!==2||this.data.items.some(item=>item.inputMode==='photo'?!item.photo:!item.text.trim()))return this.setData({error:'请分别输入或拍摄两篇作文。'})
  this.setData({busy:true,error:'',authRequired:false,status:'正在批改两篇作文…',canRetry:false})
  try{
   if(!this.__jobId){const submittedAt=Date.now(),items=await Promise.all(this.data.items.map(async item=>({id:item.id,prompt:item.prompt,essay:item.inputMode==='photo'?'':item.text,imageDataUrls:item.inputMode==='photo'?[await readAsJpegDataUrl(item.photo)]:[],sourceRevision:item.sourceRevision})));if(!this.current())return;const id=await startWritingPairFeedback(items);if(!this.current())return;this.__jobId=id;this.__clock.finishedAt=submittedAt;this.setData({phase:'pending'});this.tick()}
   this.save();cancelDraft(this);const started=Date.now()
   while(this.current()){
    const job=await writingJob(this.__jobId);if(!this.current())return
    if(job.status==='done'){
     const result=job.result
     this.setData({feedback:result.feedback,band:result.band,taskScores:result.taskScores,warning:result.warning,reportUrl:result.reportUrl||'',phase:'done',canRetry:false,status:result.gradeReady?'批改完成':'反馈待复核'})
     rememberRecord({id:'writing-'+this.__jobId,taskId:this.data.pairId,title:this.data.title,skill:'writing-full',category:'ielts',band:result.band,submittedAt:Date.now(),coachMode:result.ai?'ai':'local'})
     this.__jobId='';this.save();cancelDraft(this);return
    }
    if(Date.now()-started>210000){this.setData({status:'批改仍在进行，可稍后继续查看',canRetry:true});return}
    await new Promise(resolve=>{this.__pollResolve=resolve;this.__pollTimer=setTimeout(resolve,1800)})
   }
  }catch(e){if(this.current()){if(e.code==='writing_source_changed'||e.code==='writing_source_review_required')await this.handleSourceError(e);else{if(e.terminalJob||e.statusCode===404){this.__jobId='';delete this.__clock.finishedAt}this.setData({error:e.message,authRequired:Number(e.statusCode)===401,phase:this.__jobId?'pending':'draft',canRetry:Number(e.statusCode)!==401&&Boolean(this.__jobId),status:'作文已保存'});this.tick();this.save()}}}
  finally{if(this.current())this.setData({busy:false})}
 },
 async handleSourceError(error){const changed=error.code==='writing_source_changed';this.setData({sourceResolved:!changed,sourceAvailability:'pending-review',sourceReviewRequired:false,sourcePreview:false,error:error.message||'题目来源已变化，作文已保留。',canRetry:false,status:'作文与照片已保留'});this.save();cancelDraft(this);await this.load(true,changed,!changed)},
 viewSourceUpdate(){if(!this.current()||!this.data.sourceReviewRequired)return;this.setData({sourcePreview:!this.data.sourcePreview})},
 confirmSourceUpdate(){
  if(!this.current()||!this.data.sourceReviewRequired||!this.data.sourcePreview||!this.__tasks?.every(sourceReady))return
  const previousData={...this.data},previousJob=this.__jobId,previousRef=this.__sourceArchiveRef,previousClock=this.__clock?{...this.__clock}:null
  let archiveRef
  try{archiveRef=archiveWritingSource(this.__scope,this.__owner,this.__epoch,{sourceRevisions:this.data.items.map(item=>item.sourceRevision),items:this.data.items.map(item=>({id:item.id,prompt:item.prompt,sourceImages:item.images,sourceRevision:item.sourceRevision,text:item.text,photo:item.photo,inputMode:item.inputMode})),feedback:this.data.feedback,band:this.data.band,taskScores:this.data.taskScores,warning:this.data.warning,reportUrl:this.data.reportUrl,jobId:this.__jobId})}catch(error){this.setData({error:error.message||'旧稿保存失败，题目尚未切换。'});return}
  this.__sourceArchiveRef=archiveRef;this.__jobId='';this.__resumeQueryStarted=false;if(this.__clock)delete this.__clock.finishedAt;else this.__clock=createClock(60)
  const items=this.data.items.map((item,index)=>({...item,prompt:this.__tasks[index].prompt||this.__tasks[index].data||'',images:this.__tasks[index].images||[],sourceAvailability:'ready',sourceRevision:this.__tasks[index].sourceRevision,latestPrompt:'',latestImages:[],latestSourceRevision:'',latestSourceAvailability:''}))
  this.setData({items,...emptyResult(),phase:'draft',sourceAvailability:'ready',sourceReviewRequired:false,sourcePreview:false,error:'',authRequired:false,status:'已改用当前两题，作文与照片已保留',sourceArchiveNotice:'旧题批改记录已保留。'});try{this.save();cancelDraft(this)}catch(error){this.__sourceArchiveRef=previousRef;this.__jobId=previousJob;this.__clock=previousClock;this.__resumeQueryStarted=false;this.setData({...previousData,error:'旧稿虽已归档，但当前题组状态保存失败；题目尚未切换，请释放存储空间后重试。'});this.startTimer();return}this.tick();this.startTimer()
 },
 startNew(){if(!this.current()||this.data.busy||this.data.phase!=='done')return;wx.showModal({title:'重新练习',content:'本次成绩保留在学习记录中。是否开始新的 60 分钟写作？',success:result=>{if(!result.confirm||!this.current())return;const photos=this.data.items.map(item=>item.photo).filter(Boolean);this.__clock=createClock(60);this.__jobId='';this.setData({...emptyResult(),phase:'draft',error:'',status:'新练习已开始',items:this.data.items.map(item=>({...item,text:'',photo:'',inputMode:'typed'}))});this.tick();this.save();cancelDraft(this);photos.forEach(removeWritingPhoto)}})},
 openAccount(){this.__authResumeRequested=true;wx.navigateTo({url:'/pages/account/auth'})},
 downloadReport(){if(!this.current()||!/^\/api\/report\/pdf\/[a-zA-Z0-9_-]+$/.test(this.data.reportUrl)||this.data.downloading)return;this.setData({downloading:true,error:''});wx.downloadFile({url:IELTS_API_BASE+this.data.reportUrl,timeout:20000,success:r=>{if(!this.current())return;if(r.statusCode!==200)return this.setData({downloading:false,error:'报告链接已失效，作文与反馈仍保留。'});wx.openDocument({filePath:r.tempFilePath,fileType:'pdf',showMenu:true,fail:()=>{if(this.current())this.setData({error:'报告未能打开，请重试。'})},complete:()=>{if(this.current())this.setData({downloading:false})}})},fail:()=>{if(this.current())this.setData({downloading:false,error:'报告未能下载，请重试。'})}})},
 back(){wx.navigateBack()}
})
