const { readAsJpegDataUrl } = require('../../utils/image')
const {coachHelpPolicy,normalizeHelpIntent,runCoach}=require('../../utils/coach')
const { nextAttemptId, syncStemPhotoAttempt } = require('../../utils/attemptSync')
const { deviceState, syncDevice } = require('../../utils/page')
const { isAuthError } = require('../../utils/api')
const {readCoachEffort,academicEffortScope}=require('../../utils/coachEffort')
const {createOperationTracker}=require('../../utils/operationProgress')
const {warmCoachSession}=require('../../utils/coachSession')
const {offerCoachSource,lookupCoachSource,clearCoachSource}=require('../../utils/coachSource')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0

Page({
onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
data: deviceState({ imagePath: '', message: '', loading: false, error: '', canRetry: false, authRequired: false, answer: '', warning: '', coachStatus: '反馈状态待确认', syncStatus: '', syncFailed: false, syncing: false, context: {}, contextLabel: '等待题目范围',progress:{},helpIntent:'',solutionDisabled:false }),
onLoad(options) {
this.setData({effortScope:'answers',reasoningEffort:readCoachEffort('answers'),saveTask:false})
this.__disposed = false
this.__owner=owner();this.__epoch=epoch()
options = options || {}
let path = wx.getStorageSync('stemistCroppedImage')
try { if (options.src) path = decodeURIComponent(options.src) } catch { path = '' }
const photoMeta=wx.getStorageSync('stemistCroppedImageMeta')
if(photoMeta?(photoMeta.owner!==this.__owner||photoMeta.epoch!==this.__epoch||photoMeta.path!==path):this.__owner!=='guest')path=''
const context = wx.getStorageSync('stemistCoachContext') || {}
const scope = context.category === 'competition' ? '竞赛 / 入学考试' : context.category === 'alevel' ? 'A-Level 学科' : ''
const label = context.subjectCode ? `${scope ? `${scope} · ` : ''}${context.subject || context.subjectCode} · ${context.stage || '阶段待定'}${context.paperComponents ? ` · ${context.paperComponents}` : ''}` : '等待题目范围'
const pending=wx.getStorageSync('stemistPendingAttemptSync')
const pendingSync = pending?.owner===this.__owner&&pending?.epoch===this.__epoch?pending:null
this.__pendingSync = pendingSync
const policy=coachHelpPolicy(context)
this.setData({ imagePath: path || '', context, contextLabel: label, syncFailed: Boolean(pendingSync), syncStatus: pendingSync ? '上次反馈尚未同步' : '',solutionDisabled:policy.solutionDisabled })
},
onHide(){this.__stopWarm?.()},
onUnload() { clearCoachSource(this,false);this.__disposed = true;this.__stopWarm?.();this.__cancelCoach?.();this.__cancelCoach=null;this.__coachProgress?.dispose() },
current(){return !this.__disposed&&this.__owner===owner()&&this.__epoch===epoch()},
refreshEffort(){if(!this.data.loading&&!this.data.canRetry){const effortScope=academicEffortScope(this.data.helpIntent||'worked-solution'),reasoningEffort=readCoachEffort(effortScope);this.setData({effortScope,reasoningEffort,...(reasoningEffort==='low'?{saveTask:false}:{})})}},
onShow() {
syncDevice(this)
this.refreshEffort()
if(this.__authResumeRequested&&wx.getStorageSync('stemistSessionToken')&&owner()!=='guest'&&(this.__owner==='guest'||this.__owner===owner())){this.__owner=owner();this.__epoch=epoch();this.__authResumeRequested=false;wx.setStorageSync('stemistCroppedImageMeta',{owner:this.__owner,epoch:this.__epoch,path:this.data.imagePath});this.setData({authRequired:false,error:''})}
if(!this.current()){this.__coachProgress?.dispose();this.setData({imagePath:'',answer:'',message:'',warning:'',error:'账号已变化，请重新拍照。',canRetry:false,authRequired:false,loading:false,progress:{},helpIntent:'',solutionDisabled:false})}
if(!this.current())clearCoachSource(this)
this.__stopWarm?.();if(this.current())this.__stopWarm=warmCoachSession();else{this.__cancelCoach?.();this.__cancelCoach=null}
},
onResize() { syncDevice(this) },
onMessage(event) { if(this.current()&&!this.data.loading){this.setData({ message: event.detail.value, error: '', canRetry:String(event.detail.value||'').trim()===this.data.message.trim()&&this.data.canRetry, authRequired: false });this.refreshEffort()} },
chooseEffort(event){const value=event.detail?.value;if(this.current()&&!this.data.loading&&!this.data.canRetry&&['low','high','max'].includes(value))this.setData({reasoningEffort:value,...(value==='low'?{saveTask:false}:{})})},
chooseSaveTask(event){if(this.current()&&!this.data.loading&&!this.data.canRetry&&['high','max'].includes(this.data.reasoningEffort))this.setData({saveTask:event.detail?.value===true})},
chooseHelpIntent(event) {
if(!this.current()||this.data.loading)return
const intent=normalizeHelpIntent(event.detail?.value||event.currentTarget?.dataset?.intent)
if(!intent||(intent==='worked-solution'&&this.data.solutionDisabled))return
if(intent===this.data.helpIntent)return
this.setData({helpIntent:intent,error:'',authRequired:false,canRetry:false});this.refreshEffort()
},
async ask() {
if (this.data.loading||!this.current()) return
if (!this.data.imagePath) return this.setData({ error: '还没有题目照片，请先拍摄并裁剪' })
clearCoachSource(this)
this.setData({ loading: true, error: '', canRetry: false, authRequired: false, answer: '', warning: '', syncStatus: '', syncFailed: false, syncing: false, coachStatus: '正在分析…' })
this.__coachProgress?.dispose()
this.__receiving=false
const progress=this.__coachProgress=createOperationTracker({key:'coach-photo',taskMode:true,effort:this.data.reasoningEffort,onChange:value=>{if(this.current())this.setData({progress:this.__receiving&&value.active&&value.phase!=='recovering'?{...value,label:'正在生成答案…'}:value})}})
const timingStarted=Date.now();let imagePreparationMs=0
this.__coachTiming=null
let authExpired=false
try {
const dataUrl = await readAsJpegDataUrl(this.data.imagePath,{coach:true})
imagePreparationMs=Math.max(0,Date.now()-timingStarted)
if (!this.current()) return
const policy=coachHelpPolicy(this.data.context)
const helpIntent=policy.solutionDisabled&&this.data.helpIntent==='worked-solution'?'hint':this.data.helpIntent
if(policy.solutionDisabled!==this.data.solutionDisabled||helpIntent!==this.data.helpIntent)this.setData({solutionDisabled:policy.solutionDisabled,helpIntent})
const result = await runCoach({
reasoningEffort:this.data.reasoningEffort,
saveTask:this.data.saveTask===true&&['high','max'].includes(this.data.reasoningEffort),
message: this.data.message.trim(),
helpIntent,
imageDataUrls: [dataUrl],
context: { ...this.data.context, stage: this.data.context.stage || 'practice' },
onStage:stage=>progress.stage(stage),
onCancelReady:cancel=>{if(this.current())this.__cancelCoach=cancel;else cancel()},
onPartial:answer=>{if(this.current()&&this.data.loading&&this.__coachProgress===progress){this.__receiving=Boolean(answer);this.setData({answer,warning:answer?'正在生成，以下内容尚未完整。':''});if(answer)progress.stage('arranging')}},
})
if (!this.current()) return
const completed=result.completed===true||(result.completed===undefined&&result.mode==='ai'&&result.providerStatus==='connected'&&Boolean(String(result.answer||'').trim()))
this.__coachTiming={server:result.timing,client:{...result.clientTiming,imagePreparationMs,readyMs:Math.max(0,Date.now()-timingStarted)}}
if(!completed||!String(result.answer||'').trim())throw Object.assign(new Error(result.failureMessage||'AI 反馈未完成，照片已保留，请重试。'),{partialAnswer:result.partialAnswer||''})
const answer = result.answer
const coachState = result.coachState || {}
progress.finish(true)
this.setData({answer,coachStatus:coachState.label||'反馈状态待确认',syncStatus:'正在同步学习记录…'})
offerCoachSource(this,{message:this.data.message.trim(),context:{...this.data.context,stage:this.data.context.stage||'practice'},imageDataUrls:[dataUrl]},{...result,completed})
this.__coachWarning = coachState.warning || ''
this.__pendingSync = { owner:this.__owner,epoch:this.__epoch,attemptId: nextAttemptId(), context: this.data.context, answer, helpIntent:result.helpIntent||'',coachMode: result.mode || '', providerStatus: result.providerStatus || '' }
wx.setStorageSync('stemistPendingAttemptSync', this.__pendingSync)
let syncStatus = ''
let syncWarning = ''
let syncedAttemptId = ''
try {
const synced = await syncStemPhotoAttempt(this.__pendingSync)
if(!this.current())return
if (synced && synced.skipped) {
syncStatus = '反馈已显示 · 登录后可同步学习记录'
syncWarning = '本次 Coach 反馈已保存在本机；登录后可重新同步。'
} else {
syncStatus = '已同步到 STEM 学习记录'
syncedAttemptId = String(synced && (synced.clientAttemptId || synced.attempt?.attemptId) || this.__pendingSync.attemptId || '')
this.__pendingSync = null
wx.removeStorageSync('stemistPendingAttemptSync')
}
} catch {
syncStatus = '反馈已显示 · 学习记录同步失败，可稍后重试'
syncWarning = '本次 Coach 反馈已显示，但尚未写入云端学习记录。'
}
if (!this.current()) return
wx.setStorageSync('stemistSubmission:stem-photo', { skill: 'STEM AI Coach', category: this.data.context.category || '', family: this.data.context.family || '', routeId: this.data.context.routeId || '', stage: this.data.context.stage || '', subjectCode: this.data.context.subjectCode || '', subject: this.data.context.subject || '', answer,helpIntent:result.helpIntent||'', attemptId: syncedAttemptId || this.__pendingSync?.attemptId || '', coachMode: result.mode || '', providerStatus: result.providerStatus || '', syncStatus, submittedAt: Date.now() })
this.setData({ answer, warning: [coachState.warning || '', syncWarning].filter(Boolean).join('\n'), coachStatus: coachState.label || '反馈状态待确认', syncStatus, syncFailed: Boolean(syncWarning) })
} catch (error) { authExpired=isAuthError(error);if (this.current()) this.setData({ error: error.message || 'AI 暂时不可用，原始照片已保留。', answer:error.partialAnswer||'',warning:error.partialAnswer?'回答未完成，以下仅为已收到的部分内容。':'',canRetry: !isAuthError(error), authRequired: isAuthError(error), coachStatus: '答疑未完成' }) }
finally { progress.finish(false);if(this.__coachProgress===progress){this.__cancelCoach=null;if(this.current())this.setData({loading:false});else if(!this.__disposed){this.onShow();this.setData({loading:false,coachStatus:'',syncStatus:'',syncing:false,...(authExpired?{authRequired:true,error:'登录已过期，请重新登录后继续。'}:{})})}} }
},
retry() { if (!this.data.loading) this.ask() },
pauseCoachUpload(){if(this.current()&&this.data.loading&&this.data.progress?.phase==='uploading')this.__cancelCoach?.()},
identifySource(){return lookupCoachSource(this)},
dismissSource(){clearCoachSource(this)},
openAccount() { this.__authResumeRequested=true;wx.navigateTo({ url: '/pages/account/auth' }) },
async retrySync() {
if (this.data.loading || this.data.syncing || !this.__pendingSync||!this.current()||this.__pendingSync.owner!==this.__owner||this.__pendingSync.epoch!==this.__epoch) return
this.setData({ syncing: true, syncStatus: '正在同步学习记录…' })
try {
const synced = await syncStemPhotoAttempt(this.__pendingSync)
if(!this.current())return
if (synced && synced.skipped) throw new Error('session_required')
const previous = wx.getStorageSync('stemistSubmission:stem-photo') || {}
wx.setStorageSync('stemistSubmission:stem-photo', { ...previous, attemptId: String(synced && (synced.clientAttemptId || synced.attempt?.attemptId) || this.__pendingSync.attemptId || ''), syncStatus: '已同步到 STEM 学习记录' })
this.__pendingSync = null
wx.removeStorageSync('stemistPendingAttemptSync')
this.setData({ syncing: false, syncFailed: false, syncStatus: '已同步到 STEM 学习记录', warning: this.__coachWarning || '' })
} catch {
if(this.current())this.setData({ syncing: false, syncFailed: true, syncStatus: '反馈已显示 · 学习记录同步仍失败，请稍后重试' })
}
},
retake() {
if(!this.current()||this.data.loading||this.data.syncing)return
wx.setStorageSync('stemistRetakeContext', this.data.context || {})
wx.redirectTo({ url: '/pages/stem/capture' })
},
goBack() { wx.navigateBack() },
})
