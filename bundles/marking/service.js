const {requestJson,safeErrorMessage}=require('../../utils/api')
const {refreshNativeSession}=require('../../utils/nativeSession')
const {DEFAULT_API_BASE,safeApiBase}=require('../../utils/apiOrigin')
const {clearLocalSession}=require('../../utils/session')
const ROOT='/api/stem/paper-marking-jobs',MAX_TOTAL=40*1024*1024
const messages={provider_image_limit:'作答和参考资料合计最多 40 页，请减少文件后新建任务。',answer_page_limit:'作答 PDF 最多 20 页，请拆分后上传。',reference_page_limit:'单份参考 PDF 最多 40 页，请拆分后上传。',asset_image_dimensions:'图片分辨率过高或无法读取，请压缩图片后重新选择。',asset_pdf_invalid:'PDF 无法读取，请确认文件未加密且可以正常打开。',asset_image_invalid:'图片无法读取，请重新选择 JPG、PNG 或 WebP。',asset_size_limit:'文件太大：PDF 最多 10 MB，单张图片最多 4 MB。',job_size_limit:'全部文件合计最多 40 MB，请压缩或拆分后上传。'}
function errorMessage(error){return messages[error?.code]||error?.message||'请求未完成，请稍后重试。'}
messages.asset_pdf_image_limit='PDF 中的图片分辨率过高，请压缩 PDF 中的图片后重新提交。'
messages.asset_pdf_object_limit='PDF 内容过于复杂，请导出简化版 PDF 后重新提交。'
messages.asset_pdf_image_count_limit='PDF 内嵌图片过多，请拆分或导出简化版后重新提交。'
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(value)
const owner=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
function scope(){return{owner:owner(),epoch:epoch()}}
function current(s){return s.owner===owner()&&s.epoch===epoch()}
function guard(s){if(!current(s))throw Error('账号已变化，请重新打开整卷批改。')}
function path(jobId){if(!id(jobId))throw Error('批改任务无效。');return ROOT+'/'+encodeURIComponent(jobId)}
function read(filePath){return new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath,success:r=>resolve(r.data),fail:()=>reject(Error('文件已失效，请重新选择。'))}))}
function mime(data){
 const a=new Uint8Array(data),head=String.fromCharCode(...a.slice(0,12))
 if(head.startsWith('%PDF-'))return'application/pdf'
 if(a[0]===255&&a[1]===216&&a[2]===255)return'image/jpeg'
 if([137,80,78,71,13,10,26,10].every((n,i)=>a[i]===n))return'image/png'
 if(head.startsWith('RIFF')&&head.slice(8)==='WEBP')return'image/webp'
 throw Error('文件格式不支持，请使用 PDF、JPG、PNG 或 WebP。')
}
async function inspect(file,s){
 guard(s)
 const limit=(file.kind==='pdf'?10:4)*1024*1024
 const info=await new Promise((resolve,reject)=>wx.getFileSystemManager().getFileInfo({filePath:file.path,success:resolve,fail:()=>reject(Error('文件已失效，请重新选择。'))}))
 guard(s);if(!Number.isFinite(info.size)||info.size<=0||info.size>limit)throw Error(file.kind==='pdf'?'PDF 不能超过 10 MB。':'单张图片不能超过 4 MB，请压缩后再选。')
 const data=await read(file.path);guard(s)
 const mediaType=mime(data),size=data.byteLength
 if(file.kind==='pdf'&&mediaType!=='application/pdf'||file.kind==='image'&&mediaType==='application/pdf')throw Error('文件内容与所选格式不符。')
 if(size>(mediaType==='application/pdf'?10:4)*1024*1024)throw Error(mediaType==='application/pdf'?'PDF 不能超过 10 MB。':'单张图片不能超过 4 MB，请压缩后再选。')
 return {...file,mediaType,size}
}
function validateFiles(files){
 if(!Array.isArray(files)||files.some(f=>!['answer','question-paper','mark-scheme'].includes(f.role)||!['application/pdf','image/jpeg','image/png','image/webp'].includes(f.mediaType)||!Number.isSafeInteger(f.size)||f.size<=0||f.size>(f.mediaType==='application/pdf'?10:4)*1024*1024))throw Error('文件信息无效，请重新选择。')
 const answers=files.filter(f=>f.role==='answer'),pdfs=answers.filter(f=>f.mediaType==='application/pdf')
 if(!answers.length||answers.length>20||pdfs.length&&(pdfs.length!==1||answers.length!==1))throw Error('作答请选择 1 份 PDF，或 1–20 张按顺序排列的图片。')
 if(files.reduce((n,f)=>n+f.size,0)>MAX_TOTAL)throw Error('全部文件合计不能超过 40 MB。')
 for(const role of ['question-paper','mark-scheme']){const refs=files.filter(f=>f.role===role);if(refs.length>1||refs.some(f=>f.mediaType!=='application/pdf'))throw Error('原卷和评分标准分别最多选择 1 份 PDF。')}
}
async function create(draft,s){
 guard(s);validateFiles(draft.files)
 let answerOrder=0
 const response=await requestJson(ROOT,{schemaVersion:'stem-paper-marking-job-v1',clientRequestId:draft.clientRequestId,title:draft.title,instructions:draft.instructions,routeId:draft.routeId,files:draft.files.map(f=>({clientAssetId:f.id,role:f.role,mediaType:f.mediaType,order:f.role==='answer'?++answerOrder:1,fileName:f.name,size:f.size}))})
 guard(s);if(!id(response?.jobId)||!Array.isArray(response.assets)||response.assets.length!==draft.files.length)throw Error('上传任务尚未完整建立，请重试。')
 if(draft.files.some(f=>response.assets.filter(a=>a.clientAssetId===f.id&&id(a.assetId)).length!==1))throw Error('文件关联未确认，请重试。')
 return response
}
async function upload(jobId,file,s,control){
 guard(s);await refreshNativeSession();guard(s)
 const info=await new Promise((resolve,reject)=>wx.getFileSystemManager().getFileInfo({filePath:file.path,success:resolve,fail:()=>reject(Error('文件已失效，请重新选择。'))}))
 guard(s);if(info.size!==file.size)throw Error('文件内容已变化，请新建批改任务。')
 const bytes=await read(file.path);guard(s)
 if(bytes.byteLength!==file.size||mime(bytes)!==file.mediaType)throw Error('文件内容已变化，请新建批改任务。')
 if(control.cancelled())throw Error('上传已暂停，点击继续上传。')
 const origin=safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE
 const token=wx.getStorageSync('stemistSessionToken')
 return new Promise((resolve,reject)=>{
  control.task=wx.request({url:origin+path(jobId)+'/files/'+encodeURIComponent(file.assetId),method:'PUT',data:bytes,timeout:60000,header:{'Content-Type':file.mediaType,Authorization:'Bearer '+token},success:r=>{
   try{guard(s);if(r.statusCode===401&&token===wx.getStorageSync('stemistSessionToken'))clearLocalSession({preserveDrafts:true});if(r.statusCode<200||r.statusCode>=300)throw Object.assign(Error(safeErrorMessage(r.data,r.statusCode)),{code:r.data?.code});if(r.data?.assetId!==file.assetId||r.data?.status!=='uploaded')throw Error('上传结果未确认，请重试。');resolve(r.data)}catch(e){reject(e)}
  },fail:()=>reject(Error(control.cancelled()?'上传已暂停，点击继续上传。':'文件上传未完成，已上传文件保留，请重试。'))})
 })
}
async function get(jobId,s){guard(s);const value=await requestJson(path(jobId),undefined,{method:'GET'});guard(s);if(value.jobId!==jobId||!['draft','queued','processing','completed','failed'].includes(value.status))throw Error('批改状态未能确认。');return value}
async function submit(draft,s){
 guard(s)
 const value=await requestJson(path(draft.jobId)+'/submit',{clientRequestId:draft.clientRequestId,answerAssetIds:draft.files.filter(f=>f.role==='answer').map(f=>f.assetId),questionPaperAssetId:draft.files.find(f=>f.role==='question-paper')?.assetId,markSchemeAssetId:draft.files.find(f=>f.role==='mark-scheme')?.assetId})
 guard(s);return value
}
async function list(s){guard(s);const value=await requestJson(ROOT+'?limit=20',undefined,{method:'GET'});guard(s);return Array.isArray(value.jobs)?value.jobs.filter(j=>id(j.jobId)):[]}
async function retry(jobId,clientRequestId,s){guard(s);const value=await requestJson(path(jobId)+'/retry',{clientRequestId});guard(s);return value}
async function cancel(jobId,clientRequestId,s){guard(s);const value=await requestJson(path(jobId)+'/cancel',{clientRequestId});guard(s);return value}
async function download(jobId,kind,s,label=''){
 guard(s);await refreshNativeSession();guard(s)
 path(jobId)
 const origin=safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE
 const fs=wx.getFileSystemManager(),folder=wx.env.USER_DATA_PATH+'/marking-reports'
 try{fs.mkdirSync(folder,true)}catch{fs.accessSync(folder)}
 const title=String(label).replace(/[^\w\u4e00-\u9fff-]/g,'-').slice(0,40)
 const filePath=folder+'/整卷批改_'+(title?title+'_':'')+jobId+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)+'_'+(kind==='source'?'作答原卷':'批改报告')+'.pdf'
 const saved=()=>{const stored=wx.getStorageSync('stemistPaperReports');return Array.isArray(stored)?stored.filter(p=>typeof p==='string'&&p.startsWith(folder+'/')&&/^整卷批改_[\w\u4e00-\u9fff-]+_(作答原卷|批改报告)\.pdf$/.test(p.slice(folder.length+1))):[]}
 const discard=()=>{fs.unlink({filePath,fail(){}});wx.setStorageSync('stemistPaperReports',saved().filter(p=>p!==filePath))}
 // Register pending copies for logout cleanup, but evict old reports only on success.
 wx.setStorageSync('stemistPaperReports',[...new Set([...saved(),filePath])])
 const token=wx.getStorageSync('stemistSessionToken')
 return new Promise((resolve,reject)=>wx.downloadFile({url:origin+path(jobId)+(kind==='source'?'/source.pdf':'/report.pdf'),filePath,timeout:60000,header:{Authorization:'Bearer '+token},success:r=>{
  try{guard(s);if(r.statusCode===401&&token===wx.getStorageSync('stemistSessionToken'))clearLocalSession({preserveDrafts:true});if(r.statusCode!==200)throw Error('报告下载未完成，请重新登录或稍后重试。');const next=[...saved().filter(p=>p!==filePath),filePath];for(const old of next.slice(0,-20))fs.unlink({filePath:old,fail(){}});wx.setStorageSync('stemistPaperReports',next.slice(-20));resolve(filePath)}catch(e){discard();reject(e)}
 },fail:()=>{discard();reject(Error('报告下载未完成，请重试。'))}}))
}
module.exports={scope,current,inspect,validateFiles,create,upload,get,submit,list,retry,cancel,download,errorMessage}
