const {signIn,currentUser,signOut}=require('../../utils/auth')
const {deviceState,syncDevice}=require('../../utils/page')
const {beginWeChatLogin}=require('../../utils/wechatAuth')
const {createAccountAttempt,leaveAccount}=require('./accountNavigation')
const access=require('../../utils/entryAccess')

Page({
 entryPublic:true,
 onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
 data:deviceState({username:'',password:'',loading:false,wechatLoading:false,sessionRecovering:false,sessionRetry:false,showCredentials:false,error:'',user:null,userLabel:'',entry:false,privacy:true,privacyKnown:false,nativePrivacyRequired:true,contractName:'用户隐私保护指引'}),
 onLoad(options={}){this._enteringApp=false;this.setData({entry:options.required==='1'})},
 onShow(){
  this._active=true;this._disposed=false;syncDevice(this)
  const user=access.hasValidSession()?currentUser():null
  this.setData({user:user||null,userLabel:this.accountLabel(user),sessionRecovering:false,sessionRetry:false})
  if(user?.username)this.setData({username:user.username})
  this.checkPrivacy()
 },
 accountLabel(user){const meta=wx.getStorageSync('stemistSessionMeta')||{},wechat=meta.kind==='wechat'&&String(meta.owner||'')===String(user?.id||'');return user?.displayName||(wechat?'微信用户':user?.username||'我的账号')},
 onResize(){syncDevice(this)},
 onHide(){this._active=false;this._version=(this._version||0)+1;clearTimeout(this._privacyTimer);this.cancelLoginAttempts()},
 onUnload(){this._disposed=true;this.onHide()},
 cancelWechatAttempt(){const attempt=this._wechatAttempt;this._wechatAttempt=null;if(!attempt)return false;const changed=attempt.cancel();if(!this._disposed)this.setData({wechatLoading:false});return changed},
 cancelPasswordAttempt(){const attempt=this._passwordAttempt;this._passwordAttempt=null;if(!attempt)return false;const changed=attempt.cancel();if(!this._disposed)this.setData({loading:false});return changed},
 cancelLoginAttempts(){const wechat=this.cancelWechatAttempt(),password=this.cancelPasswordAttempt();return wechat||password},
 goBack(){this.cancelLoginAttempts();this._version=(this._version||0)+1;if(this.data.entry||!access.canEnter())return access.returnToBrowse(error=>this.setData({error}));this._active=false;leaveAccount()},
 checkPrivacy(){
  const version=this._version||0;this.setData({privacyKnown:false});clearTimeout(this._privacyTimer)
  let settled=false;const finish=result=>{if(settled||!this._active||version!==(this._version||0))return;settled=true;clearTimeout(this._privacyTimer);const known=typeof result?.needAuthorization==='boolean';access.notePrivacy(known?result.needAuthorization===false:null);const accepted=access.consentAccepted();this.setData({privacyKnown:known,privacy:!accepted,nativePrivacyRequired:result?.needAuthorization!==false,contractName:result?.privacyContractName||'用户隐私保护指引',...(!known&&!accepted?{error:'隐私许可暂未读取，请重试。'}:{})});if(this.data.entry&&access.canEnter())this.finishEntry();else if(accepted)this.restoreSession()}
  this._privacyTimer=setTimeout(()=>finish(null),6000)
  try{if(typeof wx.getPrivacySetting!=='function')return finish(null);wx.getPrivacySetting({success:finish,fail:()=>finish(null)})}catch{finish(null)}
 },
 async restoreSession(){
  if(!this._active||!access.consentAccepted()||this.data.sessionRecovering||access.hasValidSession())return
  const token=wx.getStorageSync('stemistSessionToken'),user=currentUser(),meta=wx.getStorageSync('stemistSessionMeta')
  if(!token||!user?.id||meta?.owner!==user.id||!['wechat','password'].includes(meta.kind))return
  const version=this._version||0
  this.setData({sessionRecovering:true,sessionRetry:false,user,userLabel:this.accountLabel(user),error:''})
  try{
   await require('../../utils/nativeSession').refreshNativeSession()
   if(!this._active||version!==(this._version||0))return
   const fresh=currentUser();this.setData({user:fresh,userLabel:this.accountLabel(fresh)})
   if(this.data.entry&&access.canEnter())this.finishEntry()
  }catch(error){
   if(!this._active||version!==(this._version||0))return
   if(error?.code==='auth_required'&&token===wx.getStorageSync('stemistSessionToken')){require('../../utils/session').clearLocalSession({preserveDrafts:true});this.setData({user:null,userLabel:'',error:'登录已失效，请重新登录；草稿仍保留。'})}
   else this.setData({sessionRetry:true,error:error?.code==='network_proxy_tunnel'?error.message:'连接暂时失败，账号与草稿已保留，请重试连接。'})
  }finally{if(this._active&&version===(this._version||0))this.setData({sessionRecovering:false})}
 },
 agreePrivacy(){if(!this._active||!this.data.privacyKnown)return;access.acceptConsent();this.setData({privacy:false,error:''});if(this.data.entry&&access.canEnter())this.finishEntry()},
 finishEntry(){if(this._enteringApp||!access.canEnter())return;this._enteringApp=true;access.completeEntry(error=>{this._enteringApp=false;if(this._active)this.setData({error})})},
 continueApp(){if(access.canEnter())return this.finishEntry();this.setData({error:'请先完成隐私许可和登录。'})},
 toggleCredentials(){this.setData({showCredentials:!this.data.showCredentials,error:''})},
 async loginWechat(){
  if(this.data.loading||this.data.wechatLoading||this.data.sessionRecovering||this._wechatAttempt)return
  if(!this.data.privacyKnown||!access.consentAccepted())return this.setData({privacy:true,error:'请先阅读并同意隐私保护指引。'})
  if(!access.hasValidSession()&&wx.getStorageSync('stemistSessionToken'))require('../../utils/session').clearLocalSession({preserveDrafts:true})
  this.setData({wechatLoading:true,error:''})
  const version=this._version||0,attempt=beginWeChatLogin();this._wechatAttempt=attempt
  try{
   const result=await attempt.promise
   if(!this._active||version!==(this._version||0)||this._wechatAttempt!==attempt)return
   const user=result.user||currentUser();this.setData({user,userLabel:this.accountLabel(user)})
   wx.showToast({title:'微信登录成功',icon:'success'})
   if(this.data.entry&&access.canEnter())this.finishEntry()
  }catch(error){if(String(error?.code||'')!=='wechat_login_cancelled'&&this._active&&version===(this._version||0)&&this._wechatAttempt===attempt)this.setData({error:error.message||'微信登录暂时不可用，请稍后重试。'})}
  finally{if(this._wechatAttempt===attempt){this._wechatAttempt=null;if(this._active&&!this._disposed)this.setData({wechatLoading:false})}}
 },
 openPrivacy(){wx.navigateTo({url:'/pages/legal/privacy'})},
 editProfile(){wx.navigateTo({url:'/bundles/account/profile'})},
 openMembership(){wx.navigateTo({url:'/bundles/account/membership'})},
 openIeltsAccount(){wx.navigateTo({url:'/pages/ielts/home?view=subscription'})},
 logout(){
  if(this.data.loading||this.data.wechatLoading||this._passwordAttempt)return
  signOut();this.setData({user:null,userLabel:'',password:'',error:''});wx.showToast({title:'已退出登录',icon:'success'})
 },
 onInput(event){this.setData({[event.currentTarget.dataset.field]:event.detail.value,error:''})},
 async submit(){
  const username=this.data.username.trim().toLowerCase(),password=this.data.password
  if(this.data.loading||this.data.wechatLoading||this.data.sessionRecovering)return
  if(!this.data.privacyKnown||!access.consentAccepted())return this.setData({privacy:true,error:'请先阅读并同意隐私保护指引。'})
  if(!/^[a-z0-9_]{3,24}$/.test(username))return this.setData({error:'用户名需为 3–24 位字母、数字或下划线'})
  if(password.length<6||password.length>72)return this.setData({error:'密码需为 6–72 个字符'})
  this.setData({loading:true,error:''})
  const version=this._version||0,attempt=createAccountAttempt();this._passwordAttempt=attempt
  try{await signIn(username,password,'login',attempt);attempt.finish();if(!this._active||version!==(this._version||0)||this._passwordAttempt!==attempt)return;const user=currentUser();wx.showToast({title:'登录成功',icon:'success'});this.setData({user,userLabel:this.accountLabel(user),password:''});if(this.data.entry&&access.canEnter())this.finishEntry()}
  catch(error){if(String(error?.code||'')!=='account_login_cancelled'&&this._active&&version===(this._version||0)&&this._passwordAttempt===attempt)this.setData({error:error.message||'账号登录失败，请稍后重试'})}
  finally{attempt.finish();if(this._passwordAttempt===attempt){this._passwordAttempt=null;if(this._active&&!this._disposed)this.setData({loading:false})}}
 },
})
