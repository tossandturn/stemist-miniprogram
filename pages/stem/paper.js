const {deviceState,syncDevice}=require('../../utils/page')
const {fetchPaperDetail}=require('../../utils/paperCatalog')
const {routeById}=require('../../utils/stemRoutes')
const {categoryForSubject,familyForCategoryStage}=require('../../utils/stemCatalog')
const {createPaperDraft,savePaperDraft,readPaperDraft,current}=require('../../utils/nativePaper')
const {readAsJpegDataUrl}=require('../../utils/image')
const {runCoach}=require('../../utils/coach')
const {paperSources,paperContext,syncPaperAttempt,markPaperQuestion}=require('../../utils/nativePaperService')
const {rememberRecord}=require('../../utils/nativeRecords')
const {runPaperAssessment,paperReport,selfAssess}=require('../../utils/nativePaperGrading')
const {createPdfDownloadController,initialPdfDownloadState}=require('../../utils/pdfDownload')
Page({
 data:deviceState({paperId:'',subject:'',routeId:'',stage:'',category:'alevel',family:'exam',mode:'past-paper-practice',title:'真题练习',loading:true,ready:false,error:'',questionNumber:1,photo:'',feedback:'',busy:false,submitted:false,synced:false,selfScore:'',maxMarks:null,questionCount:null,photoCount:0,elapsed:'00:00',syncStatus:'',documentBusy:false,pdfDownload:initialPdfDownloadState(),sourceImages:[],canAskFeedback:false,sourceStatus:'',markResults:[],hasMarkScheme:false}),
 onLoad(options={}){this.__disposed=false;this.__paperLoadId=0;this.__loadedSourceUrls=new Set();this.setData({paperId:String(options.paperId||''),subject:String(options.subject||''),routeId:String(options.routeId||''),mode:options.mode==='exam-simulation'?'exam-simulation':'past-paper-practice'});this.setupPdfDownload();return this.load()},
 onShow(){syncDevice(this);this.syncPdfDownloadScope();if(this.__draft){this.refresh();if(this.__draft.submitted)this.recordAssessment();if(!this.__context&&wx.getStorageSync('stemistSessionToken'))this.loadSourceContext()}},onResize(){syncDevice(this)},onHide(){this.__gradingActive=false;this.__pdfDownload?.suspend()},
 onUnload(){this.__gradingActive=false;this.__disposed=true;this.__paperLoadId++;clearInterval(this.__clock);this.__pdfDownload?.dispose()},
 pdfScope(){return[this.__paperLoadId||0,this.data.paperId,this.data.subject,this.data.routeId,this.data.mode].join('|')},
 setupPdfDownload(){
  if(this.__pdfDownload)return
  this.__pdfDownload=createPdfDownloadController({wxApi:wx,isScopeCurrent:scope=>!this.__disposed&&scope===this.pdfScope(),onState:state=>{if(!this.__disposed)this.setData({pdfDownload:state,documentBusy:state.active})}})
  this.__pdfDownload.setScope(this.pdfScope())
 },
 syncPdfDownloadScope(){if(!this.__disposed)this.__pdfDownload?.setScope(this.pdfScope())},
 async load(){
  clearInterval(this.__clock);this.__paperLoadId++;this.syncPdfDownloadScope();this.setData({loading:true,error:''})
  try{
   const paper=await fetchPaperDetail(this.data.subject,this.data.paperId),route=routeById(this.data.routeId)
   if(this.__disposed)return
   if(!paper||!route||route.subjectCode!==paper.subject||!paper.stages.includes(route.stage.toLowerCase())||!paper.routeIds.includes(route.routeId))throw new Error('试卷与学科阶段不匹配，请重新选择。')
   this.__paper=paper;this.__draft=createPaperDraft(paper,route,this.data.mode);this.__draft.questionCount=Number.isInteger(paper.questionCount)?paper.questionCount:null;savePaperDraft(this.__draft)
   const category=categoryForSubject(paper.subject)
   this.setData({ready:true,title:paper.file.replace(/\.pdf$/i,''),stage:route.stage,category,family:familyForCategoryStage(category,route.stage),maxMarks:paper.maxMarks,questionCount:paper.questionCount,hasMarkScheme:Boolean(paper.markScheme)})
   this.refresh();this.__clock=setInterval(()=>this.tick(),1000);this.loadSourceContext()
  }catch(e){if(!this.__disposed)this.setData({error:e.message})}finally{if(!this.__disposed)this.setData({loading:false})}
 },
 refresh(){
  const draft=readPaperDraft(this.__draft.storageKey);if(!draft)return this.setData({error:'账号已变化，请返回学习页。',ready:false,photo:'',feedback:'',sourceImages:[],markResults:[],reportRows:[],reportSummary:null})
  this.__draft=draft;const answer=draft.answers[draft.index]||{}
  const question=this.__context?.questions.find(q=>q.number===draft.index)||this.__sourceContext?.questions.find(q=>q.number===draft.index)
  const sourceImages=(question?.images||[]).map(url=>'https://stem.ieltsist.com'+url)
  const report=draft.submitted?paperReport(draft,this.data.maxMarks):null,assessment=answer.assessment||{}
  const student=answer.studentAssessment||(assessment.state==='self'?assessment:null)
  this.setData({selfEditing:Boolean(answer.selfDraft?.started||student||assessment.state==='self-required'),studentScore:student?.score??null,studentMax:student?.maxMarks??null})
  const {rows:reportAllRows,...reportSummary}=report||{}
  this.__report=report
  const reportPage=Math.min(this.data.reportPage||0,Math.max(0,Math.ceil((report?.rows.length||0)/10)-1))
  this.setData({gradingRunning:Boolean(this.__gradingActive),gradingFinishing:Boolean(this.__gradingTaskPending&&!this.__gradingActive),assessmentState:assessment.state||'pending',assessmentReason:assessment.reason||'',questionSelfScore:answer.selfDraft?.score??(assessment.state==='self'?String(assessment.score):''),questionSelfMax:answer.selfDraft?.max??(assessment.maxMarks!==null&&assessment.maxMarks!==undefined?String(assessment.maxMarks):''),questionMaxKnown:assessment.maxSource==='source',questionAssessmentScore:assessment.score??null,questionAssessmentMax:assessment.maxMarks??null,reportPage,reportPages:Math.ceil((report?.rows.length||0)/10),reportRows:report?.rows.slice(reportPage*10,reportPage*10+10)||[],reportSummary:report?reportSummary:null})
  if(student&&!answer.selfDraft)this.setData({questionSelfScore:String(student.score),questionSelfMax:String(student.maxMarks)})
  if(assessment.maxSource==='source')this.setData({questionSelfMax:String(assessment.maxMarks)})
  this.setData({questionNumber:draft.index,photo:answer.photo||'',feedback:answer.feedback||'',photoCount:Object.keys(draft.answers).length,submitted:draft.submitted,synced:Boolean(draft.cloudSynced),selfScore:draft.selfScore||'',canAskFeedback:Boolean(question?.parts.length),sourceImageError:false,sourceImages,sourceLoadedCount:sourceImages.filter(url=>this.__loadedSourceUrls?.has(url)).length,markResults:Object.values(answer.results||{})});this.tick()
 },
 async loadSourceContext(){
  if(!this.__draft||this.__disposed||this.__sourcePending)return
  this.__sourcePending=true
  try{if(!this.__sourceContext){this.__sourceContext=await paperSources(this.__draft);if(!this.__disposed&&current(this.__draft))this.refresh()}
   if(!wx.getStorageSync('stemistSessionToken')){if(!this.__disposed)this.setData({sourceStatus:'登录后可使用题目批改'});return}
   this.__context=await paperContext(this.__draft);if(!this.__disposed&&current(this.__draft)){this.setData({sourceStatus:this.__context.questions.length?'':'这份试卷的逐题批改资料尚未就绪'});this.refresh()}}
  catch{if(!this.__disposed)this.setData({sourceStatus:'题目批改资料暂未连接，可先查看原卷并保存作答'})}
  finally{this.__sourcePending=false}
 },
 previewQuestion(event){const current=this.data.sourceImages[Number(event.currentTarget.dataset.index)];if(current)wx.previewImage({current,urls:this.data.sourceImages})},
 sourceImageLoaded(event){const url=event.currentTarget.dataset.source;if(this.__disposed||!this.data.sourceImages.includes(url))return;this.__loadedSourceUrls.add(url);this.setData({sourceLoadedCount:this.data.sourceImages.filter(u=>this.__loadedSourceUrls.has(u)).length})},
 sourceImageFailed(event){if(!this.__disposed&&this.data.sourceImages.includes(event.currentTarget.dataset.source))this.setData({sourceImageError:true})},
 retrySourceImage(){const images=this.data.sourceImages.slice(),number=this.data.questionNumber;images.forEach(url=>this.__loadedSourceUrls.delete(url));this.setData({sourceImages:[],sourceImageError:false,sourceLoadedCount:0},()=>{const next=wx.nextTick||((f)=>f());next(()=>{if(!this.__disposed&&number===this.data.questionNumber)this.setData({sourceImages:images})})})},
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
  const kind=event.currentTarget.dataset.kind==='ms'?'ms':'qp',document=kind==='ms'?this.__paper?.markScheme:this.__paper
  if(!document)return
  this.setupPdfDownload();this.syncPdfDownloadScope();if(this.data.documentBusy)return
  if(kind==='ms'&&this.data.mode==='exam-simulation'&&!this.data.submitted)return
  const documentPath=String(document.localUrl||'');if(!documentPath.startsWith('/local-pdf/'+this.data.subject+'/')||/\.\.|[?#]|%2e|%2f|%5c/i.test(documentPath))return this.setData({error:'试卷文件暂不可用。'})
  this.setData({error:''})
  return this.__pdfDownload.open({url:'https://stem.ieltsist.com'+documentPath,cacheKey:'https://stem.ieltsist.com'+documentPath,ownerKey:this.data.paperId+':'+kind,itemId:this.data.paperId,label:kind==='ms'?'参考答案':'原卷',scope:this.pdfScope()})
 },
 cancelPdfDownload(){this.__pdfDownload?.cancel()},retryPdfDownload(){return this.__pdfDownload?.retry()},togglePdfDownloadProgress(){this.__pdfDownload?.toggleCollapsed()},
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
  return this.runAutomaticGrading()
 },
 inputSelfScore(){this.setData({error:'提交后可逐题自评；旧自评总分保留为历史。'})},
 chooseSelfAssessment(){
  const latest=this.__draft&&readPaperDraft(this.__draft.storageKey),answer=latest?.answers[this.data.questionNumber]
  if(!latest?.submitted||!answer?.photo||answer.assessment?.state==='ai')return
  answer.selfDraft={...(answer.selfDraft||{}),started:true};savePaperDraft(latest);this.refresh()
 },
 inputQuestionSelf(event){
  if(!this.__draft||!current(this.__draft))return
  const field=event.currentTarget.dataset.field;if(!['score','max'].includes(field))return
  const latest=readPaperDraft(this.__draft.storageKey),answer=latest?.answers[this.data.questionNumber]
  if(!latest?.submitted||!answer?.photo||!answer.selfDraft?.started&&!answer.studentAssessment&&!['self-required','self'].includes(answer.assessment?.state))return
  const value=String(event.detail.value||'').slice(0,12)
  answer.selfDraft={...(answer.selfDraft||{}),[field]:value};savePaperDraft(latest);this.__draft=latest;this.setData({[field==='score'?'questionSelfScore':'questionSelfMax']:value})
 },
 saveQuestionSelf(){try{this.__draft=selfAssess(this.__draft.storageKey,this.data.questionNumber,this.data.questionSelfScore,this.data.questionSelfMax,this.data.maxMarks);this.refresh();this.recordAssessment();this.setData({error:''})}catch(error){this.setData({error:error.message})}},
 recordAssessment(){
  if(!this.__draft?.submitted||!current(this.__draft))return
  const report=paperReport(this.__draft,this.data.maxMarks),source=report.scoreSource
  const scoreLabel=report.complete?(!report.wholePaper?'部分评分 · ':'')+(source==='ai'?'AI估分':source==='self'?'学生自评':'AI＋自评')+' '+report.score+'/'+report.maxScore:report.aiCount?'AI部分完成':report.selfCount?'自评已保存 · AI待完成':'待评分'
  const record={id:this.__draft.id,paperId:this.data.paperId,title:this.data.title,skill:'full-paper',category:this.data.category,routeId:this.data.routeId,subjectCode:this.data.subject,stage:this.data.stage,mode:this.data.mode,submittedAt:this.__draft.submittedAt,coachMode:source,scoreLabel,reportAvailable:true}
  rememberRecord(record);wx.setStorageSync('stemistSubmission:paper-'+this.data.paperId,{...record,photoCount:this.data.photoCount})
 },
 async runAutomaticGrading(){
  if(this.__gradingActive||this.__gradingTaskPending||this.data.busy||!this.__draft?.submitted||!current(this.__draft))return
  this.__gradingActive=true;this.__gradingTaskPending=true;this.setData({gradingRunning:true,error:''})
  try{await runPaperAssessment(this.__draft.storageKey,{paperMax:this.data.maxMarks,active:()=>this.__gradingActive&&!this.__disposed,
   loadContext:async()=>{const context=await paperContext(this.__draft);this.__context=context;return context},
   sync:async(draft,context)=>{await syncPaperAttempt(draft,context,this.data.maxMarks);const latest=readPaperDraft(draft.storageKey);if(latest){latest.cloudSynced=true;savePaperDraft(latest)}},
   mark:markPaperQuestion,onUpdate:draft=>{if(!this.__disposed){this.__draft=draft;this.refresh();this.recordAssessment()}},
  })}catch(error){if(!this.__disposed)this.setData({error:error.message||'批改暂停，照片已保留。'})}
  finally{this.__gradingActive=false;this.__gradingTaskPending=false;if(!this.__disposed){this.refresh();this.recordAssessment()}}
 },
 pauseGrading(){this.__gradingActive=false;this.setData({gradingRunning:false,gradingFinishing:Boolean(this.__gradingTaskPending),syncStatus:'已停止后续批改，当前请求结束后可继续'})},
 reportQuestion(event){this.chooseQuestion({detail:{value:Number(event.currentTarget.dataset.number)}});wx.pageScrollTo?.({selector:'.paper-native-answer',duration:200})},
 changeReportPage(event){const next=(this.data.reportPage||0)+Number(event.currentTarget.dataset.delta);if(next>=0&&next<this.data.reportPages){this.setData({reportPage:next});this.refresh()}},
 async submitPaper(){
  if(this.data.busy||this.data.submitted||!current(this.__draft))return
  if(!Object.values(this.__draft.answers||{}).some(answer=>typeof answer.photo==='string'&&answer.photo))return this.setData({error:'请先拍摄并保存答案。'})
  this.__draft.submitted=true;this.__draft.submittedAt=Date.now();savePaperDraft(this.__draft);this.refresh()
  this.recordAssessment()
  return this.runAutomaticGrading()
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
