const {reclaimCompletedPublicPdfs}=require('../../utils/pdfRangeCache')
const {createSha256}=require('../../utils/sha256')
const {createDownloadMetrics}=require('../../utils/downloadMetrics')
const CHUNK_BYTES=64*1024
const MAX_PDF_BYTES=40*1024*1024
const REQUEST_TIMEOUT_MS=30_000
const MAX_COMPLETED_FILES=20
const MAX_REGISTERED_FILES=MAX_COMPLETED_FILES+1
const META_SCHEMA='stem-paper-marking-download-v1'
const JOB_ID=/^[a-zA-Z0-9_-]{8,100}$/
const inflightOwners=new Set()

const bytes=value=>{
 if(value instanceof ArrayBuffer||Object.prototype.toString.call(value)==='[object ArrayBuffer]')return new Uint8Array(value)
 if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength)
 return null
}
const buffer=value=>{const valueBytes=bytes(value);return valueBytes?.buffer.slice(valueBytes.byteOffset,valueBytes.byteOffset+valueBytes.byteLength)}
const header=(headers,name)=>{
 const wanted=String(name).toLowerCase()
 const key=Object.keys(headers||{}).find(item=>String(item).toLowerCase()===wanted)
 return key===undefined?'':String(headers[key]).trim()
}
const strongEtag=value=>/^"[\x21\x23-\x7e]{1,198}"$/.test(String(value||''))?String(value):''
const contentRange=value=>{
 const match=String(value||'').match(/^bytes (\d+)-(\d+)\/(\d+)$/)
 if(!match)return null
 const parsed=match.slice(1).map(Number)
 return parsed.every(Number.isSafeInteger)?{start:parsed[0],end:parsed[1],total:parsed[2]}:null
}
const error=(code,message,statusCode)=>Object.assign(Error(message),{code,statusCode})

function validateOrigin(origin){
 const value=String(origin||'')
 if(!/^https:\/\/stem\.ieltsist\.com$/i.test(value)&&!/^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(value))throw error('download_origin_invalid','报告下载地址无效。')
 return value
}
function reportFolder(){
 const root=String(wx.env?.USER_DATA_PATH||'')
 if(!root)throw error('download_storage_unavailable','本机报告目录不可用。')
 return root+'/marking-reports'
}
function ownedReport(filePath){
 const folder=reportFolder(),prefix=folder+'/'
 return typeof filePath==='string'&&filePath.startsWith(prefix)&&/^整卷批改_[\w\u4e00-\u9fff-]+_(?:作答原卷|批改报告)\.pdf$/.test(filePath.slice(prefix.length))
}
function reports(){
 const stored=wx.getStorageSync('stemistPaperReports')
 return Array.isArray(stored)?[...new Set(stored.filter(ownedReport))].slice(-MAX_REGISTERED_FILES):[]
}
function saveReports(value){wx.setStorageSync('stemistPaperReports',[...new Set(value.filter(ownedReport))].slice(-MAX_REGISTERED_FILES))}
const metadataKey=owner=>'stemistDraft:whole-paper-download:'+String(owner)
function validMetadata(value,scope){
 return value&&value.schemaVersion===META_SCHEMA&&value.owner===scope.owner&&value.epoch===scope.epoch&&JOB_ID.test(String(value.jobId||''))&&['report','source'].includes(value.kind)&&strongEtag(value.etag)&&Number.isSafeInteger(value.total)&&value.total>=5&&value.total<=MAX_PDF_BYTES&&Number.isSafeInteger(value.bytes)&&value.bytes>=1&&value.bytes<=value.total&&(value.complete!==true||value.bytes===value.total)&&ownedReport(value.filePath)
}
function readMetadata(scope){const value=wx.getStorageSync(metadataKey(scope.owner));return validMetadata(value,scope)?value:null}
function writeMetadata(scope,value){wx.setStorageSync(metadataKey(scope.owner),value)}
function clearMetadata(scope){wx.removeStorageSync(metadataKey(scope.owner))}

const fileInfo=filePath=>new Promise(resolve=>{try{wx.getFileSystemManager().getFileInfo({filePath,success:value=>resolve(value),fail:()=>resolve(null)})}catch{resolve(null)}})
const writeFile=(filePath,data,append=false)=>new Promise((resolve,reject)=>{
 const method=append?'appendFile':'writeFile'
 try{wx.getFileSystemManager()[method]({filePath,data:buffer(data),success:resolve,fail:e=>reject(error(/limit|quota|no space|storage.*full|exceed|空间/i.test(String(e?.errMsg||''))?'download_storage_full':'download_storage_failed','报告未能写入本机，请检查存储空间。'))})}
 catch{reject(error('download_storage_failed','报告未能写入本机，请检查存储空间。'))}
})
const readHead=filePath=>new Promise((resolve,reject)=>{try{wx.getFileSystemManager().readFile({filePath,position:0,length:5,success:value=>resolve(bytes(value.data)),fail:()=>reject(error('download_storage_failed','报告文件无法读取。'))})}catch{reject(error('download_storage_failed','报告文件无法读取。'))}})
const unlink=filePath=>new Promise(resolve=>{if(!ownedReport(filePath))return resolve(false);try{wx.getFileSystemManager().unlink({filePath,success:()=>resolve(true),fail:()=>resolve(false)})}catch{resolve(false)}})

