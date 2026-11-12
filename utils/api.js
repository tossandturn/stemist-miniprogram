const { clearLocalSession } = require('./session')
const {coachEffortTimeout}=require('./coachEffort')
const {captureNativeCookie,refreshNativeSession}=require('./nativeSession')
const {requestIeltsLearning}=require('./ieltsLearning')
const { DEFAULT_API_BASE, DEFAULT_IELTS_API_BASE, safeApiBase, safeIeltsApiBase } = require('./apiOrigin')
function baseUrl() {
const app = getApp()
return safeApiBase(app && app.globalData && app.globalData.apiBaseUrl) || DEFAULT_API_BASE
}
function ieltsBaseUrl() {
const app = getApp()
return safeIeltsApiBase(app && app.globalData && app.globalData.ieltsApiBaseUrl) || DEFAULT_IELTS_API_BASE
}
const COACH_TEXT_TIMEOUT_MS = 55_000
const COACH_IMAGE_TIMEOUT_MS = 60_000
function safeErrorMessage(payload, statusCode) {
const detail = payload && typeof payload.error === 'object' ? payload.error : null
if((payload?.code||detail?.code)==='coach_task_persistence_effort')return'仅“深入”或“极致”模式可保存任务。'
const message = String((detail && detail.message) || (payload && (typeof payload.error === 'string' ? payload.error : payload.message)) || '').trim()
if (statusCode >= 500 || /stack|provider|api[ _-]?key|balance|https?:\/\//i.test(message)) return '服务暂时不可用，请稍后重试。'
return message.slice(0, 240) || `请求失败（${statusCode}）`
}
function requestError(message, statusCode = 0, code = '') {
const error = new Error(message)
error.statusCode = Number(statusCode) || 0
error.code = String(code || '')
return error
}
function isAuthError(error) {
return Number(error && error.statusCode) === 401 || String(error && error.code) === 'auth_required'
}
function authRequestError(token){
const error=requestError(token?'登录已过期，请重新登录后继续。':'请登录后继续。',401,'auth_required')
// Comparison-only credential metadata must never appear in serialized errors.
Object.defineProperty(error,'rejectedToken',{value:token})
return error
}
function requestJsonAt(origin, path, data, { timeout = 30000, method = 'POST', stemAuth = true, nativeSourceRegions = false, authCheck = null, onDispatched = null, onTask = null, isCancelled = null, stream = null, streamCurrent = null } = {}) {
const token = stemAuth ? wx.getStorageSync('stemistSessionToken') : ''
return new Promise((resolve, reject) => {
let settled=false
const request = {
url: `${origin}${path}`,
method: String(method || 'POST').toUpperCase(),
timeout,
...(stream?{enableChunked:true,dataType:'text',responseType:'text'}:{}),
header: {
...(origin === ieltsBaseUrl() && path.startsWith('/api/native/ielts/') ? { 'X-STEMist-Catalog': 'native-topics-v1' } : {}),
...(String(method || 'POST').toUpperCase() === 'GET' ? {} : { 'Content-Type': 'application/json' }),
...(nativeSourceRegions && origin === baseUrl() && path === '/api/stem/practice-sets' ? { 'X-STEMist-Source-Images': 'region-v2' } : {}),
...(token ? { Authorization: `Bearer ${token}` } : {}),
...(origin===baseUrl()&&path==='/api/auth/logout'&&wx.getStorageSync('stemistNativeSessionCookie')?{Cookie:'stem_session='+wx.getStorageSync('stemistNativeSessionCookie')}:{})
},
success(response) {
if(settled||isCancelled?.())return
settled=true
let payload = response.data || {}
if (response.statusCode >= 200 && response.statusCode < 300) {
try{if(stream){streamCurrent?.();payload=stream.finish(response.data)}}catch(error){reject(error);return}
try{if(authCheck)authCheck(payload)}catch(error){reject(error);return}
captureNativeCookie(origin,path,response)
resolve(payload)
return
}
if (response.statusCode === 401) {
reject(authRequestError(token))
return
}
reject(requestError(safeErrorMessage(payload, response.statusCode), response.statusCode, payload && (payload.code || payload.error && payload.error.code)))
},
fail(error) {
if(settled||isCancelled?.())return
settled=true
reject(require('./networkError').networkFailure(error))
},
}
if (data !== undefined && data !== null) request.data = data
const task=wx.request(request)
if(typeof onTask==='function')onTask(task)
if(stream&&typeof task?.onChunkReceived==='function')task.onChunkReceived(({data})=>{
if(settled||isCancelled?.())return
try{streamCurrent?.();stream.push(data)}catch(error){settled=true;reject(error);try{task.abort()}catch{}}
})
if(!settled&&typeof onDispatched==='function')try{onDispatched()}catch{}
})
}
// This is a bounded image-generation response, not a downloadable file path.
// Student downloads continue to use the measured-progress controllers below.
function requestBinaryAt(origin,path,data,{timeout=75_000,method='POST',stemAuth=true}={}){
const token=stemAuth?wx.getStorageSync('stemistSessionToken'):''
return new Promise((resolve,reject)=>{
const request={url:`${origin}${path}`,method:String(method||'POST').toUpperCase(),timeout,responseType:'arraybuffer',dataType:'arraybuffer',header:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},data}
wx.request({...request,success(response){
 if(response.statusCode===401)return reject(authRequestError(token))
 if(response.statusCode<200||response.statusCode>=300){const status=Number(response.statusCode)||0,message=status===503?'实时绘图服务尚未配置，文字回复已保留。':status===429?'图片生成请求较多或今日次数已用完，文字回复已保留。':status===504?'图片生成超时，文字回复已保留，请稍后重试。':'图片生成暂时不可用；文字回复已保留，请稍后重试。';return reject(requestError(message,status,'tavern_image_request_failed'))}
 const mimeType=String(response.header?.['content-type']||response.header?.['Content-Type']||'').split(';')[0].toLowerCase(),bytes=response.data,length=Number(bytes?.byteLength)||0
 if(!/^image\/(?:png|jpeg|webp)$/.test(mimeType)||!length||length>2*1024*1024)return reject(requestError('生成图片未通过格式或大小检查；文字回复已保留。',502,'tavern_image_response_invalid'))
 captureNativeCookie(origin,path,response);resolve({bytes,mimeType})
 },fail(error){reject(require('./networkError').networkFailure(error,{timeoutMessage:'图片生成超时；文字回复已保留，请稍后重试。',defaultMessage:'图片生成失败；文字回复已保留，请稍后重试。'}))}})
})
}
async function requestJson(path, data, options = {}) {
const startedOwner=String(wx.getStorageSync('stemistUser')?.id||'guest'),startedEpoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
if(options.stemAuth!==false&&!path.startsWith('/api/auth/'))await refreshNativeSession()
if(options.isCancelled?.())throw requestError('AI 请求超时，问题和图片已保留，请重试。',0,'network_timeout')
if(!path.startsWith('/data/')&&(startedOwner!==String(wx.getStorageSync('stemistUser')?.id||'guest')||startedEpoch!==(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)))throw requestError('账号已变化，请重新打开练习。',409,'account_changed')
return withSessionRecovery(()=>requestJsonAt(baseUrl(),path,data,options),{...options,stemAuth:options.stemAuth!==false&&!path.startsWith('/api/auth/')},startedOwner,startedEpoch)
}
async function requestBinary(path,data,options={}){
const startedOwner=String(wx.getStorageSync('stemistUser')?.id||'guest'),startedEpoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
if(options.stemAuth!==false)await refreshNativeSession()
if(startedOwner!==String(wx.getStorageSync('stemistUser')?.id||'guest')||startedEpoch!==(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0))throw requestError('账号状态已变化，请重新进入酒馆。',409,'account_changed')
return withSessionRecovery(()=>requestBinaryAt(baseUrl(),path,data,options),options,startedOwner,startedEpoch)
}
async function withSessionRecovery(send,options,startedOwner,startedEpoch){
 const current=()=>startedOwner===String(wx.getStorageSync('stemistUser')?.id||'guest')&&startedEpoch===(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)
 const assertCurrent=()=>{
  if(!current())throw requestError('账号已变化，请重新打开页面。',409,'account_changed')
  if(options.isCancelled?.())throw requestError('请求已取消。',0,'request_cancelled')
 }
 // Native callbacks and promise continuations are separate turns. Check after
 // every completed send as well as before replaying, so old-account data can
 // never reach a new page/account even if the transport itself returned 200.
 const sendCurrent=async()=>{const result=await send();assertCurrent();return result}
 try{return await sendCurrent()}catch(error){
  assertCurrent()
  if(!isAuthError(error)||options.stemAuth===false||!error.rejectedToken)throw error
  try{
   // Repair the identity once; a payment, write or partial stream still
   // requires an explicit user retry. Only read-only requests are replayed.
   await refreshNativeSession({force:true,rejectedToken:error.rejectedToken})
   assertCurrent()
   if(error.rejectedToken===wx.getStorageSync('stemistSessionToken'))throw error
   if(options.stream||!['GET','HEAD'].includes(String(options.method||'POST').toUpperCase()))throw requestError('登录状态已恢复，请重新操作；未重复提交。',409,'session_refreshed')
   return await sendCurrent()
  }catch(recoveryError){
   assertCurrent()
   if(isAuthError(recoveryError)&&current()){
    const rejected=recoveryError.rejectedToken||error.rejectedToken
    if(rejected===wx.getStorageSync('stemistSessionToken'))clearLocalSession({preserveDrafts:true})
   }
   throw recoveryError
  }
 }
}
function requestIeltsJson(path, data, options = {}) {
return requestJsonAt(ieltsBaseUrl(), path, data, { ...options, stemAuth: false })
}
function getJson(path, { timeout = 8000, stemAuth = true } = {}) {
return requestJson(path, undefined, { timeout, method: 'GET', stemAuth })
}
function askCoach({ message, helpIntent = '', feature = '', persona = '', attemptId = '', context = {}, imageDataUrls = [], history = [], onStage = null, onPartial = null, onCancelReady = null, reasoningEffort, saveTask, diagramFormat }) {
const images = Array.isArray(imageDataUrls) ? imageDataUrls : []
if(feature!=='tavern')return require('./coachJob').askCoachJob({message,...(saveTask!==undefined?{saveTask}:{}),...(reasoningEffort!==undefined?{reasoningEffort}:{}),...(helpIntent?{helpIntent}:{}),...(feature?{feature}:{}),...(attemptId?{attemptId}:{}),context,imageDataUrls:images,history:history.slice(-10),...(diagramFormat==='stem-diagram-v1'?{diagramFormat}:{})},{request:requestJson,onStage,onPartial,onCancelReady,preparePayload:images.length?(p,o)=>require('./coachImageUpload').prepareCoachImagePayload(p,o):null})
const timeout=coachEffortTimeout(reasoningEffort,images.length?COACH_IMAGE_TIMEOUT_MS:COACH_TEXT_TIMEOUT_MS)
return new Promise((resolve,reject)=>{
let closed=false,task=null
const startedOwner=String(wx.getStorageSync('stemistUser')?.id||'guest'),startedEpoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const current=()=>{if(startedOwner!==String(wx.getStorageSync('stemistUser')?.id||'guest')||startedEpoch!==(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0))throw requestError('账号已变化，请重新打开练习。',409,'account_changed')}
const finish=(settle,value)=>{if(closed)return;closed=true;clearTimeout(timer);settle(value)}
const timer=setTimeout(()=>{finish(reject,requestError('AI 请求超时，问题和图片已保留，请重试。',0,'network_timeout'));try{task?.abort()}catch{}},timeout)
if(typeof onCancelReady==='function')onCancelReady(()=>{finish(reject,requestError('请求已取消。',0,'request_cancelled'));try{task?.abort()}catch{}})
requestJson('/api/ai/coach', { message, ...(reasoningEffort!==undefined?{reasoningEffort}:{}),...(helpIntent ? { helpIntent } : {}),feature,persona,...(attemptId?{attemptId}:{}), context, imageDataUrls: images,history:history.slice(-10) }, {
timeout,isCancelled:()=>closed,onTask:value=>{task=value},
onDispatched:()=>{if(!closed&&typeof onStage==='function')onStage('analysis')},
}).then(value=>{try{current();finish(resolve,value)}catch(error){finish(reject,error)}},error=>finish(reject,error))
})
}
function askIeltsCoach({ message, helpIntent = '', context = {}, imageDataUrls = [], history = [], onStage = null }) {
const images = Array.isArray(imageDataUrls) ? imageDataUrls.filter(Boolean) : []
const payload = {
message,
...(helpIntent ? { helpIntent } : {}),
contextText: String(context && (context.contextText || context.sourceQuestionExtract) || ''),
helpContext: { ...context, ...(helpIntent ? { helpIntent } : {}), activeModule: context.skill || '', surface: { viewId: 'mini-practice', module: context.skill || '', title: `IELTS ${context.skill || 'Coach'}`, mode: context.inputMode || context.mode || 'practice',...(context.surface||{}) } },
history: Array.isArray(history) ? history.slice(-8) : [],
}
if (images[0]) payload.imageDataUrl = images[0]
return requestIeltsLearning('/api/help/chat', payload, {
timeout: images.length ? COACH_IMAGE_TIMEOUT_MS : COACH_TEXT_TIMEOUT_MS,
onDispatched:()=>{if(typeof onStage==='function')onStage('analysis')},
}).then((result) => ({
...result,
providerStatus: result && result.providerStatus
? result.providerStatus
: result && result.mode === 'ai' ? 'connected' : result && result.mode === 'local' ? 'skipped' : 'error',
}))
}
module.exports = { COACH_IMAGE_TIMEOUT_MS, COACH_TEXT_TIMEOUT_MS, IELTS_API_BASE: DEFAULT_IELTS_API_BASE, askCoach, askIeltsCoach, getJson, isAuthError, requestBinary, requestError, requestIeltsJson, requestJson, safeErrorMessage }
