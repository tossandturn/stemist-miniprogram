const {compressImage}=require('./image')
const PHOTO_KEY='stemistCoachPhoto',META_KEY='stemistCoachPhotoMeta'
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest'),epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0,folder=()=>`${wx.env?.USER_DATA_PATH||''}/native-coach`
function sameIdentity(expected){return expected&&String(expected.owner)===owner()&&Number(expected.epoch)===epoch()}
function ownedPhoto(path){const prefix=`${folder()}/`;return String(path).startsWith(prefix)&&/^coach-[a-z0-9-]+\.jpg$/.test(String(path).slice(prefix.length))}
function removeCoachPhoto(path){if(path&&ownedPhoto(path)&&wx.getFileSystemManager)wx.getFileSystemManager().unlink({filePath:path,fail(){}})}
function readCoachPhoto(expected,contextId){const path=String(wx.getStorageSync(PHOTO_KEY)||''),meta=wx.getStorageSync(META_KEY)||{};if(!path||meta.path!==path||String(meta.owner)!==String(expected.owner)||Number(meta.epoch)!==Number(expected.epoch))return '';if(String(meta.contextId||'')!==String(contextId||'')){clearCoachPhoto(expected);return ''}return path}
function consumeCoachPhotoAutoSubmit(expected,contextId,feature){const meta=wx.getStorageSync(META_KEY)||{},nonce=String(meta.autoSubmitNonce||''),saved=Number(meta.savedAt),age=Date.now()-saved;if(!nonce||!Number.isFinite(saved)||age<0||age>120000||meta.autoSubmitConsumed===nonce||!sameIdentity(expected)||String(meta.owner)!==String(expected.owner)||Number(meta.epoch)!==Number(expected.epoch)||String(meta.contextId||'')!==String(contextId||'')||meta.feature!==feature)return '';try{wx.setStorageSync(META_KEY,{...meta,autoSubmitConsumed:nonce})}catch{return ''}return nonce}
function clearCoachPhoto(expected){const path=String(wx.getStorageSync(PHOTO_KEY)||''),meta=wx.getStorageSync(META_KEY)||{};if(expected&&(String(meta.owner)!==String(expected.owner)||Number(meta.epoch)!==Number(expected.epoch)))return false;wx.removeStorageSync(PHOTO_KEY);wx.removeStorageSync(META_KEY);removeCoachPhoto(path);return true}
async function persistCoachPhoto(path,expected,metadata={}, {cancelled=()=>false}={}){
 const current=()=>!cancelled()&&sameIdentity(expected);if(!current())throw Error('账号已变化，请返回 AI Coach 重新选择图片。')
 const source=await compressImage(path);if(!current())throw Error('账号已变化，请返回 AI Coach 重新选择图片。')
 const fs=wx.getFileSystemManager(),directory=folder(),destination=`${directory}/coach-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.jpg`
 try{fs.mkdirSync(directory,true)}catch{fs.accessSync(directory)}
 await new Promise((resolve,reject)=>fs.copyFile({srcPath:source,destPath:destination,success:resolve,fail:()=>reject(Error('图片尚未保存，请检查本机空间后重试。'))}))
 if(!current()){removeCoachPhoto(destination);throw Error('账号已变化，图片未写入其他账号。')}
 const previousPath=String(wx.getStorageSync(PHOTO_KEY)||''),previousMeta=wx.getStorageSync(META_KEY)||{},feature=['steps','answers'].includes(metadata.feature)?metadata.feature:'',meta={owner:String(expected.owner),epoch:Number(expected.epoch),path:destination,contextId:String(metadata.contextId||''),feature,autoSubmitNonce:feature==='answers'?String(metadata.autoSubmitNonce||''):'',savedAt:Date.now()}
 try{wx.setStorageSync(META_KEY,meta);wx.setStorageSync(PHOTO_KEY,destination)}catch{removeCoachPhoto(destination);try{previousPath?wx.setStorageSync(PHOTO_KEY,previousPath):wx.removeStorageSync(PHOTO_KEY);previousMeta?.path===previousPath?wx.setStorageSync(META_KEY,previousMeta):wx.removeStorageSync(META_KEY)}catch{}throw Error('图片尚未保存，请检查本机空间后重试。')}
 if(previousPath&&previousPath!==destination&&String(previousMeta.owner)===String(expected.owner)&&Number(previousMeta.epoch)===Number(expected.epoch))removeCoachPhoto(previousPath)
 return destination
}
module.exports={PHOTO_KEY,META_KEY,readCoachPhoto,consumeCoachPhotoAutoSubmit,clearCoachPhoto,persistCoachPhoto,removeCoachPhoto}
