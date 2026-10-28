const {requestJson}=require('./api')
const {rememberNativeSession,refreshNativeSession}=require('./nativeSession')
const {adoptOwner}=require('./session')
const {authGuard}=require('./authGuard')

let exchangeInFlight=null
const cancelError=()=>Object.assign(new Error('已取消微信登录。'),{code:'wechat_login_cancelled'})

function storedToken(){return String(wx.getStorageSync('stemistSessionToken')||'').trim()}

function storeIdentity(payload,verified){
 const identity=payload.identity||payload.user||{}
 adoptOwner(verified.owner)
 wx.setStorageSync('stemistSessionToken',verified.token)
 wx.setStorageSync('stemistUser',{id:verified.owner,username:payload.username||identity.username||'微信用户',displayName:identity.displayName||'',avatarDataUrl:identity.avatarDataUrl||'',roles:payload.roles||payload.workspaceRoles||identity.roles||identity.workspaceRoles||[]})
 rememberNativeSession(payload,'wechat')
 return wx.getStorageSync('stemistUser')
}

function createControl(){
 let rejectCancel
 const listeners=new Set(),cancelPromise=new Promise((resolve,reject)=>{rejectCancel=reject})
 return{
  cancelled:false,done:false,task:null,cancelPromise,
  current(){if(this.cancelled)throw cancelError()},
  isCancelled(){return this.cancelled},
  onTask(task){this.task=task;if(this.cancelled)try{task?.abort()}catch{}},
  onCancel(callback){if(this.cancelled){callback();return()=>{}}listeners.add(callback);return()=>listeners.delete(callback)},
  cancel(){if(this.cancelled||this.done)return false;this.cancelled=true;try{this.task?.abort()}catch{};for(const callback of listeners)try{callback()}catch{};listeners.clear();rejectCancel(cancelError());return true},
  finish(){this.done=true;listeners.clear()},
 }
}

function wxLoginCode(control=null){
 if(typeof wx.login!=='function')return Promise.reject(Object.assign(new Error('当前运行环境不支持微信登录'),{code:'wechat_login_unavailable'}))
 return new Promise((resolve,reject)=>{
  let settled=false,timer=null,off=()=>{}
  const finish=(settle,value)=>{if(settled)return;settled=true;clearTimeout(timer);off();settle(value)}
  timer=setTimeout(()=>finish(reject,Object.assign(new Error('微信登录超时，请稍后重试'),{code:'wechat_login_timeout'})),10000)
  off=control?.onCancel(()=>finish(reject,cancelError()))||off
  wx.login({timeout:10000,success:result=>{const code=String(result?.code||'').trim();code?finish(resolve,code):finish(reject,Object.assign(new Error('微信登录没有返回有效凭证'),{code:'wechat_code_missing'}))},fail:error=>finish(reject,Object.assign(new Error('微信登录暂时失败，请稍后重试'),{code:'wechat_login_failed',detail:error?.errMsg}))})
 })
}

function presentWeChatIdentityError(error){
 if(String(error?.code||'')!=='wechat_identity_conflict')return error
 return Object.assign(new Error('微信账号关联需要确认，原有学习记录已保留。请使用已有账号登录，或联系管理员恢复关联。'),{statusCode:409,code:'wechat_identity_conflict'})
}

async function exchangeCode(code,check=authGuard(),control=null){
 control?.current()
 check()
 try{
  const request=requestJson('/api/auth/wechat',{code},{method:'POST',timeout:10000,stemAuth:false,authCheck:check,isCancelled:()=>control?.isCancelled()===true,onTask:task=>control?.onTask(task)})
  const payload=control?await Promise.race([request,control.cancelPromise]):await request
  control?.current()
  const verified=check(payload)
  control?.current()
  return{status:'authenticated',user:storeIdentity(payload,verified),payload}
 }catch(error){throw presentWeChatIdentityError(error)}
}

function beginWeChatLogin(){
 if(exchangeInFlight&&!exchangeInFlight.control.done&&!exchangeInFlight.control.cancelled)return exchangeInFlight.handle
 const control=createControl(),flight={control,handle:null},check=authGuard()
 check()
 exchangeInFlight=flight
 const work=storedToken()
  ?Promise.race([refreshNativeSession(),control.cancelPromise]).then(()=>{control.current();return{status:'authenticated',user:wx.getStorageSync('stemistUser')||null,reused:true}})
  :Promise.race([wxLoginCode(control).then(code=>{control.current();return exchangeCode(code,check,control)}),control.cancelPromise])
 const promise=work.finally(()=>{control.finish();if(exchangeInFlight===flight)exchangeInFlight=null})
 flight.handle=Object.freeze({promise,cancel:()=>{const changed=control.cancel();if(changed&&exchangeInFlight===flight)exchangeInFlight=null;return changed}})
 return flight.handle
}

async function ensureWeChatSession({silent=true}={}){
 if(storedToken()){
  try{await refreshNativeSession();return{status:'authenticated',user:wx.getStorageSync('stemistUser')||null,reused:true}}
  catch(error){if(silent)return{status:'unavailable',error};throw error}
 }
 if(silent)return{status:'guest',user:null}
 return beginWeChatLogin().promise
}

module.exports={beginWeChatLogin,ensureWeChatSession,exchangeCode,storedToken,storeIdentity,wxLoginCode}
