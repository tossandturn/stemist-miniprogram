const {deviceState,syncDevice}=require('../../utils/page')
const {context,isCurrent,normalizeName,profileRequest,cacheProfile,readAvatar}=require('./profileData')
Page({
 onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
 data:deviceState({displayName:'',avatarDataUrl:'',loading:false,loaded:false,processing:false,saving:false,error:'',saved:false,onboarding:false}),
 onLoad(options={}){this._owner=context();this._disposed=false;this._avatarVersion=0;this.setData({onboarding:String(options.onboarding||'')==='1'});return this.loadProfile()},
 onShow(){syncDevice(this);this.checkOwner()},
 onResize(){syncDevice(this)},
 onUnload(){this._disposed=true;this._avatarVersion++},
 current(){return !this._disposed&&isCurrent(this._owner)},
 checkOwner(){
  if(this.current())return true
  if(!this._disposed)this.setData({displayName:'',avatarDataUrl:'',loaded:false,processing:false,saving:false,saved:false,error:'账号已变化，请返回后重新登录。'})
  return false
 },
 async loadProfile(){
  if(this.data.loading||this.data.saving)return
  this.setData({loading:true,error:'',loaded:false})
  try{
   const profile=await profileRequest(this._owner)
   if(!this.checkOwner())return
   cacheProfile(this._owner,profile)
   this.setData({displayName:profile.displayName,avatarDataUrl:profile.avatarDataUrl,loaded:true})
  }catch(error){if(!this._disposed&&this.checkOwner())this.setData({error:error.message||'资料读取失败，请重试。'})}
  finally{if(!this._disposed)this.setData({loading:false})}
 },
 async chooseAvatar(event){
  if(!this.current()||!this.data.loaded||this.data.saving||this.data.processing)return
  const path=event.detail?.avatarUrl
  if(!path)return
  const version=++this._avatarVersion
  this.setData({processing:true,error:'',saved:false})
  try{const avatarDataUrl=await readAvatar(path);if(this.checkOwner()&&version===this._avatarVersion)this.setData({avatarDataUrl})}
  catch(error){if(this.checkOwner()&&version===this._avatarVersion)this.setData({error:error.message||'头像处理失败，请重新选择。'})}
  finally{if(this.current()&&version===this._avatarVersion)this.setData({processing:false})}
 },
 async submit(event){
  if(!this.current()||!this.data.loaded||this.data.loading||this.data.processing||this.data.saving)return
  let displayName
  try{displayName=normalizeName(event.detail?.value?.nickname)}catch(error){this.setData({error:error.message});return}
  this.setData({displayName,saving:true,error:'',saved:false})
  try{
   const profile=await profileRequest(this._owner,{displayName,avatarDataUrl:this.data.avatarDataUrl})
   if(!this.checkOwner()||!cacheProfile(this._owner,profile))return
   this.setData({displayName:profile.displayName,avatarDataUrl:profile.avatarDataUrl,saved:true})
   wx.showToast({title:'头像昵称已保存',icon:'success'})
  }catch(error){if(this.checkOwner())this.setData({error:error.message||'保存失败，填写内容仍保留，请重试。'})}
  finally{if(!this._disposed)this.setData({saving:false})}
 },
 goBack(){if(!this.data.saving)wx.navigateBack({fail:()=>wx.redirectTo({url:'/bundles/account/auth'})})},
})