async function discardPartial(scope,meta,{removeComplete=false}={}){
 const removeFile=meta?.filePath&&(meta.complete!==true||removeComplete)
 if(removeFile)await unlink(meta.filePath)
 if(removeFile){const next=reports().filter(item=>item!==meta.filePath);saveReports(next)}
 const current=readMetadata(scope)
 if(!meta||current?.filePath===meta.filePath)clearMetadata(scope)
}
async function validLocalFile(meta,{pdf=false}={}){
 const info=await fileInfo(meta.filePath)
 if(!info||Number(info.size)!==meta.bytes)return false
 if(pdf){const head=await readHead(meta.filePath).catch(()=>null);if(!head||String.fromCharCode(...head)!=='%PDF-')return false}
 return true
}
function newPath(jobId,kind,label){
 const folder=reportFolder(),title=String(label||'').replace(/[^\w\u4e00-\u9fff-]/g,'-').slice(0,40)
 return folder+'/整卷批改_'+(title?title+'_':'')+jobId+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)+'_'+(kind==='source'?'作答原卷':'批改报告')+'.pdf'
}
function validateRange(response,{start,end,total=null,etag=null}){
 if(Number(response?.statusCode)===401)throw error('download_unauthorized','报告下载需要重新登录。',401)
 if(Number(response?.statusCode)!==206)throw error('download_response_invalid','报告下载响应无效，请重试。')
 if(!/^application\/pdf(?:\s*;|$)/i.test(header(response.header,'content-type')))throw error('download_response_invalid','报告下载响应无效，请重试。')
 const responseEtag=strongEtag(header(response.header,'etag'))
 if(!responseEtag)throw error('download_response_invalid','报告下载响应缺少有效版本标识。')
 if(etag&&responseEtag!==etag)throw error('download_changed','报告已更新，请重新开始下载。')
 const range=contentRange(header(response.header,'content-range')),data=bytes(response.data)
 if(!range||range.start!==start||range.end!==end||range.total<5||range.total>MAX_PDF_BYTES||total!==null&&range.total!==total)throw error(range?.total>MAX_PDF_BYTES?'download_too_large':'download_response_invalid',range?.total>MAX_PDF_BYTES?'报告文件过大，无法下载。':'报告下载响应无效，请重试。')
 const expected=end-start+1,declared=Number(header(response.header,'content-length'))
 if(!data||data.byteLength!==expected||declared!==expected)throw error('download_response_invalid','报告下载响应无效，请重试。')
 return{data,etag:responseEtag,total:range.total}
}

