// Keep input persistence in the on-demand marking subpackage.
const REGISTRY_KEY='stemistWholePaperFiles'
const MAX_FILES=80
const MAX_BYTES=128*1024*1024

const dataRoot=()=>String(wx.env?.USER_DATA_PATH||'')
const directory=()=>dataRoot()+'/whole-paper-inputs'
const validPath=value=>{
 const root=dataRoot();if(!root)return false
 const prefix=directory()+'/'
 return typeof value==='string'&&value.startsWith(prefix)&&/^paper-[a-z0-9-]+\.(?:pdf|jpg|png|webp)$/.test(value.slice(prefix.length))
}
const validRecord=value=>value&&validPath(value.path)&&typeof value.owner==='string'&&value.owner.length>0&&value.owner.length<=200&&Number.isSafeInteger(value.epoch)&&value.epoch>=0&&Number.isSafeInteger(value.size)&&value.size>0&&value.size<=10*1024*1024&&Number.isFinite(value.savedAt)
const records=()=>{
 const value=wx.getStorageSync(REGISTRY_KEY)
 return Array.isArray(value)?value.filter(validRecord):[]
}
const write=value=>{if(value.length)wx.setStorageSync(REGISTRY_KEY,value);else wx.removeStorageSync(REGISTRY_KEY)}
const same=(record,scope)=>record.owner===String(scope?.owner||'')&&record.epoch===Number(scope?.epoch)
const currentScope=scope=>String(wx.getStorageSync('stemistUser')?.id||'guest')===String(scope?.owner||'')&&(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)===Number(scope?.epoch)
const extension=mediaType=>({'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[mediaType]||''
const unlink=filePath=>new Promise(resolve=>{
 try{wx.getFileSystemManager().unlink({filePath,success:()=>resolve(true),fail:()=>resolve(false)})}catch{resolve(false)}
})

async function persistWholePaperFile(sourcePath,mediaType,size,scope){
 const ext=extension(mediaType),owner=String(scope?.owner||''),epoch=Number(scope?.epoch)
 if(!sourcePath||!ext||!owner||!Number.isSafeInteger(epoch)||epoch<0||!Number.isSafeInteger(size)||size<=0||size>10*1024*1024)throw Error('文件信息无效，请重新选择。')
 if(!currentScope(scope))throw Error('账号已变化，请重新选择文件。')
 const initial=records(),initialBytes=initial.reduce((sum,item)=>sum+item.size,0)
 if(initial.length>=MAX_FILES||initialBytes+size>MAX_BYTES)throw Error('本机暂存的未提交整卷文件过多，请先完成或取消其他账号的草稿。')
 const fs=wx.getFileSystemManager(),root=dataRoot(),folder=directory()
 if(!root||folder!==root+'/whole-paper-inputs')throw Error('本机文件目录不可用。')
 try{fs.mkdirSync(folder,true)}catch{fs.accessSync(folder)}
 const destination=folder+'/paper-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12)+'.'+ext
 await new Promise((resolve,reject)=>fs.copyFile({srcPath:sourcePath,destPath:destination,success:resolve,fail:()=>reject(Error('文件未能安全暂存，请检查本机空间后重试。'))}))
 if(!currentScope(scope)){await unlink(destination);throw Error('账号已变化，请重新选择文件。')}
 const latest=records(),latestBytes=latest.reduce((sum,item)=>sum+item.size,0)
 if(latest.length>=MAX_FILES||latestBytes+size>MAX_BYTES){await unlink(destination);throw Error('本机暂存的未提交整卷文件过多，请先完成或取消其他账号的草稿。')}
 try{write([...latest,{path:destination,owner,epoch,size,savedAt:Date.now()}])}
 catch(error){await unlink(destination);throw Error('文件未能安全暂存，请检查本机空间后重试。')}
 return destination
}

function isManagedWholePaperFile(filePath,scope){
 return records().some(record=>record.path===filePath&&same(record,scope))
}

async function releaseWholePaperFiles(files,referencedFiles,scope){
 const remove=new Set((Array.isArray(files)?files:[]).map(file=>typeof file==='string'?file:file?.path).filter(Boolean))
 const keep=new Set((Array.isArray(referencedFiles)?referencedFiles:[]).map(file=>typeof file==='string'?file:file?.path).filter(Boolean))
 const targets=records().filter(record=>same(record,scope)&&remove.has(record.path)&&!keep.has(record.path))
 const deleted=new Set()
 for(const record of targets)if(await unlink(record.path))deleted.add(record.path)
 if(deleted.size){const latest=records();write(latest.filter(record=>!(deleted.has(record.path)&&same(record,scope))))}
 return deleted.size
}

function clearWholePaperFiles(){
 const current=records()
 wx.removeStorageSync(REGISTRY_KEY)
 for(const record of current){try{wx.getFileSystemManager().unlink({filePath:record.path,fail(){}})}catch{/* Best-effort explicit logout cleanup. */}}
}

module.exports={REGISTRY_KEY,MAX_FILES,MAX_BYTES,persistWholePaperFile,isManagedWholePaperFile,releaseWholePaperFiles,clearWholePaperFiles}
