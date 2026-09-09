const { deviceState, syncDevice } = require('../../utils/page')
const {ensureCameraPermission,openCameraSettings}=require('../../utils/cameraPermission')
const {ensureRecordPermission,openRecordSettings}=require('../../utils/recordPermission')
function invoke(name){return new Promise((resolve,reject)=>{if(typeof wx[name]!=='function')return reject(new Error('当前微信版本不支持授权查询，请更新微信。'));const timer=setTimeout(()=>reject(new Error('授权状态读取超时，请重试。')),6000);const fail=()=>{clearTimeout(timer);reject(new Error('授权状态未能读取，请重试。'))};try{wx[name]({success:value=>{clearTimeout(timer);resolve(value)},fail})}catch{fail()}})}

Page({
  data: deviceState({privacyKnown:false,privacyNeeded:true,contractName:'用户隐私保护指引',cameraLabel:'未读取',microphoneLabel:'未读取',cameraAction:'',microphoneAction:'',busy:false,loading:true,error:''}),
  onLoad(){this.__disposed=false;this.__run=0;return this.refreshPermissions()},
  onShow() { syncDevice(this);this.setData({busy:false});if(this.__run!==undefined)return this.refreshPermissions() },
  onUnload(){this.__disposed=true;this.__run++},
  onResize() { syncDevice(this) },
  async refreshPermissions(){
    const run=++this.__run;this.setData({loading:true,error:''})
    try{
      const [privacy,setting]=await Promise.all([invoke('getPrivacySetting'),invoke('getSetting')])
      if(this.__disposed||run!==this.__run)return
      let system={};try{system=wx.getAppAuthorizeSetting?.()||{}}catch{}
      const cameraDenied=system.cameraAuthorized==='denied',micDenied=system.microphoneAuthorized==='denied'
      const camera=setting.authSetting?.['scope.camera'],mic=setting.authSetting?.['scope.record']
      this.setData({privacyKnown:true,privacyNeeded:privacy.needAuthorization!==false,contractName:privacy.privacyContractName||'用户隐私保护指引',cameraLabel:cameraDenied?'系统未允许':camera===true?'已开启':'未开启',microphoneLabel:micDenied?'系统未允许':mic===true?'已开启':'未开启',cameraAction:cameraDenied?'system':camera===false?'mini':'',microphoneAction:micDenied?'system':mic===false?'mini':''})
    }catch(error){if(!this.__disposed&&run===this.__run)this.setData({privacyKnown:false,error:error.message})}
    finally{if(!this.__disposed&&run===this.__run)this.setData({loading:false})}
  },
  async enable(kind){
    if(this.__disposed||this.data.busy)return
    if(!this.data.privacyKnown||this.data.privacyNeeded)return this.setData({error:'请先阅读并同意上方隐私保护指引。'})
    const camera=kind==='camera',action=camera?this.data.cameraAction:this.data.microphoneAction
    this.setData({busy:true,error:''})
    try{
      if(action==='system'||action==='mini')await(camera?openCameraSettings(action):openRecordSettings(action))
      else await(camera?ensureCameraPermission({cancelled:()=>this.__disposed}):ensureRecordPermission({cancelled:()=>this.__disposed}))
      if(!this.__disposed)await this.refreshPermissions()
    }catch(error){if(!this.__disposed)this.setData({error:error.message,[camera?'cameraAction':'microphoneAction']:error.action||'',...(error.action==='privacy'?{privacyNeeded:true}:{} )})}
    finally{if(!this.__disposed)this.setData({busy:false})}
  },
  enableCamera(){return this.enable('camera')},
  enableMicrophone(){return this.enable('microphone')},
  agreed(){return this.refreshPermissions()},
  openContract(){wx.openPrivacyContract?.({fail:()=>{if(!this.__disposed)this.setData({error:'隐私指引暂时无法打开，请稍后重试。'})}})},
  goBack() { wx.navigateBack() },
})
