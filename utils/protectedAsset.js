const {DEFAULT_API_BASE,DEFAULT_IELTS_API_BASE,safeApiBase,safeIeltsApiBase}=require('./apiOrigin')
const {createSha256}=require('./sha256')
const {clearLocalSession}=require('./session')
const {offerMembership}=require('./membershipAccess')
const {ensureMembershipAccess,authorizationForMembership,scopeOf,sameScope}=require('./membershipProof')
const {ensureIeltsSession}=require('./ieltsLearning')

const MAX_ASSET_BYTES=10*1024*1024,HASH_CHUNK=512*1024
const failure=(message,code,statusCode=0)=>Object.assign(Error(message),{code,statusCode})
const bearerToken=value=>/^Bearer ([^\s]{1,4096})$/.exec(String(value||''))?.[1]||''
function invalidateIeltsSession(wxApi=wx,authorization=''){
 const key='stemistIeltsSessionState',current=wxApi.getStorageSync?.(key),identity=scopeOf(wxApi)
 const rejected=bearerToken(authorization)
 if(!current||current.owner!==identity.owner||Number(current.epoch)!==identity.epoch||!rejected||String(current.token||'')!==rejected)return false
 try{wxApi.setStorageSync?.(key,{...current,token:'',expiresAt:''});return true}catch{return false}
}
function invalidateStemSession(wxApi=wx,authorization=''){const rejected=bearerToken(authorization);if(!rejected||rejected!==String(wxApi.getStorageSync?.('stemistSessionToken')||''))return false;try{clearLocalSession({preserveDrafts:true});return true}catch{return false}}
function assetUrl(value,authority='stem'){
 const base=authority==='ielts'?(safeIeltsApiBase(getApp()?.globalData?.ieltsApiBaseUrl)||DEFAULT_IELTS_API_BASE):(safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE),url=String(value||'')
 if(!url.startsWith(base)||/\.\.|%2e|%2f|%5c/i.test(url))throw failure('受保护图片地址无效。','protected_asset_invalid')
 const path=url.slice(base.length)
 if(authority==='ielts'){
  if(!/^\/generated\/(?:listening|reading|writing|speaking)-pages\/cam\d+\/test\d+\/page-\d+\.webp$/.test(path))throw failure('受保护图片地址无效。','protected_asset_invalid')
  return url
 }
 const question=/^\/question-assets\/[A-Za-z0-9_-]+\/(?:qp|ms)-\d+\.(?:jpg|jpeg|png|webp)$/.test(path)
 const region=/^\/api\/stem\/practice-source-image\?routeId=[a-z0-9-]+&sourceQuestionId=[-A-Za-z0-9_%:]+&region=(?:[0-9]|1[0-9])&v=[a-f0-9]{64}(?:&view=region)?$/.test(path)
 const curriculum=/^\/api\/stem\/curriculum-practice\/source\/[A-Za-z0-9._%:-]{1,180}\/[A-Za-z0-9._%:-]{1,180}\/[a-f0-9]{64}\.png$/.test(path)
 if(!question&&!region&&!curriculum)throw failure('受保护图片地址无效。','protected_asset_invalid')
 return url
}
async function authorizationForIeltsMembership({wxApi=wx,proof,expected=scopeOf(wxApi),ensureIelts=ensureIeltsSession}={}){
 if(!proof||proof.owner!==expected.owner||proof.epoch!==expected.epoch||!sameScope(wxApi,expected))throw failure('账号已变化，请重新打开内容。','account_changed',409)
 const stemToken=String(wxApi.getStorageSync?.('stemistSessionToken')||'')
 if(!proof.enforcementEnabled&&!stemToken)return''
 if(expected.owner==='guest')throw failure('请先登录后使用会员内容。','auth_required',401)
 const session=await ensureIelts()
 if(!sameScope(wxApi,expected)||session?.owner!==expected.owner||Number(session?.epoch)!==expected.epoch)throw failure('账号已变化，请重新打开内容。','account_changed',409)
 const token=String(session?.token||'')
 if(!token)throw failure('登录已过期，请重新登录。','auth_required',401)
 return'Bearer '+token
}
function statusError(statusCode){
 if(statusCode===401)return failure('登录已过期，请重新登录。','auth_required',401)
 if(statusCode===403)return failure('此功能需要开通全功能会员后继续。','membership_required',403)
 if(statusCode===503)return failure('会员状态暂未确认，请稍后重试。','membership_authority_unavailable',503)
 return failure('原图下载失败，请重试。','protected_asset_http',statusCode)
}
function createProtectedAssetLoader(options={}){
 const wxApi=options.wxApi||wx,authority=options.authority==='ielts'?'ielts':'stem',membershipGate=options.membershipGate||ensureMembershipAccess,authorize=options.authorize||(authority==='ielts'?authorizationForIeltsMembership:authorizationForMembership),onMembershipRequired=options.onMembershipRequired||offerMembership,onUnauthorized=options.onUnauthorized||(authority==='ielts'?(authorization=>invalidateIeltsSession(wxApi,authorization)):(authorization=>invalidateStemSession(wxApi,authorization))),onProgress=typeof options.onProgress==='function'?options.onProgress:()=>{},cache=new Map(),active=new Set(),limit=Math.max(1,Math.min(40,Number(options.cacheLimit)||20))
 let identity=scopeOf(wxApi),generation=0,disposed=false
 const current=context=>!disposed&&context.generation===generation&&sameScope(wxApi,context.identity)
 const progress=(context,value)=>{if(current(context))try{onProgress({...value,owner:context.identity.owner,epoch:context.identity.epoch})}catch{}}
 const cancelAll=error=>{for(const entry of [...active])entry.cancel(error)}
 function setScope(){const next=scopeOf(wxApi);if(next.owner===identity.owner&&next.epoch===identity.epoch)return false;generation++;cancelAll(failure('账号已变化，请重新打开内容。','account_changed',409));cache.clear();identity=next;return true}
 const exists=path=>new Promise(resolve=>{const fs=wxApi.getFileSystemManager?.();if(typeof fs?.access!=='function')return resolve(false);try{fs.access({path,success:()=>resolve(true),fail:()=>resolve(false)})}catch{resolve(false)}})
 const read=(fs,path,position,length)=>new Promise((resolve,reject)=>{try{fs.readFile({filePath:path,position,length,success:r=>resolve(r.data),fail:()=>reject(failure('原图校验失败，请重试。','protected_asset_integrity'))})}catch{reject(failure('原图校验失败，请重试。','protected_asset_integrity'))}})
 async function verify(path,expectedBytes,expectedSha256){
  const fs=wxApi.getFileSystemManager?.();let size=0;try{size=Number(fs?.statSync?.(path)?.size)||0}catch{}
  if(!size||size>MAX_ASSET_BYTES||expectedBytes&&size!==expectedBytes)throw failure('原图校验失败，请重试。','protected_asset_integrity')
  if(expectedSha256){const hash=createSha256();for(let at=0;at<size;at+=HASH_CHUNK){const length=Math.min(HASH_CHUNK,size-at),data=await read(fs,path,at,length),bytes=Object.prototype.toString.call(data)==='[object ArrayBuffer]'?new Uint8Array(data):ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):null;if(!bytes||bytes.length!==length)throw failure('原图校验失败，请重试。','protected_asset_integrity');hash.update(bytes)}if(hash.digest()!==expectedSha256)throw failure('原图校验失败，请重试。','protected_asset_integrity')}
 }
 async function load(value,{expectedBytes=0,sha256='',cacheKey=value}={}){
  const url=assetUrl(value,authority);setScope();const context={generation,identity:{...identity}};progress(context,{phase:'authorizing',url,bytes:0,total:0,percent:null});const proof=await membershipGate({wxApi});if(!current(context)||proof.owner!==context.identity.owner||proof.epoch!==context.identity.epoch)throw failure('账号已变化，请重新打开内容。','account_changed',409)
  const key=context.identity.owner+'|'+context.identity.epoch+'|'+String(cacheKey||url),remembered=cache.get(key)
  if(remembered&&await exists(remembered.path)){if(!current(context))throw failure('账号已变化，请重新打开内容。','account_changed',409);remembered.used=Date.now();progress(context,{phase:'cached',url,bytes:remembered.bytes||0,total:remembered.bytes||0,percent:100});return remembered.path}
  cache.delete(key);const authorization=await authorize({wxApi,proof,expected:context.identity});if(!current(context))throw failure('账号已变化，请重新打开内容。','account_changed',409)
  progress(context,{phase:'connecting',url,bytes:0,total:Number(expectedBytes)||0,percent:0})
  const path=await new Promise((resolve,reject)=>{
   let settled=false
   const entry={task:null,cancel:error=>{const task=entry.task;finish(reject,error);try{task?.abort?.()}catch{}}}
   const finish=(fn,result)=>{if(settled)return;settled=true;active.delete(entry);fn(result)}
   active.add(entry)
   try{entry.task=wxApi.downloadFile({url,timeout:30000,...(authorization?{header:{Authorization:authorization}}:{}),success:result=>{if(!current(context))return entry.cancel(failure('账号已变化，请重新打开内容。','account_changed',409));const status=Number(result?.statusCode);if(status!==200){if(status===401)try{onUnauthorized(authorization)}catch{};if(status===403)try{onMembershipRequired()}catch{};return finish(reject,statusError(status))}const local=String(result?.tempFilePath||result?.filePath||'');if(!local)return finish(reject,failure('原图下载完成但本机路径不可用。','protected_asset_invalid'));finish(resolve,local)},fail:error=>{if(!current(context))return finish(reject,failure('账号已变化，请重新打开内容。','account_changed',409));const raw=String(error?.errMsg||'');finish(reject,failure(/timeout|超时/i.test(raw)?'原图下载超时，请重试。':'原图下载失败，请重试。',/timeout|超时/i.test(raw)?'network_timeout':'network_error'))}});entry.task?.onProgressUpdate?.(event=>{if(settled)return;const bytes=Math.max(0,Number(event?.totalBytesWritten)||0),total=Math.max(0,Number(event?.totalBytesExpectedToWrite)||Number(expectedBytes)||0);progress(context,{phase:'downloading',url,bytes,total,percent:total?Math.min(99,Math.floor(bytes*100/total)):null})})}catch{finish(reject,failure('原图下载未能启动，请重试。','network_error'))}
  })
  if(!current(context))throw failure('账号已变化，请重新打开内容。','account_changed',409)
  const bytes=Number(expectedBytes)||0,digest=/^[a-f0-9]{64}$/.test(String(sha256||''))?String(sha256):'';await verify(path,bytes,digest);if(!current(context))throw failure('账号已变化，请重新打开内容。','account_changed',409)
  let actualBytes=0;try{actualBytes=Number(wxApi.getFileSystemManager?.()?.statSync?.(path)?.size)||0}catch{}cache.set(key,{path,bytes:actualBytes,used:Date.now()});while(cache.size>limit)cache.delete(cache.keys().next().value);progress(context,{phase:'ready',url,bytes:actualBytes,total:actualBytes,percent:100});return path
 }
 function dispose(){if(disposed)return;disposed=true;generation++;cancelAll(failure('页面已关闭。','protected_asset_cancelled'));cache.clear()}
 return{load,setScope,dispose,inspect:()=>({owner:identity.owner,epoch:identity.epoch,entries:cache.size,active:active.size})}
}
module.exports={MAX_ASSET_BYTES,assetUrl,authorizationForIeltsMembership,invalidateIeltsSession,createProtectedAssetLoader}
