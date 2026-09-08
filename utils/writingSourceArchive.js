const {draftKey}=require('./page')
const PAGE_SIZE=24,MAX_RECORD_BYTES=512*1024,SOURCE_REVISION=/^[a-f0-9]{64}$/
const currentOwner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const currentEpoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
function archiveError(message,code='writing_archive_failed'){const error=new Error(message);error.code=code;return error}
function validateContext(scope,owner,epoch){
 const safeScope=String(scope||''),safeOwner=String(owner||'')
 if(!/^[a-zA-Z0-9:_-]{1,240}$/.test(safeScope)||!/^[a-zA-Z0-9:_-]{1,160}$/.test(safeOwner)||!Number.isSafeInteger(Number(epoch))||Number(epoch)<0)throw archiveError('旧稿归档范围无效。')
 if(safeOwner!==currentOwner()||Number(epoch)!==currentEpoch())throw archiveError('账号已变化，旧稿没有被改动。','account_changed')
 return {scope:safeScope,owner:safeOwner,epoch:Number(epoch),base:`writing-source-archive:${safeOwner}:${Number(epoch)}:${safeScope}`}
}
function bytes(text){let total=0;for(let index=0;index<text.length;index++){const code=text.charCodeAt(index);if(code<0x80)total++;else if(code<0x800)total+=2;else if(code>=0xd800&&code<=0xdbff&&index+1<text.length&&text.charCodeAt(index+1)>=0xdc00&&text.charCodeAt(index+1)<=0xdfff){total+=4;index++}else total+=3}return total}
function valueAt(key){return wx.getStorageSync(key)}
const missingStorageValue=value=>value===undefined||value===null||value===''
function owned(value,context){return value&&typeof value==='object'&&value.owner===context.owner&&Number(value.epoch)===context.epoch&&value.scope===context.scope}
function metaFor(context){
 const key=draftKey(context.base+':meta'),value=valueAt(key)
 if(missingStorageValue(value))return {key,value:null,meta:{schemaVersion:'writing-source-archive-index-v1',owner:context.owner,epoch:context.epoch,scope:context.scope,pages:0,count:0}}
 if(!owned(value,context)||value.schemaVersion!=='writing-source-archive-index-v1'||!Number.isSafeInteger(value.pages)||value.pages<0||!Number.isSafeInteger(value.count)||value.count<0)throw archiveError('旧稿归档索引不完整，未切换题目。')
 return {key,value,meta:value}
}
function pageFor(context,page){
 const key=draftKey(context.base+':page:'+page),value=valueAt(key)
 if(missingStorageValue(value))return {key,value:null,page:{schemaVersion:'writing-source-archive-page-v1',owner:context.owner,epoch:context.epoch,scope:context.scope,page,entries:[]}}
 if(!owned(value,context)||value.schemaVersion!=='writing-source-archive-page-v1'||value.page!==page||!Array.isArray(value.entries)||value.entries.length>PAGE_SIZE)throw archiveError('旧稿归档分页不完整，未切换题目。')
 return {key,value,page:value}
}
function restore(key,value){try{if(value===null||value===undefined)wx.removeStorageSync(key);else wx.setStorageSync(key,value)}catch{/* The active draft remains unchanged even if cleanup cannot finish. */}}
function archiveWritingSource(scope,owner,epoch,value){
 const context=validateContext(scope,owner,epoch)
 let copy
 try{copy=JSON.parse(JSON.stringify(value))}catch{throw archiveError('旧稿内容暂时无法安全保存，未切换题目。')}
 if(!copy||typeof copy!=='object'||Array.isArray(copy))throw archiveError('旧稿内容暂时无法安全保存，未切换题目。')
 const revisions=[copy.sourceRevision,...(Array.isArray(copy.sourceRevisions)?copy.sourceRevisions:[])].filter(revision=>SOURCE_REVISION.test(String(revision||''))).map(String)
 const archivedAt=Date.now();let archiveId
 for(let attempt=0;attempt<4;attempt++){archiveId=(revisions[0]||'legacy')+'-'+archivedAt.toString(36)+'-'+Math.random().toString(36).slice(2,9);if(missingStorageValue(valueAt(draftKey(context.base+':item:'+archiveId))))break;archiveId=''}
 if(!archiveId)throw archiveError('旧稿归档编号冲突，未切换题目。')
 const record={...copy,schemaVersion:'writing-source-archive-v1',owner:context.owner,epoch:context.epoch,scope:context.scope,archiveId,archivedAt}
 const recordText=JSON.stringify(record)
 if(/data:image\//i.test(recordText)||bytes(recordText)>MAX_RECORD_BYTES)throw archiveError('旧稿内容过大，无法安全归档；题目尚未切换。','writing_archive_too_large')
 const metaState=metaFor(context),lastPage=metaState.meta.pages?metaState.meta.pages-1:0,lastState=pageFor(context,lastPage)
 const pageNumber=lastState.page.entries.length>=PAGE_SIZE?lastPage+1:lastPage,pageState=pageNumber===lastPage?lastState:pageFor(context,pageNumber)
 const entry={archiveId,sourceRevision:SOURCE_REVISION.test(String(copy.sourceRevision||''))?String(copy.sourceRevision):'',sourceRevisions:revisions,archivedAt}
 const nextPage={...pageState.page,entries:[...pageState.page.entries,entry]},nextMeta={...metaState.meta,pages:Math.max(metaState.meta.pages,pageNumber+1),count:metaState.meta.count+1}
 const itemKey=draftKey(context.base+':item:'+archiveId),required=bytes(recordText)+bytes(JSON.stringify(nextPage))+bytes(JSON.stringify(nextMeta))+8192
 let info={};try{info=wx.getStorageInfoSync?.()||{}}catch{/* A write/rollback transaction remains the final capacity check. */}
 if(Number.isFinite(info.currentSize)&&Number.isFinite(info.limitSize)&&(info.limitSize-info.currentSize)*1024<required)throw archiveError('本机存储空间不足，旧稿无法安全保存；题目尚未切换。','writing_archive_storage_full')
 try{wx.setStorageSync(itemKey,record);wx.setStorageSync(pageState.key,nextPage);wx.setStorageSync(metaState.key,nextMeta)}catch{
  restore(itemKey,null);restore(pageState.key,pageState.value);restore(metaState.key,metaState.value)
  throw archiveError('旧稿保存失败，题目尚未切换；请释放存储空间后重试。','writing_archive_storage_full')
 }
 return {archiveId,sourceRevision:entry.sourceRevision,sourceRevisions:entry.sourceRevisions,archivedAt}
}
function listWritingSourceArchives(scope,owner,epoch,{page=0}={}){
 const context=validateContext(scope,owner,epoch),metaState=metaFor(context),pageCount=metaState.meta.pages,index=Math.max(0,Number(page)||0)
 if(!pageCount||index>=pageCount)return {items:[],total:metaState.meta.count,page:index,pageCount}
 const physical=pageCount-1-index,pageState=pageFor(context,physical),items=[...pageState.page.entries].reverse().map(entry=>{
  const item=valueAt(draftKey(context.base+':item:'+entry.archiveId))
  if(!owned(item,context)||item.archiveId!==entry.archiveId)throw archiveError('旧稿归档内容不完整。')
  return item
 })
 return {items,total:metaState.meta.count,page:index,pageCount}
}
function hasWritingSourceArchives(scope,owner,epoch){return metaFor(validateContext(scope,owner,epoch)).meta.count>0}
module.exports={PAGE_SIZE,MAX_RECORD_BYTES,archiveWritingSource,listWritingSourceArchives,hasWritingSourceArchives}
