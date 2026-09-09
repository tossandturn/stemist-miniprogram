const {permissionError}=require('./recordPermission')
function cameraAuthorization(){try{return wx.getAppAuthorizeSetting?.().cameraAuthorized||''}catch{return ''}}
function invoke(name,options={}){return new Promise((resolve,reject)=>{if(typeof wx[name]!=='function')return reject(permissionError('camera_api_unavailable','当前微信版本不支持此操作，请更新微信。','retry'));wx[name]({...options,success:resolve,fail:reject})})}
function cameraError(error={}){
 const raw=String(error.errMsg||error.message||'')
 if(/not declared.*privacy|privacy.*not (?:declared|configured)|隐私.*(?:未声明|未配置)/i.test(raw))return permissionError('camera_privacy_not_declared','此版本尚未完成相机隐私声明，需要开发者完善配置；重复同意无法解决。','configuration')
 if(/cancel|取消/i.test(raw))return permissionError('camera_cancelled','已取消拍照。','cancel')
 if(/privacy|隐私/i.test(raw))return permissionError('camera_privacy_required','请先同意隐私保护指引，再使用相机。','privacy')
 if(cameraAuthorization()==='denied')return permissionError('camera_system_denied','系统尚未允许微信使用相机。','system')
 if(/auth|permission|authorize|权限|拒绝/i.test(raw))return permissionError('camera_permission_denied','相机权限尚未开启，请允许后重试。','mini')
 return permissionError('camera_start_failed','相机未能启动，请重试或使用系统相机。','retry')
}
async function ensureCameraPermission({cancelled=()=>false}={}){
 const check=()=>{if(cancelled())throw permissionError('camera_cancelled','已取消启动。','cancel')};check()
 if(typeof wx.getPrivacySetting==='function'){
  let privacy;try{privacy=await invoke('getPrivacySetting')}catch{throw permissionError('camera_privacy_unavailable','隐私授权暂不可用，请更新小程序后重试。','retry')}
  check();if(privacy.needAuthorization)throw permissionError('camera_privacy_required','请先同意隐私保护指引，再使用相机。','privacy',privacy.privacyContractName||'用户隐私保护指引')
 }
 if(cameraAuthorization()==='denied')throw cameraError({errMsg:'system denied'})
 let setting;try{setting=await invoke('getSetting')}catch{/* authorize is still authoritative on older versions */}
 check()
 if(setting?.authSetting?.['scope.camera']===false)throw cameraError({errMsg:'auth deny'})
 if(setting?.authSetting?.['scope.camera']!==true){try{await invoke('authorize',{scope:'scope.camera'})}catch(error){check();throw cameraError(error)}}
 check();if(cameraAuthorization()==='denied')throw cameraError({errMsg:'system denied'})
 return true
}
async function openCameraSettings(action){
 await invoke(action==='system'?'openAppAuthorizeSetting':'openSetting')
 if(cameraAuthorization()==='denied')return {granted:false,action:'system'}
 const setting=await invoke('getSetting')
 return {granted:setting.authSetting?.['scope.camera']===true,action:'mini'}
}
module.exports={ensureCameraPermission,openCameraSettings,cameraError}
