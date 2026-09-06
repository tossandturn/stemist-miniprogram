const {deviceState,syncDevice}=require('../../utils/page')
const {fetchPaperCatalog}=require('../../utils/paperCatalog')
const {routeById}=require('../../utils/stemRoutes')
const {categoryForSubject,familyForCategoryStage}=require('../../utils/stemCatalog')
const {createPaperDraft,savePaperDraft,readPaperDraft,current}=require('../../utils/nativePaper')
const {readAsJpegDataUrl}=require('../../utils/image')
const {runCoach}=require('../../utils/coach')
const {paperContext,syncPaperAttempt,markPaperQuestion}=require('../../utils/nativePaperService')
const {rememberRecord}=require('../../utils/nativeRecords')
Page({
 data:deviceState({paperId:'',subject:'',routeId:'',stage:'',category:'alevel',family:'exam',mode:'past-paper-practice',title:'真题练习',loading:true,ready:false,error:'',questionNumber:1,photo:'',feedback:'',busy:false,submitted:false,synced:false,selfScore:'',maxMarks:null,questionCount:null,photoCount:0,elapsed:'00:00',syncStatus:'',documentBusy:false,sourceImages:[],canAskFeedback:false,sourceStatus:'',markResults:[],hasMarkScheme:false}),
 onLoad(options={}){this.__disposed=false;this.setData({paperId:String(options.paperId||''),subject:String(options.subject||''),routeId:String(options.routeId||''),mode:options.mode==='exam-simulation'?'exam-simulation':'past-paper-practice'});this.load()},
 onShow(){syncDevice(this);if(this.__draft){this.refresh();if(!this.__context&&wx.getStorageSync('stemistSessionToken'))this.loadSourceContext()}},onResize(){syncDevice(this)},
 onUnload(){this.__disposed=true;clearInterval(this.__clock)},
 async load(){
  clearInterval(this.__clock);this.setData({loading:true,error:''})
  try{
   const catalog=await fetchPaperCatalog(this.data.subject),paper=catalog.items.find(item=>item.id===this.data.paperId),route=routeById(this.data.routeId)
   if(this.__disposed)return
   if(!paper||!route||route.subjectCode!==paper.subject||!paper.stages.includes(route.stage.toLowerCase()))throw new Error('试卷与学科阶段不匹配，请重新选择。')
   this.__paper=paper;this.__draft=createPaperDraft(paper,route,this.data.mode);savePaperDraft(this.__draft)
   const category=categoryForSubject(paper.subject)
   this.setData({ready:true,title:paper.file.replace(/\.pdf$/i,''),stage:route.stage,category,family:familyForCategoryStage(category,route.stage),maxMarks:paper.maxMarks,questionCount:paper.questionCount,hasMarkScheme:Boolean(paper.markScheme)})
   this.refresh();this.__clock=setInterval(()=>this.tick(),1000);this.loadSourceContext()
  }catch(e){if(!this.__disposed)this.setData({error:e.message})}finally{if(!this.__disposed)this.setData({loading:false})}
 },
 refresh(){
  const draft=readPaperDraft(this.__draft.storageKey);if(!draft)return this.setData({error:'账号已变化，请返回学习页。'})
  this.__draft=draft;const answer=draft.answers[draft.index]||{}
  const question=this.__context?.questions.find(q=>q.number===draft.index)
  this.setData({questionNumber:draft.index,photo:answer.photo||'',feedback:answer.feedback||'',photoCount:Object.keys(draft.answers).length,submitted:draft.submitted,synced:Boolean(draft.cloudSynced),selfScore:draft.selfScore||'',canAskFeedback:Boolean(question?.parts.length),sourceImages:(question?.images||[]).map(url=>'https://stem.ieltsist.com'+url),markResults:Object.values(answer.results||{})});this.tick()
 },
 async loadSourceContext(){
  if(!this.__draft||this.__disposed||this.__sourcePending)return
  if(!wx.getStorageSync('stemistSessionToken'))return this.setData({sourceStatus:'登录后可连接题目批改资料'})
  this.__sourcePending=true
  try{this.__context=await paperContext(this.__draft);if(!this.__disposed&&current(this.__draft)){this.setData({sourceStatus:this.__context.questions.length?'':'这份试卷的逐题批改资料尚未就绪'});this.refresh()}}
  catch{if(!this.__disposed)this.setData({sourceStatus:'题目批改资料暂未连接，可先查看原卷并保存作答'})}
  finally{this.__sourcePending=false}
 },
 previewQuestion(event){const current=this.data.sourceImages[Number(event.currentTarget.dataset.index)];if(current)wx.previewImage({current,urls:this.data.sourceImages})},
 openAccount(){wx.navigateTo({url:'/pages/account/auth'})},
 tick(){if(!this.__draft||this.__disposed)return;const seconds=Math.max(0,Math.floor(((this.__draft.submittedAt||Date.now())-this.__draft.startedAt)/1000));this.setData({elapsed:String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')})},
 chooseQuestion(event){const number=Number(event.detail.value);if(this.__disposed||!current(this.__draft)||this.data.busy||!Number.isInteger(number)||number<1||number>(this.data.questionCount||99))return;this.__draft.index=number;savePaperDraft(this.__draft);this.refresh()},
 previous(){this.chooseQuestion({detail:{value:Math.max(1,this.data.questionNumber-1)}})},next(){this.chooseQuestion({detail:{value:Math.min(this.data.questionCount||99,this.data.questionNumber+1)}})},
 capture(){
  if(this.data.busy||this.data.submitted||!current(this.__draft))return
  wx.setStorageSync('stemistCameraReturn',{route:'native-paper',context:{storageKey:this.__draft.storageKey,sessionId:this.__draft.id,questionNumber:this.data.questionNumber,category:this.data.category,family:this.data.family,routeId:this.data.routeId,stage:this.data.stage,subjectCode:this.data.subject}})
  wx.navigateTo({url:'/pages/stem/camera',fail:()=>this.setData({error:'相机未能打开，请重试。'})})
 },
 previewPhoto(){if(this.data.photo)wx.previewImage({current:this.data.photo,urls:[this.data.photo]})},
 openDocument(event){
  const document=event.currentTarget.dataset.kind==='ms'?this.__paper?.markScheme:this.__paper
  if(!document||this.data.documentBusy)return
  if(event.currentTarget.dataset.kind==='ms'&&this.data.mode==='exam-simulation'&&!this.data.submitted)return
  const path=String(document.localUrl||'');if(!path.startsWith('/local-pdf/'+this.data.subject+'/')||path.includes('..'))return
  this.setData({documentBusy:true,error:''})
  wx.downloadFile({url:'https://stem.ieltsist.com'+path,timeout:30000,success:r=>{
   if(this.__disposed)return
   if(r.statusCode!==200){this.setData({documentBusy:false,error:'原卷未能下载，请重试。'});return}
   wx.openDocument({filePath:r.tempFilePath,fileType:'pdf',showMenu:true,fail:()=>this.setData({error:'原卷暂时无法打开。'}),complete:()=>{if(!this.__disposed)this.setData({documentBusy:false})}})
  },fail:()=>{if(!this.__disposed)this.setData({documentBusy:false,error:'下载超时，请检查网络后重试。'})}})
 },
 async askFeedback(){
  if(this.data.busy||!this.data.canAskFeedback||!this.data.photo||!current(this.__draft)||this.data.mode==='exam-simulation'&&!this.data.submitted)return
  const number=this.data.questionNumber,revision=this.__draft.answers[number].revision
  this.setData({busy:true,error:''})
  try{
   const image=await readAsJpegDataUrl(this.data.photo)
   await syncPaperAttempt(this.__draft,this.__context,this.data.maxMarks)
   const question=this.__context.questions.find(q=>q.number===number)
   const result=await runCoach({message:'请基于这道已关联题目和照片中的作答，解释错误与下一步方法。不要编造官方分数。',context:{product:'STEM Studio',skill:'stem-photo',inputMode:'photo',view:'full-paper',attemptId:this.__draft.id,paperStudyMode:this.data.mode,routeId:this.data.routeId,stage:this.data.stage,paperId:this.data.paperId,sourceQuestionId:question.sourceQuestionId,questionNumber:number,category:this.data.category,family:this.data.family,source:'stemist-native-paper'},imageDataUrls:[image]})
   if(this.__disposed||!current(this.__draft))return
   const latest=readPaperDraft(this.__draft.storageKey)
   if(latest?.answers[number]?.revision!==revision)return
   if(result.mode!=='ai'||result.providerStatus!=='connected')throw new Error('AI 反馈未完成，照片已保留，请重试。')
   latest.answers[number].feedback=String(result.answer||'');savePaperDraft(latest);this.__draft=latest;this.refresh()
  }catch(e){if(!this.__disposed)this.setData({error:e.message})}finally{if(!this.__disposed)this.setData({busy:false})}
 },
 async markCurrent(){
  if(this.data.busy||!this.data.submitted||!this.data.photo||!this.data.canAskFeedback)return
  const number=this.data.questionNumber,question=this.__context.questions.find(q=>q.number===number)
  this.setData({busy:true,error:''})
  try{
   await syncPaperAttempt(this.__draft,this.__context,this.data.maxMarks)
   await markPaperQuestion(this.__draft,question,this.data.photo,(part,result)=>{
    const latest=readPaperDraft(this.__draft.storageKey);if(!latest||this.__disposed)return
    latest.answers[number].results={...(latest.answers[number].results||{}),[part.partId]:{label:part.label,...result}};savePaperDraft(latest);this.__draft=latest;this.refresh()
   })
  }catch(e){if(!this.__disposed)this.setData({error:e.message||'批改未完成，照片已保留。'})}finally{if(!this.__disposed)this.setData({busy:false})}
 },
 inputSelfScore(event){if(!this.__draft||this.data.busy||!current(this.__draft))return;const text=String(event.detail.value||'');if(text!==''&&(!Number.isFinite(Number(text))||Number(text)<0||this.data.maxMarks&&Number(text)>this.data.maxMarks))return;this.__draft.selfScore=text;this.__draft.cloudSynced=false;savePaperDraft(this.__draft);this.setData({selfScore:text,synced:false})},
 async submitPaper(){
  if(this.data.busy||this.data.submitted||!current(this.__draft))return
  if(!this.data.photoCount)return this.setData({error:'请先拍摄并保存答案。'})
  this.__draft.submitted=true;this.__draft.submittedAt=Date.now();savePaperDraft(this.__draft);this.refresh()
  rememberRecord({id:this.__draft.id,paperId:this.data.paperId,title:this.data.title,skill:'full-paper',category:this.data.category,routeId:this.data.routeId,subjectCode:this.data.subject,stage:this.data.stage,mode:this.data.mode,selfScore:this.__draft.selfScore,submittedAt:this.__draft.submittedAt,coachMode:'self'})
  wx.setStorageSync('stemistSubmission:paper-'+this.data.paperId,{category:this.data.category,family:this.data.family,skill:'full-paper',routeId:this.data.routeId,subjectCode:this.data.subject,stage:this.data.stage,submittedAt:Date.now(),coachMode:'self',selfScore:this.__draft.selfScore,photoCount:this.data.photoCount})
  return this.syncSubmission()
 },
 async syncSubmission(){
  if(this.data.busy||!this.__draft?.submitted||!current(this.__draft))return
  if(!wx.getStorageSync('stemistSessionToken'))return this.setData({syncStatus:'已保存在本机，登录后可同步'})
  if(!this.__context?.questions.length)return this.setData({syncStatus:'已保存在本机，题目资料就绪后可连接批改'})
  this.setData({busy:true})
  try{await syncPaperAttempt(this.__draft,this.__context,this.data.maxMarks);if(!this.__disposed&&current(this.__draft)){this.__draft.cloudSynced=true;savePaperDraft(this.__draft);this.setData({syncStatus:'已同步提交记录',synced:true})}}catch{if(!this.__disposed)this.setData({syncStatus:'已保存到本机，云端同步未完成'})}finally{if(!this.__disposed)this.setData({busy:false})}
 },
 back(){wx.navigateBack({fail:()=>wx.redirectTo({url:'/pages/papers/index?category='+this.data.category})})}
})
