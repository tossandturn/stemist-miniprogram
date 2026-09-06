const {DEFAULT_IELTS_API_BASE,safeIeltsApiBase}=require('./apiOrigin')
const {refreshNativeSession}=require('./nativeSession')
const STATE='stemistIeltsSessionState'
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
let nativeSessionPending=null
function context(){const saved=wx.getStorageSync(STATE);return saved&&saved.owner===owner()&&saved.epoch===epoch()?saved:{owner:owner(),epoch:epoch(),guest:'',token:''}}
async function ensureIeltsSession(){
 const originalOwner=owner(),originalEpoch=epoch()
 await refreshNativeSession()
 if(originalOwner!==owner()||originalEpoch!==epoch())throw new Error('账号已变化。')
 const stemToken=wx.getStorageSync('stemistSessionToken')
 if(!stemToken)return context()
 const started=context()
 if(started.owner==='guest')throw new Error('请重新登录以恢复账号关联。')
 if(started.token&&Date.parse(started.expiresAt)>Date.now()+30000)return started
 if(nativeSessionPending?.owner===started.owner&&nativeSessionPending?.epoch===started.epoch)return nativeSessionPending.promise
 const base=safeIeltsApiBase(getApp()?.globalData?.ieltsApiBaseUrl)||DEFAULT_IELTS_API_BASE
 const promise=new Promise((resolve,reject)=>wx.request({url:base+'/api/auth/native-session',method:'POST',timeout:12000,header:{'Content-Type':'application/json','X-Stem-Identity':stemToken},data:{source:'stemist-miniprogram'},
  success(response){
   if(owner()!==started.owner||epoch()!==started.epoch)return reject(new Error('账号已变化。'))
   const data=response.data||{}
   if(response.statusCode!==200||data.protocol!=='ielts-native-session-v1'||typeof data.token!=='string'||!Number.isFinite(Date.parse(data.expiresAt))||String(data.user?.id)!==started.owner.replace(/^ielts:/,''))return reject(new Error('账号关联暂未完成，请稍后重试或重新登录。'))
   const next={...context(),token:data.token,expiresAt:data.expiresAt};wx.setStorageSync(STATE,next);resolve(next)
  },fail(){reject(new Error('账号连接超时，请重试。'))}
 })).finally(()=>{if(nativeSessionPending?.promise===promise)nativeSessionPending=null})
 nativeSessionPending={owner:started.owner,epoch:started.epoch,promise};return promise
}
async function requestIeltsLearning(path,data,{method='POST',timeout=20000,headers={}}={}){
 const originalOwner=owner(),originalEpoch=epoch()
 const base=safeIeltsApiBase(getApp()?.globalData?.ieltsApiBaseUrl)||DEFAULT_IELTS_API_BASE
 if(!/^\/api\/[a-zA-Z0-9/_?=&.%:-]+$/.test(path)||path.includes('..'))return Promise.reject(new Error('请求地址无效。'))
 const started=await ensureIeltsSession()
 if(originalOwner!==owner()||originalEpoch!==epoch())throw new Error('账号已变化，当前请求已取消。')
 return new Promise((resolve,reject)=>wx.request({url:base+path,method,timeout,data,
  header:{'Content-Type':'application/json',...(started.token?{Authorization:'Bearer '+started.token}:{}),...(started.guest?{Cookie:'ieltsist_objective_guest='+started.guest}:{}),...headers},
  success(response){
   if(owner()!==started.owner||epoch()!==started.epoch)return reject(new Error('账号已变化，当前请求已取消。'))
   // Keep only this app's newly issued guest capability, never browser cookies
   // or a STEM bearer forwarded to an unrelated IELTS authorization path.
   const cookies=Array.isArray(response.cookies)?response.cookies:[response.cookies||response.header?.['Set-Cookie']||response.header?.['set-cookie']||'']
   const match=cookies.join(';').match(/(?:^|[,;]\s*)ieltsist_objective_guest=([a-zA-Z0-9_-]{32,128})(?:;|$)/)
   if(match)wx.setStorageSync(STATE,{...context(),guest:match[1]})
   if(response.statusCode>=200&&response.statusCode<300)return resolve(response.data)
   if(response.statusCode===401&&started.token&&context().token===started.token)wx.setStorageSync(STATE,{...context(),token:'',expiresAt:''})
   const error=new Error(response.statusCode===401?'请登录后继续。':response.statusCode===409?'这次练习状态已变化，请重新打开。':response.statusCode===429?'请求较多，请稍后再试。':'服务暂未完成请求，输入已保留。')
   error.statusCode=response.statusCode;error.code=String(response.data?.code||'');reject(error)
  },fail(error){reject(new Error(/timeout/i.test(error?.errMsg||'')?'网络超时，请重试。':'网络连接失败，输入已保留。'))}}))
}
module.exports={requestIeltsLearning,ensureIeltsSession}
