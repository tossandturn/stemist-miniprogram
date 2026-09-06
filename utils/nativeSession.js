const {DEFAULT_API_BASE,safeApiBase}=require('./apiOrigin')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
let pending=null

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

async function refreshNativeSession(){
 const original=String(wx.getStorageSync('stemistSessionToken')||''),meta=wx.getStorageSync('stemistSessionMeta')
 if(!original||!meta||!Number.isFinite(Date.parse(meta.expiresAt))||Date.parse(meta.expiresAt)>Date.now()+45000)return original
 const started={owner:owner(),epoch:epoch(),token:original}
 if(meta.owner!==started.owner)throw new Error('请重新登录以恢复当前账号。')
 if(pending?.owner===started.owner&&pending?.epoch===started.epoch)return pending.promise
 const base=safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE
 const current=()=>owner()===started.owner&&epoch()===started.epoch&&wx.getStorageSync('stemistSessionToken')===started.token
 const promise=(async()=>{
  let code=''
  if(meta.kind==='wechat')code=await new Promise((resolve,reject)=>{
   if(!wx.login)return reject(new Error('微信登录暂时不可用。'))
   wx.login({timeout:10000,success:r=>r.code?resolve(r.code):reject(new Error('微信凭证未返回，请重试。')),fail:()=>reject(new Error('微信登录连接失败，请重试。'))})
  })
  const cookie=meta.kind==='password'?wx.getStorageSync('stemistNativeSessionCookie'):''
  if(!code&&!cookie)throw new Error('登录已过期，请重新登录；草稿仍保留。')
  if(!current())throw new Error('账号已变化。')
  const result=await new Promise((resolve,reject)=>wx.request({
   url:base+(code?'/api/auth/wechat':'/api/auth/status'),method:code?'POST':'GET',timeout:12000,
   header:code?{'Content-Type':'application/json'}:{Cookie:'stem_session='+cookie},...(code?{data:{code}}:{}),
   success:r=>r.statusCode===200?resolve(r.data):reject(new Error('登录续期未完成，请重新登录。')),
   fail:()=>reject(new Error('账号连接超时，输入已保留。')),
  }))
  if(!current())throw new Error('账号已变化。')
  const id=String(result?.id||result?.identity?.id||result?.user?.id||'')
  if(id!==started.owner||!result.authenticated||typeof result.accessToken!=='string'||Date.parse(result.expiresAt)<=Date.now()||!Number.isFinite(Date.parse(result.expiresAt)))throw new Error('账号续期状态未确认，请重新登录。')
  wx.setStorageSync('stemistSessionToken',result.accessToken);rememberNativeSession(result,meta.kind)
  return result.accessToken
 })().finally(()=>{if(pending?.promise===promise)pending=null})
 pending={owner:started.owner,epoch:started.epoch,promise}
 return promise
}
module.exports={rememberNativeSession,captureNativeCookie,refreshNativeSession}
