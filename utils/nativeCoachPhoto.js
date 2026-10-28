const {compressImage}=require('./image')
const PHOTO_KEY='stemistCoachPhoto',META_KEY='stemistCoachPhotoMeta'
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest'),epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0,folder=()=>`${wx.env?.USER_DATA_PATH||''}/native-coach`
function sameIdentity(expected){return expected&&String(expected.owner)===owner()&&Number(expected.epoch)===epoch()}
function ownedPhoto(path){const prefix=`${folder()}/`;return String(path).startsWith(prefix)&&/^coach-[a-z0-9-]+\.jpg$/.test(String(path).slice(prefix.length))}
function removeCoachPhoto(path){if(path&&ownedPhoto(path)&&wx.getFileSystemManager)wx.getFileSystemManager().unlink({filePath:path,fail(){}})}
function pathsOf(meta){return [meta.path,...(Array.isArray(meta.paths)?meta.paths:[])].filter((p,i,a)=>p&&a.indexOf(p)===i&&ownedPhoto(p)).slice(0,2)}
function readCoachPhoto(expected,contextId,entryKey=''){
 const path=String(wx.getStorageSync(PHOTO_KEY)||''),meta=wx.getStorageSync(META_KEY)||{}
 if(!path||meta.path!==path||String(meta.owner)!==String(expected.owner)||Number(meta.epoch)!==Number(expected.epoch)||meta.entryKey&&meta.entryKey!==entryKey)return ''
 if(String(meta.contextId||'')!==String(contextId||'')){clearCoachPhoto(expected);return ''}return path
}
function readCoachPhotoPaths(expected,contextId,entryKey=''){return readCoachPhoto(expected,contextId,entryKey)?pathsOf(wx.getStorageSync(META_KEY)||{}):[]}
function consumeCoachPhotoAutoSubmit(expected,contextId,feature,entryKey=''){
 const meta=wx.getStorageSync(META_KEY)||{},nonce=String(meta.autoSubmitNonce||''),saved=Number(meta.savedAt),age=Date.now()-saved
 if(!nonce||!Number.isFinite(saved)||age<0||age>120000||meta.autoSubmitConsumed===nonce||!sameIdentity(expected)||String(meta.owner)!==String(expected.owner)||Number(meta.epoch)!==Number(expected.epoch)||String(meta.contextId||'')!==String(contextId||'')||meta.feature!==feature||meta.entryKey&&meta.entryKey!==entryKey)return ''
 try{wx.setStorageSync(META_KEY,{...meta,autoSubmitConsumed:nonce})}catch{return ''}return nonce
}
function clearCoachPhoto(expected){
 const path=String(wx.getStorageSync(PHOTO_KEY)||''),meta=wx.getStorageSync(META_KEY)||{}
 if(expected&&(String(meta.owner)!==String(expected.owner)||Number(meta.epoch)!==Number(expected.epoch)))return false
 wx.removeStorageSync(PHOTO_KEY);wx.removeStorageSync(META_KEY);pathsOf({...meta,path}).forEach(removeCoachPhoto);return true
}
function clearCoachPhotoEntry(expected,entryKey){if(entryKey&&wx.getStorageSync(META_KEY)?.entryKey===entryKey)return clearCoachPhoto(expected);return false}
async function persistCoachPhotos(paths,expected,metadata={}, {cancelled=()=>false}={}){
 if(!Array.isArray(paths)||!paths.length||paths.length>2||paths.some(p=>!p))throw Error('请选择一至两张图片。')
 const current=()=>!cancelled()&&sameIdentity(expected),guard=()=>{if(!current())throw Error('账号或题目已变化，请返回后重试。')}
 guard()
 const fs=wx.getFileSystemManager(),directory=folder(),saved=[]
 const previousPath=String(wx.getStorageSync(PHOTO_KEY)||''),previousMeta=wx.getStorageSync(META_KEY)||{}
 try{
  try{fs.mkdirSync(directory,true)}catch{fs.accessSync(directory)}
  for(const path of paths){
   const source=await compressImage(path);guard()
   const destination=`${directory}/coach-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.jpg`
   saved.push(destination)
   await new Promise((resolve,reject)=>fs.copyFile({srcPath:source,destPath:destination,success:resolve,fail:()=>reject(Error('图片尚未保存，请检查本机空间后重试。'))}))
   guard()
  }
  const feature=['steps','answers'].includes(metadata.feature)?metadata.feature:'',meta={owner:String(expected.owner),epoch:Number(expected.epoch),path:saved[0],paths:saved,contextId:String(metadata.contextId||''),entryKey:String(metadata.entryKey||''),feature,autoSubmitNonce:feature==='answers'?String(metadata.autoSubmitNonce||''):'',savedAt:Date.now()}
  try{wx.setStorageSync(META_KEY,meta);wx.setStorageSync(PHOTO_KEY,saved[0])}catch{
   try{previousPath?wx.setStorageSync(PHOTO_KEY,previousPath):wx.removeStorageSync(PHOTO_KEY);previousMeta?.path===previousPath?wx.setStorageSync(META_KEY,previousMeta):wx.removeStorageSync(META_KEY)}catch{}
   throw Error('图片尚未保存，请检查本机空间后重试。')
  }
 }catch(error){saved.forEach(removeCoachPhoto);throw error}
 if(String(previousMeta.owner)===String(expected.owner)&&Number(previousMeta.epoch)===Number(expected.epoch))pathsOf({...previousMeta,path:previousPath}).forEach(removeCoachPhoto)
 return saved
}
async function persistCoachPhoto(path,expected,metadata,options){return (await persistCoachPhotos([path],expected,metadata,options))[0]}
module.exports={PHOTO_KEY,META_KEY,readCoachPhoto,readCoachPhotoPaths,consumeCoachPhotoAutoSubmit,clearCoachPhoto,clearCoachPhotoEntry,persistCoachPhoto,persistCoachPhotos,removeCoachPhoto}
