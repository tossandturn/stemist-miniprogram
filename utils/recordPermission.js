function permissionError(code,message,action='',contractName='') { return Object.assign(new Error(message),{code,action,contractName}) }
function appMicrophone(){try{return wx.getAppAuthorizeSetting?.().microphoneAuthorized||''}catch{return ''}}
function invoke(name,options={}){return new Promise((resolve,reject)=>{if(typeof wx[name]!=='function')return reject(permissionError('permission_api_unavailable','请升级微信后重试。'));wx[name]({...options,success:resolve,fail:reject})})}
function recordingError(error={}){
 const raw=String(error.errMsg||error.message||error||'')
 if(/privacy|隐私/i.test(raw))return permissionError('record_privacy_required','请先同意隐私保护指引，再使用麦克风。','privacy')
 if(appMicrophone()==='denied')return permissionError('record_system_denied','系统尚未允许微信使用麦克风。','system')
 if(/auth|permission|authorize|权限|拒绝/i.test(raw))return permissionError('record_permission_denied','麦克风尚未开启，已有练习记录会保留。','mini')
 return permissionError('record_start_failed','录音未能启动，请关闭其他录音应用后重试。','retry')
}
async function ensureRecordPermission({cancelled=()=>false}={}){
 const check=()=>{if(cancelled())throw permissionError('record_cancelled','已取消启动。')}
 check()
 if(typeof wx.getPrivacySetting==='function'){
  let privacy
  try{privacy=await invoke('getPrivacySetting')}catch{throw permissionError('record_privacy_unavailable','隐私授权暂不可用，请更新小程序后重试。','retry')}
  check()
  if(privacy.needAuthorization)throw permissionError('record_privacy_required','请先同意隐私保护指引，再使用麦克风。','privacy',String(privacy.privacyContractName||'用户隐私保护指引'))
 }
 if(appMicrophone()==='denied')throw permissionError('record_system_denied','系统尚未允许微信使用麦克风。','system')
 let setting
 if(typeof wx.getSetting==='function'){try{setting=await invoke('getSetting')}catch{/* Authorize remains the source of truth when settings cannot be queried. */}}
 check()
 if(setting?.authSetting?.['scope.record']===false)throw permissionError('record_permission_denied','麦克风尚未开启，已有练习记录会保留。','mini')
 if(setting?.authSetting?.['scope.record']!==true){
  try{await invoke('authorize',{scope:'scope.record'})}catch(error){check();throw recordingError(error)}
 }
 check()
 if(appMicrophone()==='denied')throw permissionError('record_system_denied','系统尚未允许微信使用麦克风。','system')
 return true
}
// Called only by the visible settings button. Opening settings never starts
// recording automatically when the learner comes back.
async function openRecordSettings(action){
 if(action==='system')await invoke('openAppAuthorizeSetting')
 else await invoke('openSetting')
 if(appMicrophone()==='denied')return {granted:false,action:'system'}
 let setting
 try{setting=await invoke('getSetting')}catch{return {granted:false,action:'mini'}}
 return {granted:setting.authSetting?.['scope.record']===true,action:'mini'}
}
module.exports={ensureRecordPermission,openRecordSettings,recordingError,permissionError}
