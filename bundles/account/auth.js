const {signIn,currentUser,signOut}=require('../../utils/auth')
const {deviceState,syncDevice}=require('../../utils/page')
const {beginWeChatLogin}=require('../../utils/wechatAuth')
const {createAccountAttempt,leaveAccount}=require('./accountNavigation')

Page({
 onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
 data:deviceState({username:'',password:'',loading:false,wechatLoading:false,showCredentials:false,error:'',user:null,userLabel:''}),
 onShow(){
  this._active=true;this._disposed=false;syncDevice(this)
  const user=wx.getStorageSync('stemistSessionToken')?currentUser():null
  this.setData({user:user||null,userLabel:this.accountLabel(user)})
  if(user?.username)this.setData({username:user.username})
 },
 accountLabel(user){const meta=wx.getStorageSync('stemistSessionMeta')||{},wechat=meta.kind==='wechat'&&String(meta.owner||'')===String(user?.id||'');return user?.displayName||(wechat?'微信用户':user?.username||'我的账号')},
 onResize(){syncDevice(this)},
 onHide(){this._active=false;this._version=(this._version||0)+1;this.cancelLoginAttempts()},
 onUnload(){this._disposed=true;this.onHide()},
 cancelWechatAttempt(){const attempt=this._wechatAttempt;this._wechatAttempt=null;if(!attempt)return false;const changed=attempt.cancel();if(!this._disposed)this.setData({wechatLoading:false});return changed},
 cancelPasswordAttempt(){const attempt=this._passwordAttempt;this._passwordAttempt=null;if(!attempt)return false;const changed=attempt.cancel();if(!this._disposed)this.setData({loading:false});return changed},
 cancelLoginAttempts(){const wechat=this.cancelWechatAttempt(),password=this.cancelPasswordAttempt();return wechat||password},
 goBack(){this.cancelLoginAttempts();this._active=false;this._version=(this._version||0)+1;leaveAccount()},
 toggleCredentials(){this.setData({showCredentials:!this.data.showCredentials,error:''})},
 async loginWechat(){
  if(this.data.loading||this.data.wechatLoading||this._wechatAttempt)return
  this.setData({wechatLoading:true,error:''})
  const version=this._version||0,attempt=beginWeChatLogin();this._wechatAttempt=attempt
  try{
   const result=await attempt.promise
   if(!this._active||version!==(this._version||0)||this._wechatAttempt!==attempt)return
   const user=result.user||currentUser();this.setData({user,userLabel:this.accountLabel(user)})
   wx.showToast({title:'微信登录成功',icon:'success'})
  }catch(error){if(String(error?.code||'')!=='wechat_login_cancelled'&&this._active&&version===(this._version||0)&&this._wechatAttempt===attempt)this.setData({error:error.message||'微信登录暂时不可用，请稍后重试。'})}
  finally{if(this._wechatAttempt===attempt){this._wechatAttempt=null;if(this._active&&!this._disposed)this.setData({wechatLoading:false})}}
 },
 openPrivacy(){wx.navigateTo({url:'/pages/legal/privacy'})},
 editProfile(){wx.navigateTo({url:'/bundles/account/profile'})},
 openIeltsAccount(){wx.navigateTo({url:'/pages/ielts/home?view=subscription'})},
 logout(){
  if(this.data.loading||this.data.wechatLoading||this._passwordAttempt)return
  signOut();this.setData({user:null,userLabel:'',password:'',error:''});wx.showToast({title:'已退出登录',icon:'success'})
 },
 onInput(event){this.setData({[event.currentTarget.dataset.field]:event.detail.value,error:''})},
 async submit(){
  const username=this.data.username.trim().toLowerCase(),password=this.data.password
  if(this.data.loading||this.data.wechatLoading)return
  if(!/^[a-z0-9_]{3,24}$/.test(username))return this.setData({error:'用户名需为 3–24 位字母、数字或下划线'})
  if(password.length<6||password.length>72)return this.setData({error:'密码需为 6–72 个字符'})
  this.setData({loading:true,error:''})
  const version=this._version||0,attempt=createAccountAttempt();this._passwordAttempt=attempt
  try{await signIn(username,password,'login',attempt);attempt.finish();if(!this._active||version!==(this._version||0)||this._passwordAttempt!==attempt)return;const user=currentUser();wx.showToast({title:'登录成功',icon:'success'});this.setData({user,userLabel:this.accountLabel(user),password:''})}
  catch(error){if(String(error?.code||'')!=='account_login_cancelled'&&this._active&&version===(this._version||0)&&this._passwordAttempt===attempt)this.setData({error:error.message||'账号登录失败，请稍后重试'})}
  finally{attempt.finish();if(this._passwordAttempt===attempt){this._passwordAttempt=null;if(this._active&&!this._disposed)this.setData({loading:false})}}
 },
})
