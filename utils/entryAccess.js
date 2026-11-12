// Client entry UX only. APIs still verify identity and quota on the server.
const CONSENT_KEY='stemistEntryConsent:v1',VERSION=1
let privacyReady=false,preparing=null,privacyRevision=0
function consentAccepted(){const value=wx.getStorageSync(CONSENT_KEY);return value?.version===VERSION&&value.accepted===true}
function hasValidSession(){const user=wx.getStorageSync('stemistUser'),meta=wx.getStorageSync('stemistSessionMeta');return /^ielts:\d+$/.test(String(user?.id||''))&&!!String(wx.getStorageSync('stemistSessionToken')||'').trim()&&meta?.owner===user.id&&Number.isFinite(Date.parse(meta.expiresAt))&&Date.parse(meta.expiresAt)>Date.now()}
function canEnter(){return privacyReady&&consentAccepted()&&hasValidSession()}
function acceptConsent(){wx.setStorageSync(CONSENT_KEY,{version:VERSION,accepted:true});privacyReady=true;privacyRevision++}
function notePrivacy(allowed){
 // An unavailable platform lookup is not a withdrawal of a prior explicit
 // agreement. It must never manufacture agreement for a guest either.
 if(typeof allowed!=='boolean'){privacyReady=privacyReady||consentAccepted();return privacyReady}
 privacyReady=allowed;privacyRevision++;if(!privacyReady)wx.removeStorageSync(CONSENT_KEY)
 return privacyReady
}
function prepareEntry(){
 if(preparing)return preparing
 const revision=privacyRevision
 preparing=new Promise(resolve=>{
  let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);if(revision===privacyRevision)notePrivacy(value);resolve(privacyReady)}
  const timer=setTimeout(()=>finish(null),6000)
  if(typeof wx.getPrivacySetting!=='function')return finish(null)
  try{wx.getPrivacySetting({success:r=>finish(typeof r?.needAuthorization==='boolean'?!r.needAuthorization:null),fail:()=>finish(null)})}catch{finish(null)}
 }).finally(()=>{preparing=null})
 return preparing
}
function publicReturn(route,options){
 const path=String(route||'');if(!/^(pages|bundles)\/[A-Za-z0-9_/-]+$/.test(path)||/account\/auth|legal\//.test(path))return '/pages/index/index'
 const keys=['source','feature','category','family','subjectCode','stage','routeId','book','test','curriculum','paperId','view','roomId','invite','create','board','boardSubject','course']
 const query=keys.filter(k=>typeof options?.[k]==='string'&&/^[A-Za-z0-9_:. -]{1,100}$/.test(options[k])).map(k=>k+'='+encodeURIComponent(options[k])).join('&')
 return '/'+path+(query?'?'+query:'')
}
function requireEntry(page,options){
 page.setData({__entryGateBlocked:true});if(page.__entryRedirected)return
 page.__entryRedirected=true
 const state=getApp()?.globalData
 if(state&&!state.entryReturn)state.entryReturn={url:publicReturn(page.route,options),owner:String(wx.getStorageSync('stemistUser')?.id||'')}
 wx.reLaunch({url:'/bundles/account/auth?required=1',fail:()=>{page.__entryRedirected=false}})
}
function completeEntry(onFailure){
 if(!canEnter())return ''
 const state=getApp()?.globalData,back=state?.entryReturn,owner=String(wx.getStorageSync('stemistUser')?.id||'')
 const url=back?.url&&(!back.owner||back.owner===owner)?back.url:'/pages/index/index'
 wx.reLaunch({url,success:()=>{if(state?.entryReturn===back)delete state.entryReturn},fail:()=>onFailure?.('进入学习失败，请重试。')});return url
}
function returnToBrowse(onFailure){
 const state=getApp()?.globalData
 if(state?.entryReturn)delete state.entryReturn
 try{wx.reLaunch({url:'/pages/index/index',fail:()=>onFailure?.('暂时无法返回首页，请重试。')})}
 catch{onFailure?.('暂时无法返回首页，请重试。')}
 return '/pages/index/index'
}
function wrapEntryPage(definition){
 if(definition.entryPublic===true)return definition
 function recoverable(){const user=wx.getStorageSync('stemistUser'),meta=wx.getStorageSync('stemistSessionMeta');return consentAccepted()&&/^ielts:\d+$/.test(String(user?.id||''))&&!!wx.getStorageSync('stemistSessionToken')&&meta?.owner===user.id&&['wechat','password'].includes(meta.kind)}
 function start(page){
  if(page.__entryDisposed)return
  if(!canEnter())return requireEntry(page,page.__entryOptions)
  page.__entryRedirected=false;page.setData({__entryGateBlocked:false,__entryRecoveryMessage:''})
  if(page.__entryInitialized){if(page.__entryVisible){page.__entryShown=true;definition.onShow?.call(page)}return}
  page.__entryInitialized=true
  definition.onLoad?.call(page,page.__entryOptions)
  if(page.__entryVisible){page.__entryShown=true;definition.onShow?.call(page)}
  if(page.__entryReady)definition.onReady?.call(page)
 }
 function resume(page){
  if(page.__entryDisposed)return
  if(page.__entryRecovery)return page.__entryRecovery
  if(canEnter())return start(page)
  if(page.__entryShown){page.__entryShown=false;definition.onHide?.call(page)}
  if(!recoverable()&&!(consentAccepted()&&hasValidSession()))return requireEntry(page,page.__entryOptions)
  page.setData({__entryGateBlocked:true,__entryRecoveryMessage:''})
  const token=wx.getStorageSync('stemistSessionToken')
  const work=(async()=>{
   await prepareEntry()
   if(page.__entryDisposed)return
   if(!consentAccepted())return requireEntry(page,page.__entryOptions)
   try{await require('./nativeSession').refreshNativeSession()}
   catch(error){
    if(page.__entryDisposed)return
    if(error?.code==='auth_required'){
     if(token===wx.getStorageSync('stemistSessionToken'))require('./session').clearLocalSession({preserveDrafts:true})
     return requireEntry(page,page.__entryOptions)
    }
    const message=error?.code==='network_proxy_tunnel'?error.message:'连接暂时失败，账号与草稿已保留。'
    page.setData({__entryRecoveryMessage:message})
    if(page.__entryVisible&&typeof wx.showModal==='function')wx.showModal({title:'连接暂时失败',content:error?.code==='network_proxy_tunnel'?message:'账号与草稿已保留，无需重新登录。请检查网络后重试。',confirmText:'重试连接',cancelText:'返回首页',success:choice=>{if(page.__entryDisposed)return;if(choice.confirm)resume(page);else if(choice.cancel)returnToBrowse()}})
    return
   }
   start(page)
  })().finally(()=>{if(page.__entryRecovery===work)page.__entryRecovery=null})
  page.__entryRecovery=work;return work
 }
 return {...definition,data:{...definition.data,__entryGateBlocked:true},
  onLoad(options){this.__entryOptions=options||{};this.__entryDisposed=false;return resume(this)},
  onShow(){this.__entryVisible=true;return resume(this)},
  onReady(){this.__entryReady=true;if(this.__entryInitialized&&canEnter())return definition.onReady?.call(this)},
  onResize(event){if(this.__entryInitialized&&canEnter())return definition.onResize?.call(this,event)},
  onHide(){this.__entryVisible=false;if(this.__entryShown){this.__entryShown=false;return definition.onHide?.call(this)}},
  onUnload(){this.__entryDisposed=true;if(this.__entryInitialized)return definition.onUnload?.call(this)},
 }
}
module.exports={consentAccepted,hasValidSession,canEnter,acceptConsent,notePrivacy,prepareEntry,completeEntry,returnToBrowse,wrapEntryPage}
