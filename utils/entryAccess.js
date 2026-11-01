// Client entry UX only. APIs still verify identity and quota on the server.
const CONSENT_KEY='stemistEntryConsent:v1',VERSION=1
let privacyReady=false,preparing=null,privacyRevision=0
function consentAccepted(){const value=wx.getStorageSync(CONSENT_KEY);return value?.version===VERSION&&value.accepted===true}
function hasValidSession(){const user=wx.getStorageSync('stemistUser'),meta=wx.getStorageSync('stemistSessionMeta');return /^ielts:\d+$/.test(String(user?.id||''))&&!!String(wx.getStorageSync('stemistSessionToken')||'').trim()&&meta?.owner===user.id&&Number.isFinite(Date.parse(meta.expiresAt))&&Date.parse(meta.expiresAt)>Date.now()}
function canEnter(){return privacyReady&&consentAccepted()&&hasValidSession()}
function acceptConsent(){wx.setStorageSync(CONSENT_KEY,{version:VERSION,accepted:true});privacyReady=true;privacyRevision++}
function notePrivacy(allowed){privacyReady=allowed===true;privacyRevision++;if(!privacyReady)wx.removeStorageSync(CONSENT_KEY)}
function prepareEntry(){
 if(preparing)return preparing
 const revision=privacyRevision
 preparing=new Promise(resolve=>{
  let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);if(revision===privacyRevision)notePrivacy(value);resolve(privacyReady)}
  const timer=setTimeout(()=>finish(false),6000)
  if(typeof wx.getPrivacySetting!=='function')return finish(false)
  try{wx.getPrivacySetting({success:r=>finish(r.needAuthorization===false),fail:()=>finish(false)})}catch{finish(false)}
 }).finally(()=>{preparing=null})
 return preparing
}
function publicReturn(route,options){
 const path=String(route||'');if(!/^(pages|bundles)\/[A-Za-z0-9_/-]+$/.test(path)||/account\/auth|legal\//.test(path))return '/pages/index/index'
 const keys=['source','feature','category','family','subjectCode','stage','routeId','book','test','curriculum','paperId','view']
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
function completeEntry(){
 if(!canEnter())return ''
 const state=getApp()?.globalData,back=state?.entryReturn,owner=String(wx.getStorageSync('stemistUser')?.id||'')
 if(state)delete state.entryReturn
 const url=back?.url&&(!back.owner||back.owner===owner)?back.url:'/pages/index/index'
 wx.reLaunch({url});return url
}
function exitEntry(onFailure){
 if(typeof wx.exitMiniProgram!=='function')return onFailure?.('请点击右上角关闭小程序。')
 wx.exitMiniProgram({fail:()=>onFailure?.('未退出，可点击右上角关闭小程序，或继续登录。')})
}
function wrapEntryPage(definition){
 if(definition.entryPublic===true)return definition
 function start(page){
  if(page.__entryDisposed||page.__entryInitialized)return
  if(!canEnter())return requireEntry(page,page.__entryOptions)
  page.__entryInitialized=true;page.setData({__entryGateBlocked:false})
  definition.onLoad?.call(page,page.__entryOptions)
  if(page.__entryVisible)definition.onShow?.call(page)
  if(page.__entryReady)definition.onReady?.call(page)
 }
 return {...definition,data:{...definition.data,__entryGateBlocked:true},
  onLoad(options){this.__entryOptions=options||{};this.__entryDisposed=false;if(canEnter())return start(this);if(consentAccepted()&&hasValidSession())return prepareEntry().then(()=>start(this));requireEntry(this,this.__entryOptions)},
  onShow(){this.__entryVisible=true;if(this.__entryInitialized){if(!canEnter()){definition.onHide?.call(this);return requireEntry(this,this.__entryOptions)}return definition.onShow?.call(this)}},
  onReady(){this.__entryReady=true;if(this.__entryInitialized&&canEnter())return definition.onReady?.call(this)},
  onResize(event){if(this.__entryInitialized&&canEnter())return definition.onResize?.call(this,event)},
  onHide(){this.__entryVisible=false;if(this.__entryInitialized)return definition.onHide?.call(this)},
  onUnload(){this.__entryDisposed=true;if(this.__entryInitialized)return definition.onUnload?.call(this)},
 }
}
module.exports={consentAccepted,hasValidSession,canEnter,acceptConsent,notePrivacy,prepareEntry,completeEntry,exitEntry,wrapEntryPage}
