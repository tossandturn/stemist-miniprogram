const {DEFAULT_API_BASE,safeApiBase}=require('./apiOrigin')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
let pending=null
const sessionError=(message,code='session_unavailable',statusCode=0)=>Object.assign(new Error(message),{code,statusCode})

function rememberNativeSession(payload,kind){
 const expiry=Date.parse(payload?.expiresAt)
 if(Number.isFinite(expiry))wx.setStorageSync('stemistSessionMeta',{kind,owner:owner(),expiresAt:payload.expiresAt})
}

function captureNativeCookie(origin,path,response){
 if(origin!==(safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE)||!/^\/api\/auth\/(?:login|register)$/.test(path))return
 const values=Array.isArray(response.cookies)?response.cookies:[response.cookies||response.header?.['Set-Cookie']||response.header?.['set-cookie']||'']
 const cookie=values.join(';').match(/(?:^|[,;]\s*)stem_session=([a-zA-Z0-9_-]{32,128})(?:;|$)/)
 if(cookie)wx.setStorageSync('stemistNativeSessionCookie',cookie[1])
}

async function refreshNativeSession({aheadMs=45000,force=false,rejectedToken=''}={}){
 const original=String(wx.getStorageSync('stemistSessionToken')||''),meta=wx.getStorageSync('stemistSessionMeta')
 // A delayed 401 for an old token must reuse an already renewed token.
 if(force&&rejectedToken&&original&&original!==rejectedToken)return original
 if(!original||!meta||!Number.isFinite(Date.parse(meta.expiresAt))){if(force)throw sessionError('登录已过期，请重新登录；草稿仍保留。','auth_required',401);return original}
 if(!force&&Date.parse(meta.expiresAt)>Date.now()+Math.min(120000,Math.max(45000,Number(aheadMs)||45000)))return original
 const started={owner:owner(),epoch:epoch(),token:original}
 if(meta.owner!==started.owner||!['wechat','password'].includes(meta.kind))throw sessionError('请重新登录以恢复当前账号。','auth_required',401)
 if(pending?.owner===started.owner&&pending?.epoch===started.epoch&&pending?.token===started.token)return pending.promise
 const base=safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE
 let expired=false,task=null,watchdog=null
 const current=()=>!expired&&owner()===started.owner&&epoch()===started.epoch&&wx.getStorageSync('stemistSessionToken')===started.token
 const deadline=new Promise((resolve,reject)=>{watchdog=setTimeout(()=>{expired=true;reject(sessionError('账号连接超时，输入已保留，请重试。'));try{task?.abort()}catch{}},25000)})
 const work=(async()=>{
  let code=''
  if(meta.kind==='wechat')code=await new Promise((resolve,reject)=>{
   if(!wx.login)return reject(new Error('微信登录暂时不可用。'))
   wx.login({timeout:10000,success:r=>r.code?resolve(r.code):reject(new Error('微信凭证未返回，请重试。')),fail:error=>reject(require('./networkError').networkFailure(error,{defaultMessage:'微信登录连接失败，请重试。'}))})
  })
  const cookie=meta.kind==='password'?wx.getStorageSync('stemistNativeSessionCookie'):''
  if(!code&&!cookie)throw sessionError('登录已过期，请重新登录；草稿仍保留。','auth_required',401)
  if(!current())throw sessionError('账号已变化。','account_changed',409)
  const result=await new Promise((resolve,reject)=>{task=wx.request({
   url:base+(code?'/api/auth/wechat':'/api/auth/status'),method:code?'POST':'GET',timeout:12000,
   header:code?{'Content-Type':'application/json'}:{Cookie:'stem_session='+cookie},...(code?{data:{code}}:{}),
   success:r=>r.statusCode===200?resolve(r.data):reject(r.statusCode===401?sessionError('登录已失效，请重新登录；草稿仍保留。','auth_required',401):sessionError('账号连接暂时不可用，请重试。')),
   fail:error=>reject(require('./networkError').networkFailure(error,{timeoutMessage:'账号连接超时，输入已保留。',defaultMessage:'账号连接暂时不可用，输入已保留。'})),
  })})
  if(!current())throw sessionError('账号已变化。','account_changed',409)
  const id=String(result?.id||result?.identity?.id||result?.user?.id||'')
  if(id!==started.owner||!result.authenticated||typeof result.accessToken!=='string'||!result.accessToken.trim()||Date.parse(result.expiresAt)<=Date.now()||!Number.isFinite(Date.parse(result.expiresAt)))throw sessionError('账号续期状态未确认，请重新登录。','auth_required',401)
  wx.setStorageSync('stemistSessionToken',result.accessToken);rememberNativeSession(result,meta.kind)
  const profile=result.identity||result.user||result,saved=wx.getStorageSync('stemistUser')||{}
  wx.setStorageSync('stemistUser',{...saved,displayName:profile.displayName??saved.displayName??'',avatarDataUrl:profile.avatarDataUrl??saved.avatarDataUrl??''})
  return result.accessToken
 })()
 const promise=Promise.race([work,deadline]).finally(()=>{clearTimeout(watchdog);if(pending?.promise===promise)pending=null})
 pending={owner:started.owner,epoch:started.epoch,token:started.token,promise}
 return promise
}
module.exports={rememberNativeSession,captureNativeCookie,refreshNativeSession}
