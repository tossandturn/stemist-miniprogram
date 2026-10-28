const {requestJson}=require('../../utils/api')
const {imageMime}=require('../../utils/image')
const MAX_AVATAR_BYTES=64*1024
const context=()=>({ownerId:String(wx.getStorageSync('stemistUser')?.id||''),epoch:Number(wx.getStorageSync('stemistPrivacyEpoch'))||0})
function isCurrent(started){const now=context();return !!wx.getStorageSync('stemistSessionToken')&&!!started.ownerId&&now.ownerId===started.ownerId&&now.epoch===started.epoch}
function normalizeName(value){
 const name=String(value||'').normalize('NFC').trim()
 if(!name.replace(/[\u200b-\u200f\u2060\ufeff]/g,'').trim()||Array.from(name).length>32||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(name))throw new Error('请填写 1–32 个字符的昵称。')
 return name
}
async function profileRequest(started,data){
 if(!isCurrent(started))throw new Error('账号已变化，请返回后重新登录。')
 const result=await requestJson('/api/stem/profile',data,{method:data?'PUT':'GET',timeout:15000})
 if(!isCurrent(started))throw new Error('账号已变化，请返回后重新登录。')
 const profile=result?.profile
 if(result?.protocol!=='stem-user-profile-v1'||profile?.ownerId!==started.ownerId||typeof profile.displayName!=='string'||typeof profile.avatarDataUrl!=='string')throw new Error('资料尚未同步，请稍后重试。')
 return profile
}
function cacheProfile(started,profile){
 if(!isCurrent(started)||profile.ownerId!==started.ownerId)return false
 wx.setStorageSync('stemistUser',{...wx.getStorageSync('stemistUser'),displayName:profile.displayName,avatarDataUrl:profile.avatarDataUrl})
 return true
}
const readBase64=filePath=>new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath,encoding:'base64',success:r=>resolve(String(r.data||'')),fail:()=>reject(new Error('头像读取失败，请重新选择。'))}))
async function readAvatar(filePath){
 if(typeof filePath!=='string'||!filePath)throw new Error('请选择要使用的头像。')
 const size=await new Promise((resolve,reject)=>wx.getFileSystemManager().stat({path:filePath,success:r=>resolve(r.stats?.size),fail:()=>reject(new Error('头像读取失败，请重新选择。'))}))
 if(!Number.isFinite(size)||size<=0||size>2*1024*1024)throw new Error('头像文件过大或无效，请选择小于 2 MB 的图片。')
 let source=filePath
 for(const quality of [0,70,45]){
  if(quality){
   if(typeof wx.compressImage!=='function')break
   source=await new Promise((resolve,reject)=>wx.compressImage({src:filePath,quality,compressedWidth:256,compressedHeight:256,success:r=>resolve(r.tempFilePath),fail:()=>reject(new Error('头像处理失败，请换一张图片。'))}))
  }
  const base64=await readBase64(source)
  const bytes=Math.floor(base64.length*3/4)-(/==$/.test(base64)?2:/=$/.test(base64)?1:0)
  if(bytes>0&&bytes<=MAX_AVATAR_BYTES)return 'data:'+imageMime(base64)+';base64,'+base64
 }
 throw new Error('头像仍然过大，请换一张较小的图片。')
}
module.exports={context,isCurrent,normalizeName,profileRequest,cacheProfile,readAvatar,MAX_AVATAR_BYTES}
