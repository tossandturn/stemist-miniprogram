const {deviceState,syncDevice,readDraft,scheduleDraft,cancelDraft,clearDraft}=require('../../utils/page')
const {loadIeltsContent,getIeltsTask}=require('../../utils/ieltsContent')
const {writingPairs,startWritingPairFeedback,writingJob}=require('../../utils/ieltsWriting')
const {createClock,clockState}=require('../../utils/practiceClock')
const {readAsJpegDataUrl}=require('../../utils/image')
const {rememberRecord}=require('../../utils/nativeRecords')
const {removeWritingPhoto}=require('../../utils/nativeWritingPhoto')
const {IELTS_API_BASE}=require('../../utils/api')
const owner=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const emptyResult=()=>({feedback:'',band:null,taskScores:[],warning:'',reportUrl:'',canRetry:false})
Page({
 data:deviceState({loading:true,busy:false,error:'',authRequired:false,pairId:'',title:'完整写作',items:[],remaining:'60:00',timeExpired:false,phase:'draft',...emptyResult(),status:'自动保存',downloading:false}),
 onLoad(options={}){this.__disposed=false;this.__owner=owner();this.__epoch=epoch();this.setData({pairId:String(options.pairId||'')});this.__scope='writing-pair:'+this.__owner+':'+this.data.pairId;this.load()},
 current(){return !this.__disposed&&this.__owner===owner()&&this.__epoch===epoch()},
 editable(){return this.current()&&!this.data.busy&&this.data.phase==='draft'&&!clockState(this.__clock)?.expired},
 async load(){
  try{
   const bank=await loadIeltsContent(),pair=writingPairs(bank.writing).find(p=>p.id===this.data.pairId)
   if(!pair)throw new Error('未找到完整写作题组。')
   const tasks=await Promise.all(pair.items.map(id=>getIeltsTask('writing',id)))
   if(!this.current())return
   this.__tasks=tasks;const draft=readDraft(this.__scope)||{}
   this.__clock=clockState(draft.clock)?draft.clock:createClock(60);this.__jobId=draft.jobId||''
   const phase=this.__jobId?'pending':draft.feedback?'done':'draft'
   if(phase==='draft')delete this.__clock.finishedAt
   this.setData({title:pair.title,items:tasks.map((task,index)=>({id:task.id,number:index+1,prompt:task.prompt||task.data||'',images:task.images||[],text:draft.items?.[index]?.text||'',photo:draft.items?.[index]?.photo||'',inputMode:draft.items?.[index]?.inputMode==='photo'?'photo':'typed'})),feedback:draft.feedback||'',band:draft.band??null,taskScores:draft.taskScores||[],warning:draft.warning||'',reportUrl:draft.reportUrl||'',phase,canRetry:phase==='pending',status:phase==='done'?'已恢复批改结果':phase==='pending'?'可继续查看批改':'自动保存'})
   this.consumePhoto();this.tick();this.startTimer();this.save()
  }catch(e){if(this.current())this.setData({error:e.message})}finally{if(this.current()){this.setData({loading:false});if(this.__jobId&&!this.data.busy)this.submit()}}
 },
 onShow(){syncDevice(this);if(this.__authResumeRequested&&wx.getStorageSync('stemistSessionToken')&&owner()!=='guest'&&(this.__owner==='guest'||this.__owner===owner())){const oldScope=this.__scope;this.__owner=owner();this.__epoch=epoch();this.__scope='writing-pair:'+this.__owner+':'+this.data.pairId;this.__authResumeRequested=false;if(oldScope!==this.__scope)clearDraft(oldScope);this.setData({authRequired:false,error:''});this.save()}if(!this.current()){this.setData({items:[],...emptyResult(),error:'账号已变化，请重新打开题组。'});return}this.startTimer();this.consumePhoto()},
 consumePhoto(){const photo=wx.getStorageSync('stemistWritingPhoto'),meta=wx.getStorageSync('stemistWritingPhotoMeta');if(!this.current()||this.data.busy||this.data.phase!=='draft'||!photo||meta?.scope!==this.__scope||meta.owner!==this.__owner||meta.epoch!==this.__epoch||!this.data.items[meta.slot])return;const previous=this.data.items[meta.slot].photo;this.setData({['items['+meta.slot+'].photo']:photo,['items['+meta.slot+'].inputMode']:'photo'});wx.removeStorageSync('stemistWritingPhoto');wx.removeStorageSync('stemistWritingPhotoMeta');this.save();cancelDraft(this);if(previous&&previous!==photo)removeWritingPhoto(previous)},
 onHide(){cancelDraft(this);clearInterval(this.__timer)},onResize(){syncDevice(this)},onUnload(){cancelDraft(this);this.__disposed=true;clearInterval(this.__timer);clearTimeout(this.__pollTimer);this.__pollResolve?.()},
 startTimer(){clearInterval(this.__timer);if(this.__clock){this.tick();this.__timer=setInterval(()=>this.tick(),1000)}},
 tick(){if(this.current()&&this.__clock){const state=clockState(this.__clock);if(state.label!==this.data.remaining||state.expired!==this.data.timeExpired)this.setData({remaining:state.label,timeExpired:state.expired})}},
 save(){if(this.current()&&this.__tasks)scheduleDraft(this,this.__scope,{clock:this.__clock,items:this.data.items.map(item=>({text:item.text,photo:item.photo,inputMode:item.inputMode})),jobId:this.__jobId,feedback:this.data.feedback,band:this.data.band,taskScores:this.data.taskScores,warning:this.data.warning,reportUrl:this.data.reportUrl})},
 input(event){const index=Number(event.currentTarget.dataset.index);if(!this.editable()||!this.data.items[index])return;this.setData({['items['+index+'].text']:String(event.detail.value||'').slice(0,20000),error:''});this.save()},
 takePhoto(event){const slot=Number(event.currentTarget.dataset.index);if(!this.editable()||!this.data.items[slot])return;wx.setStorageSync('stemistCameraReturn',{route:'writing',context:{product:'IELTSist',skill:'writing',writingScope:this.__scope,writingSlot:slot,writingReturnRoute:'pages/ielts/writing-full',pairId:this.data.pairId}});wx.navigateTo({url:'/pages/stem/camera'})},
 preview(event){const item=this.data.items[Number(event.currentTarget.dataset.index)];if(item?.images.length)wx.previewImage({current:item.images[0].url,urls:item.images.map(image=>image.url)})},
 chooseInputMode(event){const index=Number(event.currentTarget.dataset.index),mode=event.currentTarget.dataset.mode;if(!this.editable()||!this.data.items[index]||!['typed','photo'].includes(mode))return;this.setData({['items['+index+'].inputMode']:mode});this.save()},
 async submit(){
  if(this.data.busy||!this.current()||this.data.phase==='done')return
  if(this.data.items.length!==2||this.data.items.some(item=>item.inputMode==='photo'?!item.photo:!item.text.trim()))return this.setData({error:'请分别输入或拍摄两篇作文。'})
  this.setData({busy:true,error:'',authRequired:false,status:'正在批改两篇作文…',canRetry:false})
  try{
   if(!this.__jobId){const submittedAt=Date.now(),items=await Promise.all(this.data.items.map(async item=>({id:item.id,prompt:item.prompt,essay:item.inputMode==='photo'?'':item.text,imageDataUrls:item.inputMode==='photo'?[await readAsJpegDataUrl(item.photo)]:[]})));if(!this.current())return;const id=await startWritingPairFeedback(items);if(!this.current())return;this.__jobId=id;this.__clock.finishedAt=submittedAt;this.setData({phase:'pending'});this.tick()}
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
  }catch(e){if(this.current()){if(e.terminalJob||e.statusCode===404){this.__jobId='';delete this.__clock.finishedAt}this.setData({error:e.message,authRequired:Number(e.statusCode)===401,phase:this.__jobId?'pending':'draft',canRetry:Number(e.statusCode)!==401&&Boolean(this.__jobId),status:'作文已保存'});this.tick();this.save()}}
  finally{if(this.current())this.setData({busy:false})}
 },
 startNew(){if(!this.current()||this.data.busy||this.data.phase!=='done')return;wx.showModal({title:'重新练习',content:'本次成绩保留在学习记录中。是否开始新的 60 分钟写作？',success:result=>{if(!result.confirm||!this.current())return;const photos=this.data.items.map(item=>item.photo).filter(Boolean);this.__clock=createClock(60);this.__jobId='';this.setData({...emptyResult(),phase:'draft',error:'',status:'新练习已开始',items:this.data.items.map(item=>({...item,text:'',photo:'',inputMode:'typed'}))});this.tick();this.save();cancelDraft(this);photos.forEach(removeWritingPhoto)}})},
 openAccount(){this.__authResumeRequested=true;wx.navigateTo({url:'/pages/account/auth'})},
 downloadReport(){if(!this.current()||!/^\/api\/report\/pdf\/[a-zA-Z0-9_-]+$/.test(this.data.reportUrl)||this.data.downloading)return;this.setData({downloading:true,error:''});wx.downloadFile({url:IELTS_API_BASE+this.data.reportUrl,timeout:20000,success:r=>{if(!this.current())return;if(r.statusCode!==200)return this.setData({downloading:false,error:'报告链接已失效，作文与反馈仍保留。'});wx.openDocument({filePath:r.tempFilePath,fileType:'pdf',showMenu:true,fail:()=>{if(this.current())this.setData({error:'报告未能打开，请重试。'})},complete:()=>{if(this.current())this.setData({downloading:false})}})},fail:()=>{if(this.current())this.setData({downloading:false,error:'报告未能下载，请重试。'})}})},
 back(){wx.navigateBack()}
})
