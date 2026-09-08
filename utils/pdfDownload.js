const DEFAULT_THROTTLE_MS=100
const DEFAULT_CACHE_LIMIT=4

function initialPdfDownloadState(){return{visible:false,phase:'idle',active:false,ownerKey:'',itemId:'',label:'',message:'',error:'',downloadedBytes:0,totalBytes:0,downloadedLabel:'',totalLabel:'',knownTotal:false,percent:null,canCancel:false,canRetry:false,collapsed:false}}

function formatBytes(value){
 const bytes=Math.max(0,Number(value)||0)
 if(bytes<1024)return Math.round(bytes)+' B'
 if(bytes<1024*1024)return (bytes/1024).toFixed(bytes>=10240?0:1)+' KB'
 return (bytes/(1024*1024)).toFixed(bytes>=10*1024*1024?1:2)+' MB'
}

function identitySnapshot(wxApi){
 const user=wxApi.getStorageSync?.('stemistUser')||{}
 return{owner:String(user.id||user.username||'guest'),epoch:Number(wxApi.getStorageSync?.('stemistPrivacyEpoch'))||0,token:String(wxApi.getStorageSync?.('stemistSessionToken')||'')}
}

function sameIdentity(wxApi,expected){
 const current=identitySnapshot(wxApi)
 return current.owner===expected.owner&&current.epoch===expected.epoch&&current.token===expected.token
}

