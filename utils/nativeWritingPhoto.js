const {compressImage}=require('./image')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const folder=()=>wx.env.USER_DATA_PATH+'/native-writing'
function removeWritingPhoto(path){const prefix=folder()+'/';if(String(path).startsWith(prefix)&&/^writing-[a-z0-9-]+\.jpg$/.test(String(path).slice(prefix.length)))wx.getFileSystemManager().unlink({filePath:path,fail(){}})}
async function persistWritingPhoto(path,expected){
 const current=()=>expected.owner===owner()&&expected.epoch===epoch()
 if(!current())throw new Error('账号已变化，请返回作文重新拍摄。')
 const source=await compressImage(path)
 if(!current())throw new Error('账号已变化，请返回作文重新拍摄。')
 const fs=wx.getFileSystemManager(),directory=folder(),dest=directory+'/writing-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'.jpg'
 try{fs.mkdirSync(directory,true)}catch{fs.accessSync(directory)}
 await new Promise((resolve,reject)=>fs.copyFile({srcPath:source,destPath:dest,success:resolve,fail:()=>reject(new Error('照片尚未保存，请检查本机空间。'))}))
 if(!current()){removeWritingPhoto(dest);throw new Error('账号已变化，照片未写入其他账号。')}
 return dest
}
module.exports={persistWritingPhoto,removeWritingPhoto}
