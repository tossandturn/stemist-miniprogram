const {buildTransferProgress}=require('../../utils/transferProgress')
const REPORT_PATH=/^\/api\/report\/pdf\/[a-zA-Z0-9_-]+$/
const PROGRESS_INTERVAL_MS=160

function createWritingReportDownload(page,{origin,current,reportUrl,label='批改报告'}={}){
 let generation=0,control=null,disposed=false
 const live=()=>!disposed&&typeof current==='function'&&current()
 const currentUrl=()=>String(typeof reportUrl==='function'?reportUrl():'')
 const accepted=item=>Boolean(item&&control===item&&item.generation===generation&&live()&&item.reportUrl===currentUrl())
 const detach=(item,abort=false)=>{
  const task=item?.task,listener=item?.listener
  if(item?.progressTimer){clearTimeout(item.progressTimer);item.progressTimer=null}
  item&&(item.task=null,item.listener=null)
  if(listener&&typeof task?.offProgressUpdate==='function')try{task.offProgressUpdate(listener)}catch{}
  if(abort&&typeof task?.abort==='function')try{task.abort()}catch{}
 }
 const clearControl=(item,abort=false)=>{detach(item,abort);if(control===item)control=null}
 const setState=(item,progress,overrides={},downloading=false,extra={})=>{
  if(item&&!accepted(item))return false
  if(!live())return false
  try{page.setData({reportDownload:buildTransferProgress(progress,label,overrides),downloading,...extra});return true}
  catch{if(item)clearControl(item,true);return false}
 }
 const fail=(item,error)=>{
  if(!accepted(item)){clearControl(item,true);return false}
  const published=setState(item,{downloadedBytes:item.downloadedBytes,totalBytes:item.totalBytes,phase:'error'},{error,canRetry:true},false)
  clearControl(item,false);return published
 }
 const invalidate=abort=>{generation++;const item=control;control=null;if(item)detach(item,abort);return item}
 const stop=({visible=true,message='报告下载已暂停，可稍后重试。'}={})=>{
  if(!control){if(!visible&&live())try{page.setData({reportDownload:null,downloading:false})}catch{};return false}
  const item=invalidate(true)
  if(!live())return false
  if(!visible){try{page.setData({reportDownload:null,downloading:false})}catch{};return true}
  const downloadedBytes=item?.downloadedBytes||0,totalBytes=item?.totalBytes||0
  return setState(null,{downloadedBytes,totalBytes,phase:'paused'},{message,canRetry:REPORT_PATH.test(currentUrl())},false)
 }
 const publishProgress=(item,force=false)=>{
  if(!accepted(item)||item.settled)return false
  const now=Date.now(),elapsed=now-item.lastProgressAt
  if(!force&&item.lastProgressAt&&elapsed<PROGRESS_INTERVAL_MS){
   if(!item.progressTimer)item.progressTimer=setTimeout(()=>{item.progressTimer=null;publishProgress(item,true)},PROGRESS_INTERVAL_MS-elapsed)
   return true
  }
  if(item.progressTimer){clearTimeout(item.progressTimer);item.progressTimer=null}
  item.lastProgressAt=now
  return setState(item,{downloadedBytes:item.downloadedBytes,totalBytes:item.totalBytes,phase:'downloading'},{canCancel:true},true)
 }
 const start=()=>{
  const value=currentUrl(),base=String(origin||'').replace(/\/+$/,'')
  if(!live()||page.data.downloading||!REPORT_PATH.test(value)||!/^https:\/\/ieltsist\.com$/i.test(base))return false
  invalidate(true)
  const item={generation:++generation,reportUrl:value,downloadedBytes:0,totalBytes:0,task:null,listener:null,progressTimer:null,lastProgressAt:0,settled:false}
  control=item
  if(!setState(item,{phase:'connecting'},{canCancel:true},true,{error:''}))return false
  const success=result=>{
   if(!accepted(item)||item.settled){if(!accepted(item))clearControl(item,true);return}
   if(item.totalBytes>0)item.downloadedBytes=Math.max(item.downloadedBytes,item.totalBytes)
   publishProgress(item,true);item.settled=true;detach(item,false)
   if(!setState(item,{downloadedBytes:item.downloadedBytes,totalBytes:item.totalBytes,phase:'verifying'},{canCancel:false},true))return
   const filePath=String(result?.tempFilePath||result?.filePath||'')
   if(Number(result?.statusCode)!==200||!filePath)return fail(item,'报告下载链接已失效，作文与反馈仍保留。')
   if(!setState(item,{downloadedBytes:item.downloadedBytes,totalBytes:item.totalBytes,phase:'opening'},{canCancel:false},true))return
   try{wx.openDocument({filePath,fileType:'pdf',showMenu:true,success:()=>{if(!accepted(item))return;setState(item,{downloadedBytes:item.downloadedBytes,totalBytes:item.totalBytes,phase:'ready'},{message:'报告已打开。'},false);clearControl(item,false)},fail:()=>fail(item,'报告已下载，但当前设备未能打开 PDF。')})}
   catch{return fail(item,'报告已下载，但当前设备未能打开 PDF。')}
  }
  const failure=()=>{if(!item.settled)fail(item,'报告未能下载，请检查网络后重试。')}
  try{
   const task=wx.downloadFile({url:base+value,timeout:20000,success,fail:failure})
   if(!accepted(item)||item.settled){if(!item.settled)try{task?.abort?.()}catch{};return true}
   item.task=task
   item.listener=event=>{
    if(!accepted(item)||item.settled){if(!accepted(item))clearControl(item,true);return}
    item.downloadedBytes=Math.max(item.downloadedBytes,Math.max(0,Number(event?.totalBytesWritten)||0))
    const total=Math.max(0,Number(event?.totalBytesExpectedToWrite)||0)
    if(total>0)item.totalBytes=Math.max(item.totalBytes,total,item.downloadedBytes)
    publishProgress(item)
   }
   try{task?.onProgressUpdate?.(item.listener)}catch{}
  }catch{return fail(item,'报告下载未能启动，请重试。')}
  return true
 }
 return{start,retry(){return page.data.reportDownload?.canRetry?start():false},cancel(){return stop()},pause(){return control?.settled?false:stop()},reset(){return stop({visible:false})},dispose(){disposed=true;invalidate(true)}}
}
module.exports={createWritingReportDownload}
