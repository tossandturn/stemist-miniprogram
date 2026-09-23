const {deviceState,syncDevice}=require('../../utils/page')
const {STEM_ROUTES}=require('../../utils/stemRoutes')
const api=require('./service')
const message=e=>api.errorMessage?api.errorMessage(e):e.message||'请求未完成，请重试。'
const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12)
const fileSizeLabel=bytes=>bytes>=1024*1024?(bytes/(1024*1024)).toFixed(bytes<10*1024*1024?1:0)+' MB':Math.max(1,Math.ceil(bytes/1024))+' KB'
const routes=STEM_ROUTES.filter(r=>['IGCSE','AS','A2'].includes(r.stage)).map(r=>({id:r.routeId,label:r.stage+' · '+r.subjectCode+' · '+r.subjectLabel+' · '+r.components}))
const roles={answer:'学生作答','question-paper':'原卷','mark-scheme':'评分标准'}
const states={draft:'等待上传',queued:'排队中',processing:'正在批改',completed:'批改已完成',failed:'批改暂未完成'}
const PICKER_RETURN_GRACE_MS=5000
const pickerDiagnostic=error=>{
 const safe=value=>typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&/^[a-zA-Z0-9_-]{1,48}$/.test(value)?String(value):''
 const errMsg=String(error?.errMsg||error?.message||'').replace(/(?:wxfile|file):\/\/\S+|[a-zA-Z]:\\\S+|\/(?:tmp|var|private|Users|data)\/\S+/g,'[file]').replace(/\b(?:access_?token|token|authorization|cookie|session|ticket)=\S+/gi,'[redacted]').slice(0,180)
 return{errno:safe(error?.errno),code:safe(error?.code),errMsg}
}
const pickerFailure=error=>{
 const ownMessage=String(error?.message||'')
 if(ownMessage&&!/^choose(?:MessageFile|Media|Image):fail/i.test(ownMessage))return ownMessage
 const detail=String(error?.errMsg||ownMessage)
 if(/cancel|取消/i.test(detail))return''
 if(/tap|gesture/i.test(detail))return'文件选择器未能打开，请再次点击选择文件。'
 if(/declare|scope|not[^\n]*privacy|未声明/i.test(detail))return'微信后台“选中的文件”隐私声明尚未生效，请管理员确认声明和审核状态；重复授权无法解决。'
 if(/privacy|authoriz|permission|隐私|授权/i.test(detail))return'微信未允许打开文件选择器，请先完成隐私授权后重试。'
 if(/not support|unsupported|version|基础库|版本/i.test(detail))return'当前微信版本不支持选择文件，请更新微信后重试。'
 return'文件选择器未能打开，请重试；若仍失败，请更新微信并确认小程序隐私设置。'
}
Page({
 onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
 data:deviceState({title:'',instructions:'',routes,routeIndex:0,files:[],answers:[],references:[],selectionSummary:'尚未选择作答',uploadTotal:0,uploadCompleted:0,busy:false,picking:false,selectionError:'',selectionCode:'',selectionNotice:'',error:'',status:'',authenticated:false,jobId:'',jobStatus:'',jobLabel:'',jobStateHint:'选择作答后即可提交。',flowStep:1,actionVisible:true,optionalOpen:false,result:null,questions:[],reportPage:0,reportPages:0,history:[],privacy:false,documentBusy:false}),
 onLoad(){this.__disposed=false;this.__visible=true;this.__generation=0;this.__privacyCheck=0;this.__selectionSequence=0;this.bindOwner()},
 bindOwner(){
  const s=api.scope();if(this.__scope&&s.owner===this.__scope.owner&&s.epoch===this.__scope.epoch)return false
  this.pause();this.__scope=s;this.__key='stemistDraft:whole-paper:'+s.owner
  this.__privacyCheck++;this.__privacyKnown=typeof wx.getPrivacySetting!=='function';this.__privacyNeeded=false
  this.__job=null;this.__questions=[];this.__pickAction=null;this.__pickerDiagnostic=null
  const old=wx.getStorageSync(this.__key)
  this.__draft=old?.epoch===s.epoch&&Array.isArray(old.files)?old:{clientRequestId:'paper-'+uid(),files:[],routeId:routes[0]?.id||'',title:'',instructions:'',epoch:s.epoch}
  const staleRoute=!routes.some(r=>r.id===this.__draft.routeId)
  if(staleRoute&&!this.__draft.jobId)this.__draft.routeId=routes[0]?.id||''
  const hasOptional=Boolean(this.__draft.title||this.__draft.instructions||this.__draft.files.some(f=>f.role!=='answer'))
  this.setData({authenticated:s.owner!=='guest'&&Boolean(wx.getStorageSync('stemistSessionToken')),title:this.__draft.title||'',instructions:this.__draft.instructions||'',routeIndex:Math.max(0,routes.findIndex(r=>r.id===this.__draft.routeId)),archivedRoute:staleRoute&&this.__draft.jobId?'历史学科：'+this.__draft.routeId:'',jobId:this.__draft.jobId||'',jobStatus:'',jobLabel:'',jobStateHint:this.__draft.jobId?'正在读取任务状态…':'选择作答后即可提交。',flowStep:1,actionVisible:!this.__draft.jobId,optionalOpen:!this.__draft.jobId&&hasOptional,result:null,questions:[],history:[],selectionError:'',selectionCode:'',selectionNotice:'',error:staleRoute&&!this.__draft.jobId?'原学科已更新，请确认当前学科后再提交。':'',status:'',privacy:false,documentBusy:false});this.renderFiles();this.refreshPrivacy();return true
 },
 current(){return !this.__disposed&&api.current(this.__scope)},
 accept(s){if(this.__disposed||s!==this.__scope)return false;if(!api.current(s)){this.bindOwner();return false}return true},
 onShow(){this.__visible=true;syncDevice(this);if(!this.bindOwner())this.refreshPrivacy();this.recoverPicker();if(this.data.authenticated){this.loadHistory();if(this.__draft.jobId)this.refreshJob()}},
 onResize(){syncDevice(this)},
 onHide(){this.__visible=false;if(this.__selection?.phase==='choosing'){this.__selection.hidden=true;this.clearPicker(this.__selection)}this.pause({preservePicking:true})},
 onUnload(){this.__disposed=true;this.pause()},
 clearPicker(selection=this.__selection,forget=false){if(!selection)return;if(selection.timer){clearTimeout(selection.timer);selection.timer=null}if(forget&&this.__selection===selection){selection.stale=true;this.__selection=null}},
 recoverPicker(){
  const selection=this.__selection
  if(!selection||selection.stale||selection.settled||selection.phase!=='choosing'||!selection.hidden)return
  selection.hidden=false;this.clearPicker(selection)
  selection.timer=setTimeout(()=>{if(this.__visible&&this.__selection===selection&&!selection.stale&&!selection.settled&&selection.phase==='choosing')selection.finish(false,Error('文件选择器未返回结果，请再次点击选择文件。'))},PICKER_RETURN_GRACE_MS)
 },
 pause(options={}){this.__generation++;clearTimeout(this.__poll);if(options.preservePicking!==true)this.clearPicker(this.__selection,true);if(this.__upload){this.__upload.stopped=true;this.__upload.task?.abort?.()}if(!this.__disposed)this.setData(options.preservePicking===true?{busy:false}:{busy:false,picking:false})},
 save(){if(this.current()){wx.setStorageSync(this.__key,this.__draft);if(this.__draft.jobId)wx.setStorageSync(this.__key+':'+this.__draft.jobId,this.__draft);this.renderFiles()}},
 renderFiles(){const files=this.__draft?.files||[],answers=files.filter(f=>f.role==='answer'),bytes=answers.reduce((n,f)=>n+(Number.isSafeInteger(f.size)?f.size:0),0);this.setData({files,answers:answers.map((f,i)=>({...f,page:i+1})),references:files.filter(f=>f.role!=='answer').map(f=>({...f,roleLabel:roles[f.role]})),selectionSummary:answers.length?(answers.length===1&&answers[0].kind==='pdf'?'1 份 PDF':answers.length+' 张图片')+' · '+fileSizeLabel(bytes):'尚未选择作答',uploadTotal:files.length,uploadCompleted:files.filter(f=>f.uploaded).length})},
 editable(){return this.current()&&this.data.authenticated&&!this.data.busy&&!this.data.picking&&!this.__draft.jobId},
 input(event){if(!this.editable())return;const key=event.currentTarget.dataset.field;if(!['title','instructions'].includes(key))return;this.__draft[key]=String(event.detail.value||'').slice(0,key==='title'?100:2000);this.setData({[key]:this.__draft[key]});this.save()},
 routeChange(event){if(!this.editable())return;const index=Number(event.detail.value);if(!routes[index])return;this.__draft.routeId=routes[index].id;this.setData({routeIndex:index});this.save()},
 toggleOptional(){if(!this.current()||this.data.busy||this.data.picking||this.__draft.jobId)return;this.setData({optionalOpen:!this.data.optionalOpen})},
 refreshPrivacy(showError=false){
  if(typeof wx.getPrivacySetting!=='function'){this.__privacyKnown=true;this.__privacyNeeded=false;return}
  const s=this.__scope,n=++this.__privacyCheck
  const accept=()=>n===this.__privacyCheck&&this.accept(s)
  const fail=()=>{if(!accept())return;this.__privacyKnown=false;if(showError)this.setData({privacy:false,selectionError:'隐私设置暂时无法读取，请稍后再次点击选择文件。',selectionNotice:'',status:''})}
  try{wx.getPrivacySetting({success:r=>{if(!accept())return;this.__privacyKnown=true;this.__privacyNeeded=r.needAuthorization===true;const patch={privacy:this.__privacyNeeded};if(showError){patch.selectionError=this.__privacyNeeded?'请先完成下方隐私授权。':'';patch.selectionNotice=''}this.setData(patch)},fail})}catch{fail()}
 },
 privacyReady(action){
  this.__pickAction=action
  if(this.__privacyKnown&&!this.__privacyNeeded){this.setData({privacy:false});return true}
  if(this.__privacyNeeded)this.setData({privacy:true,selectionError:'请先完成下方隐私授权。',selectionNotice:'',status:''})
  else{this.setData({selectionError:'正在确认隐私设置，请稍后再次点击选择文件。',selectionNotice:'',status:''});this.refreshPrivacy(true)}
  return false
 },
 agreePrivacy(){this.__privacyCheck++;this.__privacyKnown=true;this.__privacyNeeded=false;this.setData({privacy:false,selectionError:'',selectionNotice:'隐私授权已完成，请再次点击“选择作答 PDF”或“选择多张图片”。',error:'',status:''})},
 pickPdf(event){const role=event.currentTarget.dataset.role;if(roles[role])this.pick(role,'pdf')},
 pickImages(){this.pick('answer','image')},
 async pick(role,kind){
  if(!this.editable())return
  const s=this.__scope
  let selection
  try{
   if(!this.privacyReady({role,kind})||!this.accept(s))return
   const existing=this.__draft.files.filter(f=>f.role==='answer')
   if(role==='answer'&&existing.length&&(kind==='pdf'||existing[0].kind==='pdf'))throw Error('请先移除已选作答，再切换 PDF 或图片。')
   if(role==='answer'&&existing.length>=20)throw Error('作答最多 20 张图片。')
   this.clearPicker(this.__selection,true)
   selection={id:++this.__selectionSequence,phase:'choosing',hidden:false,settled:false,stale:false,timer:null,finish:null}
   this.__selection=selection
   this.__pickerDiagnostic=null;this.setData({picking:true,selectionError:'',selectionCode:'',selectionNotice:'',error:'',status:'正在打开文件选择器…'})
   const result=await new Promise((resolve,reject)=>{
    selection.finish=(ok,value)=>{if(selection.stale||selection.settled||this.__selection!==selection)return;selection.settled=true;selection.phase=ok?'inspecting':'finished';this.clearPicker(selection);if(ok)resolve(value);else reject(value)}
    const opts={success:value=>selection.finish(true,value),fail:error=>selection.finish(false,error)}
    if(kind==='pdf'){if(!wx.chooseMessageFile)return selection.finish(false,Error('当前微信版本不支持选择文件，请升级微信。'));wx.chooseMessageFile({...opts,count:1,type:'file',extension:['pdf']})}
    else if(wx.chooseMedia)wx.chooseMedia({...opts,count:Math.min(9,20-existing.length),mediaType:['image'],sourceType:['album','camera'],sizeType:['compressed']})
    else wx.chooseImage({...opts,count:Math.min(9,20-existing.length),sizeType:['compressed']})
   })
   if(!this.current()||s!==this.__scope)return
   this.clearPicker(selection);selection.phase='inspecting'
   this.setData({status:'正在检查所选文件…'})
   const incoming=[]
   for(const [i,f] of (result.tempFiles||[]).entries()){
    const file=await api.inspect({id:'file-'+uid(),path:f.tempFilePath||f.path,name:String(f.name||(kind==='pdf'?'作答.pdf':'图片-'+(existing.length+i+1)+'.jpg')).slice(0,120),role,kind},s)
    incoming.push(file)
   }
   if(!this.current()||s!==this.__scope)return
   if(!incoming.length)throw Error('没有读取到文件，请重新选择。')
   const next=(role==='answer'?this.__draft.files:this.__draft.files.filter(f=>f.role!==role)).concat(incoming)
   if(next.reduce((n,f)=>n+f.size,0)>40*1024*1024)throw Error('全部文件合计不能超过 40 MB。')
   this.__draft.files=next;this.save();this.setData({status:'文件已就绪，可以提交批改。'})
  }catch(e){if((!selection||this.__selection===selection)&&this.accept(s)){const diagnostic=pickerDiagnostic(e);this.__pickerDiagnostic=diagnostic;this.setData({selectionError:pickerFailure(e),selectionCode:[diagnostic.code,diagnostic.errno].filter(Boolean).join(' / '),selectionNotice:'',status:''})}}
  finally{if(!selection){if(this.accept(s))this.setData({picking:false})}else if(this.__selection===selection){this.clearPicker(selection,true);if(this.accept(s))this.setData({picking:false})}}
 },
 remove(event){if(!this.editable())return;this.__draft.files=this.__draft.files.filter(f=>f.id!==event.currentTarget.dataset.id);this.save()},
 move(event){if(!this.editable())return;const answers=this.__draft.files.filter(f=>f.role==='answer'),i=answers.findIndex(f=>f.id===event.currentTarget.dataset.id),j=i+Number(event.currentTarget.dataset.delta);if(i<0||j<0||j>=answers.length)return;[answers[i],answers[j]]=[answers[j],answers[i]];this.__draft.files=answers.concat(this.__draft.files.filter(f=>f.role!=='answer'));this.save()},
 preview(event){if(!this.current())return;const f=this.__draft.files.find(f=>f.id===event.currentTarget.dataset.id);if(!f)return;if(f.kind==='image')wx.previewImage({current:f.path,urls:this.__draft.files.filter(f=>f.kind==='image').map(f=>f.path)});else wx.openDocument({filePath:f.path,fileType:'pdf',showMenu:true,fail:()=>{if(this.current())this.setData({error:'文件暂时无法打开，请重新选择。'})}})},
 focusJob(){if(this.current()&&typeof wx.pageScrollTo==='function')wx.pageScrollTo({selector:'#marking-job-state',duration:250,fail(){}})},
 async submit(){
  if(!this.current()||!this.data.authenticated||this.data.busy||this.data.picking)return
  const s=this.__scope,g=++this.__generation,d=this.__draft,alive=()=>this.current()&&s===this.__scope&&g===this.__generation&&this.__visible
  const control=this.__upload={stopped:false,cancelled:()=>!alive()||control.stopped}
  this.setData({busy:true,selectionNotice:'',error:'',status:'正在准备文件…'})
  try{
   api.validateFiles(d.files)
   let job=d.jobId?await api.get(d.jobId,s):await api.create(d,s)
   if(!this.current()||s!==this.__scope)return
   d.jobId=job.jobId;for(const f of d.files){const a=job.assets?.find(a=>a.clientAssetId===f.id);if(a){f.assetId=a.assetId;f.uploaded=a.status==='uploaded'}}this.setData({jobId:d.jobId,actionVisible:false});this.save()
   if(!alive())return
   if(job.status!=='draft'){this.setJob(job);return}
   this.setJob(job)
   for(let i=0;i<d.files.length;i++){
    if(!alive())return;const f=d.files[i];if(f.uploaded)continue
    this.setData({status:'正在上传 '+(i+1)+' / '+d.files.length+'：'+f.name})
    await api.upload(d.jobId,f,s,control);if(!this.current()||s!==this.__scope)return;f.uploaded=true;this.save()
   }
   if(!alive())return
   const submitted=await api.submit(d,s)
   if(alive()){if(submitted?.jobId===d.jobId&&states[submitted.status]){this.setJob(submitted);this.schedulePoll();await this.refreshJob()}else await this.refreshJob();if(alive())this.focusJob()}
  }catch(e){if(this.accept(s)&&g===this.__generation)this.setData({error:message(e)})}
  finally{if(this.accept(s)&&g===this.__generation){this.setData({busy:false,status:''});this.__upload=null;if(this.__draft.jobId&&this.__visible)this.schedulePoll()}}
 },
 setJob(job){
  this.__job=job
  if(job.routeId){const index=routes.findIndex(r=>r.id===job.routeId);this.setData({routeIndex:Math.max(0,index),archivedRoute:index<0?'历史学科：'+job.routeId:''})}
  if(typeof job.title==='string')this.setData({title:job.title})
  const raw=job.result,scorable=raw?.assessmentMode==='ai-provisional'&&raw?.officialScore===false
  const missingPages=Array.isArray(raw?.missingPages)?raw.missingPages:[],missingQuestions=Array.isArray(raw?.missingQuestions)?raw.missingQuestions:[]
  const completeness=[missingPages.length?'缺失或不清晰页面：'+missingPages.join('、'):'',missingQuestions.length?'未完成核对的题目：'+missingQuestions.join('、'):''].filter(Boolean).join('\n')
  const result=raw?{summary:String(raw.summary||''),completeness,reviewRequired:raw.reviewRequired!==false,provisionalScore:raw.provisionalScore,maxScore:raw.maxScore,scoreReady:scorable&&Number.isFinite(raw.provisionalScore)&&Number.isFinite(raw.maxScore)&&raw.maxScore>0&&raw.provisionalScore>=0&&raw.provisionalScore<=raw.maxScore&&!missingPages.length&&!missingQuestions.length}:null
  this.__questions=(Array.isArray(raw?.questionResults)?raw.questionResults:[]).map(q=>{
   const score=q.provisionalScore??q.score
   return{questionId:String(q.questionLabel||q.questionId||q.label||''),feedback:String(q.rationale||q.feedback||q.summary||''),evidence:(Array.isArray(q.evidence)?q.evidence:[]).filter(e=>typeof e==='string').join('\n'),criteria:(Array.isArray(q.criteria)?q.criteria:[]).map(c=>[c.label,c.comment].filter(Boolean).join('：')).join('\n'),reviewRequired:q.reviewRequired!==false,scoreReady:scorable&&Number.isFinite(score)&&Number.isFinite(q.maxScore)&&q.maxScore>0&&score>=0&&score<=q.maxScore,score,maxScore:q.maxScore}
  })
  const cancelled=job.failureCode==='cancelled',uploadTotal=this.__draft?.files?.length||0,uploadCompleted=(this.__draft?.files||[]).filter(f=>f.uploaded).length
  const flowStep=job.status==='completed'?3:['queued','processing','failed'].includes(job.status)?2:1
  const handled=Number(job.progress?.completedPages)||0,total=Number(job.progress?.totalPages)||0
  const jobStateHint=job.status==='draft'?(uploadTotal?'已上传 '+uploadCompleted+' / '+uploadTotal+' 份文件，完成后提交 AI 批改。':'正在准备上传文件。'):job.status==='queued'?'文件已提交，正在等待 AI 批改。':job.status==='processing'?'AI 正在批改。'+(total>0?'已处理 '+handled+' / '+total+' 页。':''):job.status==='completed'?(job.reportPdfPath?'批改完成，PDF 报告已可下载。':raw?'批改完成，可查看本页反馈；PDF 尚未生成。':'批改已完成，报告内容暂未返回，请刷新状态。'):cancelled?'任务已取消。':job.status==='failed'?'批改未完成。'+(job.retryable?'原文件已保留，可重试。':'请检查文件后新建任务。'):'正在读取任务状态…'
  this.setData({reportTextSelectable:job.reportTextSelectable!==false,reportAvailable:Boolean(job.reportPdfPath)})
  this.setData({jobId:job.jobId,jobStatus:job.status,jobLabel:cancelled?'已取消':states[job.status]||'',jobStateHint,flowStep,actionVisible:job.status==='draft',progress:job.progress||{},result,error:job.status==='failed'&&!cancelled?'批改暂未完成。'+(job.retryable?'原文件已保留，可点击重试。':'请检查文件后新建任务。'):'',retryable:job.retryable===true,reportPages:Math.ceil(this.__questions.length/10),sourceAvailable:Boolean(job.sourcePdfPath),expiresAt:job.expiresAt?String(job.expiresAt).replace('T',' ').replace(/\.\d{3}Z$/,' UTC'):''})
  this.renderReport(0)
 },
 renderReport(page){this.setData({reportPage:page,questions:(this.__questions||[]).slice(page*10,page*10+10)})},
 reportPage(event){const page=this.data.reportPage+Number(event.currentTarget.dataset.delta);if(page>=0&&page<this.data.reportPages)this.renderReport(page)},
 schedulePoll(){clearTimeout(this.__poll);if(this.current()&&this.__visible&&['queued','processing'].includes(this.data.jobStatus))this.__poll=setTimeout(()=>this.refreshJob(),4000)},
 async refreshJob(){
  const s=this.__scope,id=this.__draft.jobId,n=this.__refresh=(this.__refresh||0)+1;if(!id||!this.current())return
  try{const job=await api.get(id,s);if(this.accept(s)&&id===this.__draft.jobId&&n===this.__refresh){this.setJob(job);this.schedulePoll()}}
  catch(e){if(this.accept(s)&&id===this.__draft.jobId&&n===this.__refresh){this.setData({error:e.message||'状态暂时无法读取，稍后点击刷新。'});this.schedulePoll()}}
 },
 async retryJob(){if(!this.current()||this.data.busy||!this.__job?.retryable)return;const s=this.__scope;this.setData({busy:true,error:''});try{await api.retry(this.data.jobId,'retry-'+uid(),s);if(this.accept(s))await this.refreshJob()}catch(e){if(this.accept(s))this.setData({error:e.message})}finally{if(this.accept(s))this.setData({busy:false})}},
 async cancelDraft(){
  if(!this.current()||this.data.busy||this.data.jobStatus!=='draft')return
  const s=this.__scope,id=this.data.jobId
  const yes=await new Promise(resolve=>wx.showModal({title:'取消未提交任务？',content:'取消后不再批改这份任务，已上传附件仍按保留期限清理。你可以重新选择文件新建任务。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
  if(!yes||!this.accept(s)||id!==this.data.jobId||this.data.busy||this.data.jobStatus!=='draft')return
  this.setData({busy:true,error:''})
  try{await api.cancel(id,'cancel-'+id,s);if(this.accept(s)&&id===this.data.jobId)await this.refreshJob()}
  catch(e){if(this.accept(s))this.setData({error:e.message||'任务尚未取消，请重试。'})}
  finally{if(this.accept(s))this.setData({busy:false})}
 },
 async loadHistory(){const s=this.__scope;try{const jobs=await api.list(s);if(this.accept(s))this.setData({history:jobs.map(j=>({...j,statusLabel:states[j.status]||j.status}))})}catch{this.accept(s)}},
 openJob(event){
  if(!this.current()||this.data.busy||this.data.picking||this.data.documentBusy)return
  const jobId=String(event.currentTarget.dataset.id);if(!this.data.history.some(j=>j.jobId===jobId))return
  this.pause();const saved=wx.getStorageSync(this.__key+':'+jobId)
  this.__draft=saved?.epoch===this.__scope.epoch&&saved.jobId===jobId&&Array.isArray(saved.files)?saved:{clientRequestId:'paper-'+uid(),files:[],jobId,epoch:this.__scope.epoch,routeId:routes[0]?.id||''}
  this.__job=null;this.__questions=[];this.save();this.setData({jobId,jobStatus:'',jobLabel:'',jobStateHint:'正在读取任务状态…',flowStep:1,actionVisible:false,optionalOpen:false,result:null,questions:[],title:this.__draft.title||'',instructions:this.__draft.instructions||'',error:''});this.refreshJob()
 },
 async document(event){
  if(!this.current()||this.data.documentBusy)return
  if(event.currentTarget.dataset.kind==='report'&&!this.data.reportAvailable)return
  const s=this.__scope,id=this.data.jobId;this.setData({documentBusy:true,error:''})
  const alive=()=>this.accept(s)&&id===this.data.jobId
  try{const filePath=await api.download(id,event.currentTarget.dataset.kind,s,this.__job?.title||this.__draft.title||routes[this.data.routeIndex]?.label);if(alive())wx.openDocument({filePath,fileType:'pdf',showMenu:true,fail:()=>{if(alive())this.setData({error:'PDF 已下载，但未能打开，请重试。'})}})}
  catch(e){if(alive())this.setData({error:e.message})}
  finally{if(alive())this.setData({documentBusy:false})}
 },
 newTask(){if(!this.current()||this.data.busy||this.data.picking||this.data.documentBusy)return;const s=this.__scope;wx.showModal({title:'新建整卷批改',content:'当前任务保留在历史记录中。重新选择下一份作答？',success:r=>{if(!r.confirm||!this.accept(s))return;this.pause();this.__job=null;this.__questions=[];this.__pickerDiagnostic=null;this.__draft={clientRequestId:'paper-'+uid(),files:[],epoch:this.__scope.epoch,routeId:routes[this.data.routeIndex]?.id||'',title:'',instructions:''};this.save();this.setData({title:'',instructions:'',jobId:'',jobStatus:'',jobLabel:'',jobStateHint:'选择作答后即可提交。',flowStep:1,actionVisible:true,optionalOpen:false,result:null,questions:[],selectionError:'',selectionCode:'',selectionNotice:'',error:'',status:'',archivedRoute:'',expiresAt:'',sourceAvailable:false});this.loadHistory()}})},
 login(){wx.navigateTo({url:'/pages/account/auth'})},
 back(){wx.navigateBack()},
})
