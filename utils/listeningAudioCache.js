// Public source audio only. Temporary downloads are reused within this app
// session; active players pin their files so LRU eviction cannot interrupt them.
const entries=new Map()
const MAX_FILE=32*1024*1024,MAX_BYTES=64*1024*1024,MAX_FILES=4
const ALLOWED=/^https:\/\/ieltsist\.com\/(?:generated\/|cambridge15\/audio\/|cambridge-local\/file\/)[a-zA-Z0-9_./% -]+$/
function remove(entry){
 if(entries.get(entry.key)===entry)entries.delete(entry.key)
 if(entry.path)try{wx.getFileSystemManager().unlink({filePath:entry.path,fail(){}})}catch{}
}
function prune(){
 let bytes=[...entries.values()].reduce((sum,e)=>sum+(e.size||0),0)
 const ready=[...entries.values()].filter(e=>e.path)
 let count=ready.length
 for(const entry of ready.sort((a,b)=>a.used-b.used)){
  if(count<=MAX_FILES&&bytes<=MAX_BYTES)break
  if(entry.refs)continue
  bytes-=entry.size;count--;remove(entry)
 }
}
function acquireListeningAudio(url,{version='',onProgress=()=>{}}={}){
 if(!ALLOWED.test(url)||/\.\.|%2e|%2f|%5c/i.test(url))throw Error('音频地址无效，请重新选题。')
 if(typeof wx.downloadFile!=='function'||typeof wx.getFileSystemManager!=='function')return {promise:Promise.resolve(url),release(){},invalidate(){}}
 const key=url+'|'+String(version),fs=wx.getFileSystemManager()
 let entry=entries.get(key)
 if(entry?.path){try{fs.accessSync(entry.path)}catch{entries.delete(key);entry=null}}
 if(!entry){
  entry={key,refs:0,listeners:new Set(),used:Date.now(),size:0,path:'',progress:{bytes:0,total:0,percent:null},done:false}
  entries.set(key,entry)
  entry.promise=new Promise((resolve,reject)=>{entry.resolve=resolve;entry.reject=reject})
 }
 entry.refs++;entry.used=Date.now();entry.listeners.add(onProgress)
 if(!entry.path)onProgress(entry.progress)
 const fail=message=>{
  if(entry.done)return
  entry.done=true;remove(entry);entry.reject(Error(message))
 }
 if(!entry.started){
  entry.started=true
  try{entry.task=wx.downloadFile({url,timeout:60000,success:result=>{
   if(entry.done){if(result.tempFilePath)try{fs.unlink({filePath:result.tempFilePath,fail(){}})}catch{};return}
   entry.path=result.tempFilePath||''
   if(result.statusCode!==200||!entry.path)return fail('音频下载未完成，请重试。')
   try{entry.size=Number(fs.statSync(entry.path).size)||0}catch{return fail('音频文件未能读取，请重试。')}
   if(entry.size<=0||entry.size>MAX_FILE)return fail('音频文件不完整或过大，请重新选题。')
   entry.done=true;entry.used=Date.now();entry.resolve(entry.path);prune()
  },fail:()=>fail('音频准备失败，请检查网络后重试。')})
  entry.task?.onProgressUpdate(event=>{
   if(entry.done)return
   const bytes=Math.max(0,Number(event.totalBytesWritten)||0),total=Math.max(0,Number(event.totalBytesExpectedToWrite)||0)
   if(bytes>MAX_FILE||total>MAX_FILE){fail('音频文件过大，请重新选题。');entry.task.abort();return}
   entry.progress={bytes,total,percent:total?Math.min(99,Math.floor(bytes*100/total)):null}
   if(!entry.lastProgress||Date.now()-entry.lastProgress>=250){entry.lastProgress=Date.now();for(const listener of entry.listeners)listener(entry.progress)}
  })}catch{fail('音频准备失败，请重试。')}
 }
 let released=false
 return {promise:entry.promise,invalidate(){entry.stale=true;if(entries.get(key)===entry)entries.delete(key)},release(){
  if(released)return;released=true;entry.listeners.delete(onProgress);entry.refs--
  if(!entry.refs&&!entry.done){fail('音频准备已取消。');entry.task?.abort()}
  if(!entry.refs&&entry.stale)remove(entry)
  prune()
 }}
}
module.exports={acquireListeningAudio}
