const {acquireRangeAudio,hasCompleteAudioCandidate}=require('../../utils/listeningAudioRangeCache')
const {refreshNativeSession}=require('../../utils/nativeSession')
const {buildTransferProgress}=require('../../utils/transferProgress')
const {createDownloadMetrics}=require('../../utils/downloadMetrics')
const identity=()=>({owner:String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch:Number(wx.getStorageSync('stemistPrivacyEpoch'))||0})
const same=who=>{const now=identity();return who.owner===now.owner&&who.epoch===now.epoch}
const empty=()=>({itemId:'',active:false,ready:false,sharing:false,progress:null,error:''})
const valid=item=>item&&/^audio-[a-f0-9]{32}$/.test(item.id)&&item.url==='https://stem.ieltsist.com/api/stem/ielts-audio/files/'+item.id&&/^[a-f0-9]{64}$/.test(item.sha256)&&Number.isSafeInteger(item.bytes)&&item.bytes>=3&&item.bytes<=32*1024*1024&&/^Cambridge_IELTS_[A-Za-z0-9_-]+\.mp3$/.test(item.fileName)&&item.fileName.length<=160
const safeMessage=e=>/[\u4e00-\u9fff]/.test(String(e?.message||''))&&!/https?:|Bearer|secret|sk-/i.test(e.message)?e.message.slice(0,200):'音频下载未完成，请重试。'
function createAudioDownloadController({onState=()=>{}}={}){
 let state=empty(),scope='',who=identity(),generation=0,disposed=false,lease=null,filePath='',lastItem=null
 const getState=()=>({...state,progress:state.progress?{...state.progress}:null})
 const emit=patch=>{if(disposed)return;state={...state,...patch};onState(getState())}
 const release=()=>{lease?.release();lease=null}
 const current=context=>!disposed&&context.generation===generation&&same(context.who)
 const retire=context=>{if(!disposed&&context.generation===generation){generation++;release();filePath='';lastItem=null;emit(empty())}}
 function setScope(value){const next=String(value);if(next===scope&&same(who))return;generation++;release();scope=next;who=identity();filePath='';lastItem=null;emit(empty())}
 async function download(item){
  if(disposed||state.active||state.sharing)return false
  if(!valid(item)){emit({error:'音频信息无效，请刷新目录。'});return false}
  release();filePath='';lastItem={...item};const context={generation:++generation,who:identity(),token:String(wx.getStorageSync('stemistSessionToken')||'')};who=context.who
  const metrics=createDownloadMetrics(),label=item.title||'听力音频'
  emit({...empty(),itemId:item.id,active:true,progress:buildTransferProgress({phase:'connecting',total:item.bytes},label,{canCancel:true})})
  try{
   if(context.who.owner==='guest')throw Object.assign(Error('请登录后下载，音频与 PDF 共用每天两份额度。'),{code:'pdf_auth_required'})
   const options={version:item.sha256,expectedSha256:item.sha256,expectedBytes:item.bytes}
   if(!hasCompleteAudioCandidate(item.url,options))try{await refreshNativeSession()}catch(error){if(/重新登录|登录已过期/.test(String(error?.message||'')))error.code='pdf_auth_required';throw error}
   if(!current(context)){retire(context);return false}
   context.token=String(wx.getStorageSync('stemistSessionToken')||'')
   lease=acquireRangeAudio(item.url,{...options,onProgress:p=>{if(current(context))emit({progress:buildTransferProgress({...p,downloadedBytes:p.bytes,...metrics.observe(p.bytes,p.total)},label,{canCancel:!['ready','cached'].includes(p.phase)})})}})
   if(!lease)throw Error('当前微信暂不支持安全保存音频，请更新微信后重试。')
   const local=await lease.promise
   if(!current(context)){retire(context);return false}
   const base=String(wx.env?.USER_DATA_PATH||'')+'/listening-audio/'
   if(!local.startsWith(base)||!/^audio-[a-z0-9-]+\.mp3$/.test(local.slice(base.length))||Number(wx.getFileSystemManager().statSync(local).size)!==item.bytes)throw Error('音频缓存未能确认，请重新下载。')
   filePath=local;const cached=state.progress?.phase==='cached'
   emit({active:false,ready:true,error:'',progress:buildTransferProgress({phase:cached?'cached':'ready',downloadedBytes:item.bytes,total:item.bytes},label,{message:cached?'已读取下载缓存，不扣次数':'下载完成，可保存到微信'})});return true
  }catch(error){
   const auth=error?.code==='pdf_auth_required'||error?.code==='auth_required'||Number(error?.statusCode)===401
   if(!current(context)){const guestExpired=auth&&!disposed&&context.generation===generation&&identity().owner==='guest';retire(context);if(guestExpired)emit({itemId:item.id,error:'登录已过期，请重新登录后下载。',progress:{...buildTransferProgress({phase:'error'},label,{error:'登录已过期，请重新登录后下载。'}),authRequired:true}});return false}
   const changedToken=String(wx.getStorageSync('stemistSessionToken')||'')!==context.token,quota=error?.code==='pdf_daily_limit_reached'
   const message=auth&&changedToken?'登录状态已更新，请重试。':safeMessage(error)
   emit({active:false,ready:false,error:message,progress:{...buildTransferProgress({...state.progress,phase:'error'},label,{error:message,canRetry:!quota&&(!auth||changedToken)&&!['pdf_access_denied','audio_source_changed'].includes(error?.code)}),authRequired:auth&&!changedToken,quotaExhausted:quota}})
   if(auth&&!changedToken&&context.token)require('../../utils/session').clearLocalSession({preserveDrafts:true})
   release();return false
  }
 }
 function cancel(){if(disposed||!state.active)return;generation++;release();filePath='';emit({active:false,ready:false,error:'',progress:buildTransferProgress({...state.progress,phase:'paused'},state.progress?.label||'音频',{message:'下载已暂停，点击重试继续。',canRetry:true})})}
 async function share(){
  if(disposed||!state.ready||state.active||state.sharing||!same(who)||!lastItem)return false
  if(typeof wx.shareFileMessage!=='function'){emit({error:'当前微信不支持文件导出，请更新微信；已下载音频仍保留在小程序缓存中。'});return false}
  try{if(Number(wx.getFileSystemManager().statSync(filePath).size)!==lastItem.bytes)throw Error('missing')}catch{filePath='';lease?.invalidate();release();emit({ready:false,error:'音频缓存已清理，请重新下载。'});return false}
  const context={generation,who},path=filePath,name=lastItem.fileName;emit({sharing:true,error:''})
  return new Promise(resolve=>{let settled=false;const finish=(ok,cancelled=false)=>{if(settled)return;settled=true;clearTimeout(timer);if(current(context))emit({sharing:false,error:ok||cancelled?'':'音频暂时无法发送，请重试。'});if(disposed)release();resolve(ok)};const timer=setTimeout(()=>finish(false),45000);try{wx.shareFileMessage({filePath:path,fileName:name,success:()=>finish(true),fail:e=>finish(false,/cancel|取消/i.test(String(e?.errMsg||'')))})}catch{finish(false)}})
 }
 const retry=()=>lastItem?download(lastItem):Promise.resolve(false)
 function dispose(){disposed=true;generation++;if(!state.sharing)release();filePath='';lastItem=null}
 return{download,share,cancel,retry,setScope,getState,suspend:cancel,dispose}
}
module.exports={createAudioDownloadController}
