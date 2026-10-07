const {formatBytes}=require('./pdfDownload')
const positive=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0
function buildTransferProgress(progress={},label='文件',overrides={}){
 const phase=progress.phase||'connecting',active=['preparing','connecting','downloading','verifying','opening'].includes(phase),complete=progress.complete===true||['ready','cached'].includes(phase)
 const downloadedBytes=positive(progress.downloadedBytes??progress.downloaded),totalBytes=positive(progress.totalBytes??progress.total),knownTotal=totalBytes>0
 const messages={preparing:'正在准备下载…',connecting:'正在连接…',downloading:'正在下载…',verifying:'下载完成，正在校验…',opening:progress.fromCache?'已找到缓存，正在打开…':'正在打开…',ready:'下载完成',cached:'已从缓存读取',paused:'下载已暂停',error:'下载未完成，请重试。'}
 return{visible:overrides.visible!==false,collapsed:false,label,phase,active,knownTotal,downloadedBytes,totalBytes,downloadedLabel:complete&&!knownTotal&&!downloadedBytes?'':formatBytes(downloadedBytes),totalLabel:knownTotal?formatBytes(totalBytes):'',percent:knownTotal?(complete?100:Math.min(99,Math.floor(downloadedBytes/totalBytes*100))):null,message:overrides.message??messages[phase]??'',error:overrides.error||'',speedLabel:phase==='downloading'?progress.speedLabel||'':'',remainingLabel:phase==='downloading'?progress.remainingLabel||'':'',canCancel:Boolean(overrides.canCancel),canRetry:Boolean(overrides.canRetry)}
}
module.exports={buildTransferProgress}
