const {deviceState,syncDevice}=require('../../utils/page')
const {context,isCurrent,normalizeName,profileRequest,cacheProfile,readAvatar}=require('./profileData')
const {leaveAccount}=require('./accountNavigation')

Page({
 onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
 data:deviceState({displayName:'',avatarDataUrl:'',loading:false,loaded:false,processing:false,saving:false,error:'',saved:false}),
 onLoad(){this._owner=context();this._disposed=false;this._leaving=false;this._generation=0;this._avatarVersion=0;return this.loadProfile()},
 onShow(){this._leaving=false;syncDevice(this);this.checkOwner()},
 onResize(){syncDevice(this)},
 onHide(){this.invalidatePending()},
 onUnload(){this._disposed=true;this.invalidatePending(false)},
 current(generation=this._generation){return!this._disposed&&!this._leaving&&generation===this._generation&&isCurrent(this._owner)},
 invalidatePending(update=true){this._leaving=true;this._generation++;this._avatarVersion++;if(update&&!this._disposed)this.setData({loading:false,processing:false,saving:false})},
 checkOwner(generation=this._generation){
  if(this.current(generation))return true
  if(!this._disposed&&!this._leaving&&generation===this._generation)this.setData({displayName:'',avatarDataUrl:'',loaded:false,processing:false,saving:false,saved:false,error:'账号已变化，请返回后重新登录。'})
  return false
 },
 async loadProfile(){
  if(this.data.loading||this.data.saving)return
  const generation=this._generation
  this.setData({loading:true,error:'',loaded:false})
  try{const profile=await profileRequest(this._owner);if(!this.checkOwner(generation))return;cacheProfile(this._owner,profile);this.setData({displayName:profile.displayName,avatarDataUrl:profile.avatarDataUrl,loaded:true})}
  catch(error){if(this.checkOwner(generation))this.setData({error:error.message||'资料读取失败，请重试。'})}
  finally{if(this.current(generation))this.setData({loading:false})}
 },
 async chooseAvatar(event){
  if(!this.current()||!this.data.loaded||this.data.saving||this.data.processing)return
  const path=event.detail?.avatarUrl;if(!path)return
  const generation=this._generation,version=++this._avatarVersion
  this.setData({processing:true,error:'',saved:false})
  try{const avatarDataUrl=await readAvatar(path);if(this.checkOwner(generation)&&version===this._avatarVersion)this.setData({avatarDataUrl})}
  catch(error){if(this.checkOwner(generation)&&version===this._avatarVersion)this.setData({error:error.message||'头像处理失败，请重新选择。'})}
  finally{if(this.current(generation)&&version===this._avatarVersion)this.setData({processing:false})}
 },
 async submit(event){
  if(!this.current()||!this.data.loaded||this.data.loading||this.data.processing||this.data.saving)return
  let displayName;try{displayName=normalizeName(event.detail?.value?.nickname)}catch(error){this.setData({error:error.message});return}
  const generation=this._generation
  this.setData({displayName,saving:true,error:'',saved:false})
  try{const profile=await profileRequest(this._owner,{displayName,avatarDataUrl:this.data.avatarDataUrl});if(!this.checkOwner(generation)||!cacheProfile(this._owner,profile))return;this.setData({displayName:profile.displayName,avatarDataUrl:profile.avatarDataUrl,saved:true});wx.showToast({title:'头像昵称已保存',icon:'success'})}
  catch(error){if(this.checkOwner(generation))this.setData({error:error.message||'保存失败，填写内容仍保留，请重试。'})}
  finally{if(this.current(generation))this.setData({saving:false})}
 },
 goBack(){this.invalidatePending();leaveAccount()},
})
