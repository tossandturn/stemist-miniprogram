const {compressImage}=require('./image')
const PREFIX='stemistNativePaper:'
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const key=(paperId,routeId,mode)=>PREFIX+owner()+':'+paperId+':'+routeId+':'+mode
function createPaperDraft(paper,route,mode='past-paper-practice'){
 const storageKey=key(paper.id,route.routeId,mode),existing=wx.getStorageSync(storageKey)
 if(existing&&existing.owner===owner()&&existing.epoch===epoch())return existing
 return {schema:1,id:'mini-paper-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),storageKey,owner:owner(),epoch:epoch(),paperId:paper.id,subject:paper.subject,routeId:route.routeId,stage:route.stage,mode,index:1,startedAt:Date.now(),answers:{},submitted:false,selfScore:'',updatedAt:Date.now()}
}
function current(draft){return Boolean(draft&&draft.schema===1&&draft.owner===owner()&&draft.epoch===epoch()&&/^mini-paper-[a-z0-9-]+$/.test(draft.id))}
function savePaperDraft(draft){if(!current(draft))throw new Error('账号已变化，草稿未写入新账号。');wx.setStorageSync(draft.storageKey,{...draft,updatedAt:Date.now()})}
function readPaperDraft(storageKey){const draft=wx.getStorageSync(storageKey);return current(draft)?draft:null}
function directory(){return wx.env.USER_DATA_PATH+'/native-paper'}
function removeOwnedPhoto(filePath){const prefix=directory()+'/';if(String(filePath).startsWith(prefix)&&/^mini-paper-[a-z0-9-]+\.jpg$/.test(String(filePath).slice(prefix.length)))wx.getFileSystemManager().unlink({filePath,fail(){}})}
async function attachPaperPhoto(context,sourcePath){
 const draft=readPaperDraft(context?.storageKey),number=Number(context?.questionNumber)
 if(!draft||draft.id!==context.sessionId||draft.submitted||!Number.isInteger(number)||number<1||number>99)throw new Error('这张照片不属于当前练习，请返回重新拍摄。')
 const old=draft.answers[number]||{},revision=(old.revision||0)+1
 const dest=directory()+'/'+draft.id+'-q'+number+'-r'+revision+'-'+Date.now().toString(36)+'.jpg'
 const path=await compressImage(sourcePath)
 if(!current(draft))throw new Error('账号已变化，请重新拍摄。')
 const fs=wx.getFileSystemManager();try{fs.mkdirSync(directory(),true)}catch{fs.accessSync(directory())}
 await new Promise((resolve,reject)=>fs.copyFile({srcPath:path,destPath:dest,success:resolve,fail:()=>reject(new Error('照片未保存，请检查本机空间。'))}))
 try{
  const latest=readPaperDraft(context.storageKey)
  if(!latest||latest.id!==draft.id||latest.submitted)throw new Error('练习已结束，照片未加入其他练习。')
  latest.answers[number]={photo:dest,revision,feedback:'',at:Date.now()};savePaperDraft(latest)
 }catch(error){removeOwnedPhoto(dest);throw error}
 if(old.photo)removeOwnedPhoto(old.photo)
 return {paperId:draft.paperId,subject:draft.subject,routeId:draft.routeId,mode:draft.mode}
}
module.exports={PREFIX,current,createPaperDraft,savePaperDraft,readPaperDraft,attachPaperPhoto}