async function runWholePaperDownload({origin,jobId,kind,scope,label='',token='',current,options={}}={}){
 if(!JOB_ID.test(String(jobId||''))||!['report','source'].includes(kind))throw error('download_target_invalid','批改报告下载目标无效。')
 const base=validateOrigin(origin),folder=reportFolder(),targetUrl=base+'/api/stem/paper-marking-jobs/'+encodeURIComponent(jobId)+(kind==='source'?'/source.pdf':'/report.pdf')
 let activeTask=null,rejectActive=null
 const controller={cancelled:false,abort(){if(this.cancelled)return;this.cancelled=true;const task=activeTask,reject=rejectActive;reject?.(error('download_paused','报告下载已暂停，已下载部分已保留。'));task?.abort?.()}}
 const identityCurrent=()=>typeof current==='function'&&current()
 const externallyCancelled=()=>typeof options.cancelled==='function'&&options.cancelled()
 const cancelled=()=>controller.cancelled||externallyCancelled()
 const isCurrent=()=>identityCurrent()&&!cancelled()
 const ensureCurrent=()=>{if(!isCurrent())throw error(cancelled()?'download_paused':'download_identity_changed',cancelled()?'报告下载已暂停，已下载部分已保留。':'账号已变化，报告下载已停止。')}
 const metrics=createDownloadMetrics({now:typeof options.now==='function'?options.now:Date.now})
 try{options.onTask?.(controller)}catch{/* UI callbacks cannot alter download integrity. */}
 const publish=(downloadedBytes,totalBytes,complete=false,phase=complete?'complete':'downloading')=>{
  const knownTotal=totalBytes>0
  let estimate
  if(phase==='downloading')estimate=metrics.observe(downloadedBytes,totalBytes)
  else{metrics.reset();estimate={etaSeconds:null,speedLabel:'',remainingLabel:''}}
  try{options.onProgress?.({downloadedBytes,totalBytes,percent:complete?100:knownTotal?Math.min(99,Math.floor(downloadedBytes*100/totalBytes)):null,complete,phase,...estimate})}catch{/* UI callbacks cannot alter download integrity. */}
 }
 const requestRange=(start,end,etag='')=>new Promise((resolve,reject)=>{
  ensureCurrent()
  let settled=false,task
  const finish=(fn,value)=>{if(settled)return;settled=true;if(rejectActive===stop)rejectActive=null;activeTask=null;fn(value)},stop=value=>finish(reject,value)
  rejectActive=stop
  const requestOptions={url:targetUrl,method:'GET',responseType:'arraybuffer',timeout:REQUEST_TIMEOUT_MS,header:{Authorization:'Bearer '+token,Range:`bytes=${start}-${end}`,...(etag?{'If-Range':etag}:{})},success:value=>{try{ensureCurrent();finish(resolve,value)}catch(failure){stop(failure)}},fail:()=>stop(error(cancelled()?'download_paused':'download_interrupted',cancelled()?'报告下载已暂停，已下载部分已保留。':'报告下载中断，已下载部分已保留，请重试。'))}
  try{task=wx.request(requestOptions);if(!settled)activeTask=task}catch(failure){stop(failure)}
 })

 const durableWrite=async(filePath,data,append=false)=>{
  ensureCurrent()
  try{return await writeFile(filePath,data,append)}catch(failure){
   if(failure?.code!=='download_storage_full')throw failure
   await reclaimCompletedPublicPdfs(wx,identityCurrent);ensureCurrent()
   return writeFile(filePath,data,append)
  }
 }
 let verifiedProbe=null
 const temporaryPreview=async()=>{
  ensureCurrent()
  if(typeof wx.downloadFile!=='function'||!/^"[a-f0-9]{64}"$/i.test(verifiedProbe?.etag||''))throw error('download_storage_failed','本机空间不足，请释放空间后重试；云端报告仍保留，无需重新批改。')
  try{options.onTemporary?.()}catch{}
  publish(0,verifiedProbe.total,false,'downloading')
  const response=await new Promise((resolve,reject)=>{
   let settled=false,task
   const finish=(fn,value)=>{if(settled)return;settled=true;if(rejectActive===stop)rejectActive=null;activeTask=null;fn(value)},stop=value=>finish(reject,value)
   rejectActive=stop
   try{task=wx.downloadFile({url:targetUrl,timeout:180000,header:{Authorization:'Bearer '+token},success:value=>finish(resolve,value),fail:()=>stop(error(cancelled()?'download_paused':'download_interrupted',cancelled()?'报告预览已暂停，云端报告已保留。':'临时预览下载中断，请重试；云端报告已保留，无需重新批改。'))});if(!settled)activeTask=task;task?.onProgressUpdate?.(p=>{if(!settled&&isCurrent())publish(Number(p.totalBytesWritten)||0,verifiedProbe.total,false)})}catch(failure){stop(failure)}
  })
  ensureCurrent()
  if(Number(response.statusCode)===401)throw error('download_unauthorized','报告下载需要重新登录。',401)
  const filePath=String(response.tempFilePath||'')
  if(Number(response.statusCode)!==200||!filePath)throw error('download_response_invalid','临时报告下载响应无效，请重试。')
  publish(verifiedProbe.total,verifiedProbe.total,false,'verifying')
  const info=await fileInfo(filePath)
  if(!info||Number(info.size)!==verifiedProbe.total)throw error('download_pdf_invalid','临时报告完整性校验失败，请重试。')
  const hash=createSha256()
  for(let at=0;at<verifiedProbe.total;at+=CHUNK_BYTES){
   ensureCurrent()
   const part=await new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath,position:at,length:Math.min(CHUNK_BYTES,verifiedProbe.total-at),success:r=>resolve(bytes(r.data)),fail:()=>reject(error('download_storage_failed','临时报告文件无法读取。'))}))
   if(!part||part.length!==Math.min(CHUNK_BYTES,verifiedProbe.total-at)||at===0&&String.fromCharCode(...part.slice(0,5))!=='%PDF-')throw error('download_pdf_invalid','临时报告完整性校验失败，请重试。')
   hash.update(part)
  }
  if(hash.digest()!==verifiedProbe.etag.slice(1,-1).toLowerCase())throw error('download_pdf_invalid','临时报告完整性校验失败，请重试。')
  ensureCurrent();publish(verifiedProbe.total,verifiedProbe.total,true,'complete');return filePath
 }

 try{
 ensureCurrent();try{wx.getFileSystemManager().mkdirSync(folder,true)}catch{wx.getFileSystemManager().accessSync(folder)}
 publish(0,0,false,'connecting')
 const probe=validateRange(await requestRange(0,0),{start:0,end:0})
 verifiedProbe=probe
 ensureCurrent()
 let meta=readMetadata(scope)
 if(meta&&meta.jobId===jobId&&meta.kind===kind&&meta.etag===probe.etag&&meta.total!==probe.total)throw error('download_response_invalid','报告版本与文件长度不一致。')
 if(meta&&meta.jobId===jobId&&meta.kind===kind&&meta.etag===probe.etag){
  if(meta.complete===true)publish(meta.total,meta.total,false,'verifying')
  if(await validLocalFile(meta,{pdf:meta.complete===true})){
   if(meta.complete===true){ensureCurrent();publish(meta.total,meta.total,true,'complete');return meta.filePath}
  }else{await discardPartial(scope,meta,{removeComplete:true});meta=null}
 }else if(meta){await discardPartial(scope,meta);meta=null}
 ensureCurrent()
 if(!meta){
  const filePath=newPath(jobId,kind,label)
  await durableWrite(filePath,probe.data,false);if(!identityCurrent()){await unlink(filePath);ensureCurrent()}
  meta={schemaVersion:META_SCHEMA,owner:scope.owner,epoch:scope.epoch,jobId,kind,etag:probe.etag,total:probe.total,filePath,bytes:1,complete:false}
  let registered=false
  try{
   const latest=reports();if(latest.length>=MAX_REGISTERED_FILES)throw error('download_file_limit','本机批改报告过多，请先清理旧报告。')
   saveReports([...latest,filePath]);registered=true;writeMetadata(scope,meta)
  }catch(failure){await unlink(filePath);if(registered)saveReports(reports().filter(item=>item!==filePath));if(failure?.code)throw failure;throw error('download_storage_failed','报告断点未能保存，请检查本机空间。')}
  if(cancelled())ensureCurrent()
 }
 publish(meta.bytes,meta.total,false,'downloading')
 while(meta.bytes<meta.total){
  ensureCurrent();const start=meta.bytes,end=Math.min(start+CHUNK_BYTES-1,meta.total-1)
  let part
  try{part=validateRange(await requestRange(start,end,meta.etag),{start,end,total:meta.total,etag:meta.etag})}
  catch(failure){if(failure?.code==='download_changed')await discardPartial(scope,meta);throw failure}
  ensureCurrent();await durableWrite(meta.filePath,part.data,true)
  if(!identityCurrent()){await discardPartial(scope,meta);ensureCurrent()}
  const info=await fileInfo(meta.filePath);if(!info||Number(info.size)!==end+1){await discardPartial(scope,meta);throw error('download_checkpoint_invalid','报告断点与本机文件长度不一致，请重试。')}
  if(!identityCurrent()){await discardPartial(scope,meta);ensureCurrent()}
  meta={...meta,bytes:end+1};writeMetadata(scope,meta);publish(meta.bytes,meta.total,false);if(cancelled())ensureCurrent()
 }
 publish(meta.total,meta.total,false,'verifying')
 if(!await validLocalFile(meta,{pdf:true})){await discardPartial(scope,meta);throw error('download_pdf_invalid','下载内容不是有效的 PDF。')}
 ensureCurrent();meta={...meta,complete:true};writeMetadata(scope,meta)
 const next=[...reports().filter(item=>item!==meta.filePath),meta.filePath],evicted=next.slice(0,-MAX_COMPLETED_FILES)
 saveReports(next.slice(-MAX_COMPLETED_FILES));for(const filePath of evicted)await unlink(filePath)
 ensureCurrent();publish(meta.total,meta.total,true,'complete');return meta.filePath
 }catch(failure){if(['download_storage_full','download_storage_failed','download_file_limit'].includes(failure?.code)&&verifiedProbe)return temporaryPreview();throw failure}
}

async function downloadWholePaperPdf(options={}){
 const owner=String(options?.scope?.owner||'')
 if(!owner)throw error('download_identity_invalid','报告下载账号无效。')
 if(inflightOwners.has(owner))throw error('download_busy','同一账号已有报告正在下载，请稍后重试。')
 inflightOwners.add(owner)
 try{return await runWholePaperDownload(options)}finally{inflightOwners.delete(owner)}
}

module.exports={downloadWholePaperPdf,CHUNK_BYTES,MAX_PDF_BYTES}
