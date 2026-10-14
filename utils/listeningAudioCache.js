// Authenticated source audio only. Temporary downloads are owner scoped within
// this app session; active players pin their files so eviction cannot interrupt them.
const {acquireRangeAudio,purgeRangeAudioOwner}=require('./listeningAudioRangeCache')
const {ensureMembershipAccess,scopeOf,sameScope}=require('./membershipProof')
const {authorizationForIeltsMembership,invalidateIeltsSession}=require('./protectedAsset')
const {offerMembership}=require('./membershipAccess')
const entries=new Map()
const MAX_FILE=32*1024*1024,MAX_BYTES=64*1024*1024,MAX_FILES=4,STALL=30e3,HARD=300e3
const ALLOWED=/^https:\/\/ieltsist\.com\/(?:generated\/|cambridge15\/audio\/|cambridge-local\/file\/)[a-zA-Z0-9_./% -]+$/
function remove(entry){
 if(entries.get(entry.key)===entry)entries.delete(entry.key)
 if(entry.path)try{wx.getFileSystemManager().unlink({filePath:entry.path,fail(){}})}catch{}
}
function prune(){
 let bytes=[...entries.values()].reduce((sum,e)=>sum+(e.size||0),0)
 const ready=[...entries.values()].filter(e=>e.path)
 let count=ready.length
 for(const entry of ready.sort((a,b)=>a.used-b.used)){
  if(count<=MAX_FILES&&bytes<=MAX_BYTES)break
  if(entry.refs)continue
  bytes-=entry.size;count--;remove(entry)
 }
}
const accessError=(status,authorization='')=>{const error=status===401?Object.assign(Error('登录已过期，请重新登录后继续。'),{code:'auth_required',statusCode:401}):status===403?Object.assign(Error('此内容需要全功能会员。'),{code:'membership_required',statusCode:403}):status===503?Object.assign(Error('会员状态暂未确认，请稍后重试。'),{code:'membership_authority_unavailable',statusCode:503}):null;if(error&&authorization)Object.defineProperty(error,'authorization',{value:String(authorization),enumerable:false});return error}
function legacyListeningAudio(url,{version='',owner='',authorization=async()=>'',onProgress=()=>{}}={}){
 if(!ALLOWED.test(url)||/\.\.|%2e|%2f|%5c/i.test(url))throw Error('音频地址无效，请重新选题。')
 if(typeof wx.downloadFile!=='function'||typeof wx.getFileSystemManager!=='function')return {promise:Promise.resolve(url),release(){},invalidate(){}}
 const key=String(owner)+'|'+url+'|'+String(version),fs=wx.getFileSystemManager()
 let entry=entries.get(key)
 if(entry?.path){try{fs.accessSync(entry.path)}catch{entries.delete(key);entry=null}}
 if(!entry){
  entry={key,refs:0,listeners:new Set(),used:Date.now(),size:0,path:'',progress:{bytes:0,total:0,percent:null,phase:'connecting'},done:false}
  entries.set(key,entry)
  entry.promise=new Promise((resolve,reject)=>{entry.resolve=resolve;entry.reject=reject})
 }
 entry.refs++;entry.used=Date.now();entry.listeners.add(onProgress)
 onProgress(entry.path?{bytes:entry.size,total:entry.size,phase:'cached',fromCache:true}:entry.progress)
 const clear=()=>{clearTimeout(entry.stall);clearTimeout(entry.hard)}
 const fail=value=>{
  if(entry.done)return
  entry.done=true;clear();remove(entry);entry.reject(value instanceof Error?value:Error(value))
 }
 const arm=()=>{clearTimeout(entry.stall);entry.stall=setTimeout(()=>{fail('音频下载停滞，请重试。');entry.task?.abort()},STALL)}
 if(!entry.started){
  entry.started=true;arm();entry.hard=setTimeout(()=>{fail('音频准备超时，请重试。');entry.task?.abort()},HARD)
  Promise.resolve().then(authorization).then(bearer=>{if(entry.done)return;if(bearer&&!/^Bearer [^\s]{1,4096}$/.test(String(bearer)))throw Object.assign(Error('登录状态未确认，请重新登录。'),{code:'auth_required',statusCode:401});entry.task=wx.downloadFile({url,timeout:HARD,...(bearer?{header:{Authorization:String(bearer)}}:{}),success:result=>{
   if(entry.done){if(result.tempFilePath)try{fs.unlink({filePath:result.tempFilePath,fail(){}})}catch{};return}
   entry.path=result.tempFilePath||''
   const denied=accessError(Number(result.statusCode),bearer);if(denied){if(denied.code==='auth_required')try{invalidateIeltsSession(wx,bearer)}catch{};if(denied.code==='membership_required')try{offerMembership()}catch{};return fail(denied)}
   if(result.statusCode!==200||!entry.path)return fail('音频下载未完成，请重试。')
   try{entry.size=Number(fs.statSync(entry.path).size)||0}catch{return fail('音频文件未能读取，请重试。')}
   if(entry.size<=0||entry.size>MAX_FILE)return fail('音频文件不完整或过大，请重新选题。')
   entry.done=true;clear();entry.used=Date.now();for(const listener of entry.listeners)listener({bytes:entry.size,total:entry.size,phase:'ready'});entry.resolve(entry.path);prune()
  },fail:()=>fail('音频准备失败，请检查网络后重试。')})
  entry.task?.onProgressUpdate(event=>{
   if(entry.done)return
   const before=entry.progress.bytes,bytes=Math.max(0,Number(event.totalBytesWritten)||0),total=Math.max(0,Number(event.totalBytesExpectedToWrite)||0)
   if(bytes>MAX_FILE||total>MAX_FILE){fail('音频文件过大，请重新选题。');entry.task.abort();return}
   if(bytes>before)arm();entry.progress={bytes,total,percent:total?Math.min(99,Math.floor(bytes*100/total)):null,phase:'downloading'}
   if(!entry.lastProgress||Date.now()-entry.lastProgress>=250){entry.lastProgress=Date.now();for(const listener of entry.listeners)listener(entry.progress)}
   })}).catch(error=>fail(error?.code?error:'音频准备失败，请重试。'))
 }
 let released=false
 return {promise:entry.promise,invalidate(){entry.stale=true;if(entries.get(key)===entry)entries.delete(key)},release(){
  if(released)return;released=true;entry.listeners.delete(onProgress);entry.refs--
  if(!entry.refs&&!entry.done){fail('音频准备已取消。');entry.task?.abort()}
  if(!entry.refs&&entry.stale)remove(entry)
 prune()
 }}
}
function acquireListeningAudio(url,options={}){
 if(!ALLOWED.test(url)||/\.\.|%2e|%2f|%5c/i.test(url))throw Error('音频地址无效，请重新选题。')
 const expected=scopeOf(wx);let active=null,released=false,stale=false
 try{options.onProgress?.({bytes:0,total:0,percent:null,phase:'authorizing'})}catch{}
 const promise=(async()=>{const proof=await ensureMembershipAccess({wxApi:wx});if(!sameScope(wx,expected)||proof.owner!==expected.owner||proof.epoch!==expected.epoch)throw Object.assign(Error('账号已变化，请重新打开听力练习。'),{code:'account_changed',statusCode:409});const authorization=()=>authorizationForIeltsMembership({wxApi:wx,proof,expected}),scoped={...options,owner:expected.owner+'|'+expected.epoch,authorization},ranged=acquireRangeAudio(url,scoped);active=ranged||legacyListeningAudio(url,scoped);if(stale)active.invalidate();if(released){active.release();throw Object.assign(Error('音频已取消。'),{code:'audio_cancelled'})}try{return await active.promise}catch(error){if(error?.code!=='audio_range_unsupported'||released||!ranged)throw error;ranged.release();active=legacyListeningAudio(url,scoped);if(stale)active.invalidate();return active.promise}})().catch(error=>{if(error?.code==='auth_required')try{invalidateIeltsSession(wx,error.authorization)}catch{};if(error?.code==='membership_required')try{offerMembership()}catch{};throw error})
 return{promise,release(){if(released)return;released=true;active?.release()},invalidate(){if(released)return;stale=true;active?.invalidate()}}
}
async function purgeListeningAudioScope({owner,epoch}={}){
 const ownerKey=String(owner||'')+'|'+String(Number(epoch)||0);if(!owner||String(owner)==='guest')return 0
 let removed=0
 for(const entry of [...entries.values()].filter(item=>item.key.startsWith(ownerKey+'|'))){entry.stale=true;if(!entry.refs){remove(entry);removed++}}
 return removed+await purgeRangeAudioOwner(ownerKey)
}
module.exports={acquireListeningAudio,purgeListeningAudioScope}