function createPdfDownloadController(options={}){
 const wxApi=options.wxApi||wx
 const onState=typeof options.onState==='function'?options.onState:()=>{}
 const isScopeCurrent=typeof options.isScopeCurrent==='function'?options.isScopeCurrent:()=>true
 const now=typeof options.now==='function'?options.now:Date.now
 const setTimer=typeof options.setTimer==='function'?options.setTimer:setTimeout
 const clearTimer=typeof options.clearTimer==='function'?options.clearTimer:clearTimeout
 const throttleMs=Math.max(80,Number(options.throttleMs)||DEFAULT_THROTTLE_MS)
 const cacheLimit=Math.max(1,Math.min(8,Number(options.cacheLimit)||DEFAULT_CACHE_LIMIT))
 const cache=new Map()
 let state=initialPdfDownloadState(),scope='',scopeIdentity=identitySnapshot(wxApi),disposed=false,generation=0,downloadTask=null,progressListener=null,progressTimer=null,pendingProgress=null,lastProgressAt=null,lastRequest=null

 const snapshot=()=>({...state})
 const publish=patch=>{state={...state,...patch};if(!disposed)onState(snapshot());return snapshot()}
 const current=context=>{
  if(disposed||!context||context.generation!==generation||context.scope!==scope||!sameIdentity(wxApi,context.identity))return false
  try{return isScopeCurrent(context.scope)!==false}catch{return false}
 }
 const clearProgress=()=>{if(progressTimer!==null)clearTimer(progressTimer);progressTimer=null;pendingProgress=null;lastProgressAt=null}
 const detachTask=abort=>{
  const task=downloadTask,listener=progressListener
  downloadTask=null;progressListener=null;clearProgress()
  if(listener&&typeof task?.offProgressUpdate==='function')try{task.offProgressUpdate(listener)}catch{}
  if(abort&&typeof task?.abort==='function')try{task.abort()}catch{}
 }
 const invalidate=abort=>{generation++;detachTask(abort)}
 const fail=(context,error)=>{
  if(!current(context))return false
  detachTask(false)
  publish({visible:true,phase:'error',active:false,message:'',error,canCancel:false,canRetry:Boolean(lastRequest),collapsed:false})
  return false
 }
 const remember=(key,filePath)=>{
  if(cache.has(key))cache.delete(key)
  cache.set(key,filePath)
  while(cache.size>cacheLimit)cache.delete(cache.keys().next().value)
 }
 const cachedFileExists=filePath=>new Promise(resolve=>{
  const manager=wxApi.getFileSystemManager?.()
  if(typeof manager?.access==='function'){
   try{manager.access({path:filePath,success:()=>resolve(true),fail:()=>resolve(false)})}catch{resolve(false)}
   return
  }
  if(typeof manager?.accessSync==='function'){
   try{manager.accessSync(filePath);resolve(true)}catch{resolve(false)}
   return
  }
  resolve(false)
 })
 const openLocal=(context,filePath)=>{
 if(!current(context))return false
 if(typeof wxApi.openDocument!=='function')return fail(context,'当前微信环境不支持打开 PDF，请在真机微信中重试。')
 const unsupported=error=>/not support|not implemented|simulator|devtools|开发者工具|模拟器/i.test(String(error?.errMsg||error?.message||''))
  let settled=false
  try{
   wxApi.openDocument({filePath,fileType:'pdf',showMenu:true,success:()=>{if(settled)return;settled=true;if(current(context))publish({visible:true,phase:'opened',active:false,message:'文档已打开',error:'',canCancel:false,canRetry:false,collapsed:false})},fail:error=>{if(settled)return;settled=true;if(current(context))fail(context,unsupported(error)?'当前微信环境不支持打开 PDF，请在真机微信中重试。':'PDF 未能打开，文件仍保留，可重试。')}})
  }catch(error){return fail(context,unsupported(error)?'当前微信环境不支持打开 PDF，请在真机微信中重试。':'PDF 未能打开，文件仍保留，可重试。')}
  return true
 }
 const progressState=event=>{
  const downloadedBytes=Math.max(0,Number(event?.totalBytesWritten)||0),totalBytes=Math.max(0,Number(event?.totalBytesExpectedToWrite)||0),knownTotal=totalBytes>0
  const calculated=knownTotal?Math.floor(downloadedBytes/totalBytes*100):null
  const percent=knownTotal?Math.max(0,Math.min(99,Number.isFinite(calculated)?calculated:Number(event?.progress)||0)):null
  return{downloadedBytes,totalBytes,downloadedLabel:formatBytes(downloadedBytes),totalLabel:knownTotal?formatBytes(totalBytes):'',knownTotal,percent}
 }
 const emitProgress=(context,model)=>{
  if(!current(context)||context.networkSettled||state.phase!=='downloading')return false
  lastProgressAt=now();publish({...model,visible:true,phase:'downloading',active:true,message:'正在下载'+context.request.label+'…',error:'',canCancel:true,canRetry:false})
  return true
 }
 const queueProgress=(context,event)=>{
  if(context.networkSettled)return
  if(!current(context)){invalidate(true);state={...initialPdfDownloadState()};return}
  const model=progressState(event),elapsed=lastProgressAt===null?Infinity:Math.max(0,now()-lastProgressAt)
  if(elapsed>=throttleMs){emitProgress(context,model);return}
  pendingProgress=model
  if(progressTimer!==null)return
  progressTimer=setTimer(()=>{progressTimer=null;const pending=pendingProgress;pendingProgress=null;if(pending)emitProgress(context,pending)},Math.max(0,throttleMs-elapsed))
 }
 const startDownload=context=>{
  if(!current(context))return false
  publish({visible:true,phase:'downloading',active:true,ownerKey:context.request.ownerKey,itemId:context.request.itemId,label:context.request.label,message:'正在下载'+context.request.label+'…',error:'',downloadedBytes:0,totalBytes:0,downloadedLabel:'',totalLabel:'',knownTotal:false,percent:null,canCancel:true,canRetry:false,collapsed:false})
  const success=result=>{
   if(context.networkSettled||!current(context))return
   context.networkSettled=true
   const latestProgress=pendingProgress||{downloadedBytes:state.downloadedBytes,totalBytes:state.totalBytes,downloadedLabel:state.downloadedLabel,totalLabel:state.totalLabel,knownTotal:state.knownTotal,percent:state.percent}
   detachTask(false)
   if(Number(result?.statusCode)!==200)return fail(context,'文件下载失败（HTTP '+String(result?.statusCode||'未知')+'），请重试。')
   const filePath=String(result?.tempFilePath||result?.filePath||'')
   if(!filePath)return fail(context,'文件下载完成但临时路径不可用，请重试。')
   remember(context.request.cacheKey,filePath)
   const completedProgress=latestProgress.knownTotal&&latestProgress.totalBytes>0
    ?{...latestProgress,downloadedBytes:latestProgress.totalBytes,downloadedLabel:formatBytes(latestProgress.totalBytes),percent:100}
    :{...latestProgress,totalBytes:0,totalLabel:'',knownTotal:false,percent:null}
   publish({...completedProgress,visible:true,phase:'opening',active:true,message:'下载完成，正在打开…',error:'',canCancel:false,canRetry:false,collapsed:false})
   openLocal(context,filePath)
  }
  const failure=error=>{
   if(context.networkSettled||!current(context))return
   context.networkSettled=true
   const message=/timeout/i.test(String(error?.errMsg||error?.message||''))?'下载超时，请检查网络后重试。':'文件下载失败，请检查网络后重试。'
   fail(context,message)
  }
  try{downloadTask=wxApi.downloadFile({url:context.request.url,timeout:30000,success,fail:failure})}catch{return fail(context,'文件下载未能启动，请重试。')}
  progressListener=event=>queueProgress(context,event)
  if(typeof downloadTask?.onProgressUpdate==='function')try{downloadTask.onProgressUpdate(progressListener)}catch{}
  return true
 }

 async function open(request={}){
  const normalized={url:String(request.url||''),cacheKey:String(request.cacheKey||request.url||''),ownerKey:String(request.ownerKey||''),itemId:String(request.itemId||''),label:String(request.label||'PDF'),scope:String(request.scope===undefined?scope:request.scope)}
  if(!/^https:\/\/[^\s]+$/i.test(normalized.url)){
   lastRequest=null;publish({...initialPdfDownloadState(),visible:true,phase:'error',error:'PDF 地址不可用。'});return false
  }
  if(normalized.scope!==scope)setScope(normalized.scope)
  if(state.active&&lastRequest?.ownerKey===normalized.ownerKey)return false
  invalidate(true);const context={generation,scope,identity:identitySnapshot(wxApi),request:normalized,networkSettled:false};lastRequest=normalized
  const cached=cache.get(normalized.cacheKey)
  if(cached){
   publish({visible:true,phase:'preparing',active:true,ownerKey:normalized.ownerKey,itemId:normalized.itemId,label:normalized.label,message:'正在准备'+normalized.label+'…',error:'',downloadedBytes:0,totalBytes:0,downloadedLabel:'',totalLabel:'',knownTotal:false,percent:null,canCancel:false,canRetry:false,collapsed:false})
   if(await cachedFileExists(cached)){
    if(!current(context))return false
    cache.delete(normalized.cacheKey);cache.set(normalized.cacheKey,cached)
    publish({phase:'opening',active:true,message:'已找到临时文件，正在打开…',canCancel:false,canRetry:false})
    return openLocal(context,cached)
   }
   cache.delete(normalized.cacheKey)
  }
  return startDownload(context)
 }
 function setScope(value){
  const next=String(value||'')
  if(next===scope&&sameIdentity(wxApi,scopeIdentity))return
  invalidate(true);scope=next;scopeIdentity=identitySnapshot(wxApi);lastRequest=null;state=initialPdfDownloadState();if(!disposed)onState(snapshot())
 }
 function cancel(){
  if(!state.active||!lastRequest)return false
  const request=lastRequest;invalidate(true);publish({...initialPdfDownloadState(),visible:true,phase:'cancelled',ownerKey:request.ownerKey,itemId:request.itemId,label:request.label,message:'已取消下载',canRetry:true});return true
 }
 function retry(){if(state.active||!lastRequest)return Promise.resolve(false);return open({...lastRequest,scope})}
 function toggleCollapsed(){if(!state.visible)return false;publish({collapsed:!state.collapsed});return true}
 function suspend(){invalidate(true);lastRequest=null;state=initialPdfDownloadState();if(!disposed)onState(snapshot())}
 function dispose(){if(disposed)return;disposed=true;invalidate(true);lastRequest=null;state=initialPdfDownloadState()}
 return{open,setScope,cancel,retry,toggleCollapsed,suspend,dispose,getState:snapshot,cacheSize:()=>cache.size}
}

module.exports={createPdfDownloadController,formatBytes,initialPdfDownloadState}
