const REGISTRY_KEY='stemistListeningAudioRanges',SCHEMA=1,CHUNK=128*1024,MAX_FILE=32*1024*1024,MAX_BYTES=64*1024*1024,MAX_FILES=4,REQUEST_MS=45e3,HARD_MS=300e3,RETRY='音频中断，进度已保留。',CANCEL='音频已取消。',CHECK='音频断点无效，请重试。'
const URL_OK=/^https:\/\/ieltsist\.com\/(?:generated\/|cambridge15\/audio\/|cambridge-local\/file\/)[a-zA-Z0-9_./% -]+$/
const entries=new Map(),writes=new Map()
const bytes=value=>value instanceof ArrayBuffer||Object.prototype.toString.call(value)==='[object ArrayBuffer]'?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null
const arrayBuffer=value=>{const data=bytes(value);return data&&data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)}
const header=(headers,name)=>{const wanted=name.toLowerCase(),key=Object.keys(headers||{}).find(item=>item.toLowerCase()===wanted);return key===undefined?'':String(headers[key]).trim()}
const strong=value=>/^"[\x21\x23-\x7e]{1,198}"$/.test(String(value||''))?String(value):''
const contentRange=value=>{const match=String(value||'').match(/^bytes (\d+)-(\d+)\/(\d+)$/);if(!match)return null;const values=match.slice(1).map(Number);return values.every(Number.isSafeInteger)?{start:values[0],end:values[1],total:values[2]}:null}
const err=(code,message)=>Object.assign(Error(message),{code}),interrupted=()=>err('audio_interrupted',RETRY),cancelled=()=>err('audio_cancelled',CANCEL),checkpoint=()=>err('audio_checkpoint_invalid',CHECK)
const root=()=>String(wx.env?.USER_DATA_PATH||'')
const folder=()=>root()+'/listening-audio'
const owned=path=>Boolean(root())&&typeof path==='string'&&path.startsWith(folder()+'/')&&/^audio-[a-z0-9-]+\.mp3$/.test(path.slice(folder().length+1))
const supported=()=>{if(typeof wx.request!=='function'||typeof wx.getFileSystemManager!=='function'||!root())return false;const fs=wx.getFileSystemManager();return['writeFile','appendFile','readFile','statSync','accessSync','mkdirSync','unlink'].every(name=>typeof fs[name]==='function')}
const valid=record=>record&&record.schema===SCHEMA&&URL_OK.test(record.url)&&typeof record.version==='string'&&record.version.length<=200&&record.key===record.url+'|'+record.version&&strong(record.etag)&&Number.isSafeInteger(record.total)&&record.total>0&&record.total<=MAX_FILE&&Number.isSafeInteger(record.offset)&&record.offset>0&&record.offset<=record.total&&record.ready===(record.offset===record.total)&&owned(record.path)&&Number.isFinite(record.used)
const records=()=>{const stored=wx.getStorageSync(REGISTRY_KEY);return Array.isArray(stored)?stored.filter(valid):[]}
const save=value=>{if(value.length)wx.setStorageSync(REGISTRY_KEY,value);else wx.removeStorageSync(REGISTRY_KEY)}
const fs=()=>wx.getFileSystemManager()
const unlink=path=>new Promise(resolve=>{if(!owned(path))return resolve(false);try{fs().unlink({filePath:path,success:()=>resolve(true),fail:()=>resolve(false)})}catch{resolve(false)}})
const write=(path,data,append=false)=>{const previous=writes.get(path)||Promise.resolve(),operation=previous.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{try{fs()[append?'appendFile':'writeFile']({filePath:path,data:arrayBuffer(data),success:resolve,fail:()=>reject(err('audio_storage','音频写入失败。'))})}catch{reject(err('audio_storage','音频写入失败。'))}}));writes.set(path,operation);return operation.finally(()=>{if(writes.get(path)===operation)writes.delete(path)})}
const drain=path=>(writes.get(path)||Promise.resolve()).catch(()=>{})
const read=(path,position,length)=>new Promise((resolve,reject)=>{try{fs().readFile({filePath:path,position,length,success:value=>resolve(bytes(value.data)),fail:()=>reject(err('audio_cache_invalid','音频读取失败。'))})}catch{reject(err('audio_cache_invalid','音频读取失败。'))}})
const fileSize=path=>{try{return Number(fs().statSync(path).size)||0}catch{return 0}}
function forget(key,path=''){const current=records(),match=item=>item.key===key&&(!path||item.path===path),target=current.find(match);save(current.filter(item=>!match(item)));return target}
async function removeRecord(key,path=''){const target=forget(key,path);if(target){await drain(target.path);await unlink(target.path)}else if(path){await drain(path);await unlink(path)}const active=entries.get(key);if(active&&!active.refs)entries.delete(key)}
function prune(){let list=records(),total=list.reduce((sum,item)=>sum+item.offset,0),count=list.length,changed=false;for(const item of [...list].sort((a,b)=>a.used-b.used)){if(count<=MAX_FILES&&total<=MAX_BYTES)break;if(entries.get(item.key)?.refs)continue;list=list.filter(value=>value.key!==item.key);total-=item.offset;count--;changed=true;unlink(item.path)}if(changed)save(list)}
function put(record){const list=records().filter(item=>item.key!==record.key);save([...list,record]);prune()}
const mp3=async record=>{if(fileSize(record.path)!==record.total)return false;const head=await read(record.path,0,3).catch(()=>null);return Boolean(head&&((head[0]===73&&head[1]===68&&head[2]===51)||(head[0]===255&&(head[1]&224)===224)))}
function request(entry,range,etag=''){
 return new Promise((resolve,reject)=>{
  let settled=false,task,timer
  const end=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(entry.endRequest===cancel)entry.endRequest=null;if(entry.task===task)entry.task=null;fn(value)}
  const cancel=error=>end(reject,error)
  entry.endRequest=cancel
  timer=setTimeout(()=>{cancel(err('audio_chunk_timeout','音频分段超时，请重试。'));task?.abort?.()},REQUEST_MS)
  try{task=wx.request({url:entry.url,method:'GET',responseType:'arraybuffer',timeout:REQUEST_MS,header:{Range:range,...(etag?{'If-Range':etag}:{})},success:value=>entry.done?cancel(cancelled()):end(resolve,value),fail:()=>cancel(interrupted())});entry.task=task;task?.onHeadersReceived?.(value=>{const status=Number(value?.statusCode),size=Number(header(value?.header,'content-length'));if(status===200||status===206&&!strong(header(value?.header,'etag'))){cancel(err('audio_range_unsupported','音频源不支持安全分段。'));task.abort?.()}else if(size>MAX_FILE){cancel(err('audio_file_invalid','音频过大。'));task.abort?.()}})}catch{cancel(interrupted())}
 })
}
function checked(response,start,end,total=null,etag=''){
 const status=Number(response?.statusCode),data=bytes(response?.data),responseEtag=strong(header(response?.header,'etag')),range=contentRange(header(response?.header,'content-range')),type=header(response?.header,'content-type'),length=Number(header(response?.header,'content-length'))
 if(status===200)throw err('audio_range_unsupported','音频源不支持安全分段。')
 if(status===416)throw err('audio_range_invalid','音频范围已变化。')
 if(status===206&&!responseEtag)throw err('audio_range_unsupported','音频源缺少续传标识。')
 if(status!==206||!/^audio\/(?:mpeg|mp3)(?:\s*;|$)/i.test(type)||etag&&responseEtag!==etag||!range||range.start!==start||range.end!==end||range.total<=0||range.total>MAX_FILE||total!==null&&range.total!==total||!data||data.byteLength!==end-start+1||length!==data.byteLength)throw err('audio_chunk_invalid','音频分段不完整。')
 return{data,etag:responseEtag,total:range.total}
}
function stop(entry,error,{abort=false}={}){if(entry.done)return;const task=entry.task;entry.done=true;clearTimeout(entry.hard);entry.endRequest?.(error);entry.endRequest=null;if(abort)task?.abort?.();entry.task=null;entries.delete(entry.key);entry.reject(error);prune()}
function complete(entry,path){if(entry.done)return;entry.done=true;clearTimeout(entry.hard);entry.path=path;entry.resolve(path);prune()}
function guard(entry){if(entry.done||entries.get(entry.key)!==entry)throw cancelled()}
function closeEntry(entry){if(entry.closing)return;entry.closing=true;if(entry.done&&entries.get(entry.key)===entry)entries.delete(entry.key);Promise.resolve(entry.stale?removeRecord(entry.key,entry.path):null).finally(entry.close)}
function waitStale(entry,url,options){let next,released=false,stale=false;const promise=entry.closed.then(()=>{if(released)throw cancelled();next=acquireRangeAudio(url,options);if(stale)next.invalidate();return next.promise});return{promise,release(){released=true;next?.release()},invalidate(){if(released)return;stale=true;next?.invalidate()}}}
async function run(entry){
 try{
  let stored=records().find(item=>item.key===entry.key)
  if(stored)entry.path=stored.path
  if(stored?.ready){await drain(stored.path);guard(entry);if(await mp3(stored)){guard(entry);stored={...stored,used:Date.now()};put(stored);return complete(entry,stored.path)}await removeRecord(entry.key);guard(entry);stored=null}
  const probe=checked(await request(entry,'bytes=0-0'),0,0);guard(entry)
  if(stored){await drain(stored.path);guard(entry)}
  if(stored&&(stored.etag!==probe.etag||stored.total!==probe.total||fileSize(stored.path)!==stored.offset||(await read(stored.path,0,1).catch(()=>null))?.[0]!==probe.data[0])){await removeRecord(entry.key);guard(entry);stored=null;entry.path=''}
  if(!stored){try{fs().mkdirSync(folder(),true)}catch{fs().accessSync(folder())}const path=folder()+'/audio-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)+'.mp3';entry.pendingPath=entry.path=path;await write(path,probe.data);guard(entry);stored={schema:SCHEMA,key:entry.key,url:entry.url,version:entry.version,etag:probe.etag,total:probe.total,offset:1,ready:probe.total===1,path,used:Date.now()};try{put(stored)}catch{await unlink(path);throw checkpoint()}}else{stored={...stored,used:Date.now()};put(stored)}
  entry.progress(stored.offset,stored.total)
  while(stored.offset<stored.total){guard(entry);const start=stored.offset,end=Math.min(start+CHUNK-1,stored.total-1),part=checked(await request(entry,`bytes=${start}-${end}`,stored.etag),start,end,stored.total,stored.etag);guard(entry);await write(stored.path,part.data,true);guard(entry);if(fileSize(stored.path)!==end+1){await removeRecord(entry.key);throw checkpoint()}const next={...stored,offset:end+1,ready:end+1===stored.total,used:Date.now()};try{put(next)}catch{await removeRecord(entry.key);throw checkpoint()}stored=next;entry.progress(stored.offset,stored.total)}
  guard(entry);if(!await mp3(stored)){await removeRecord(entry.key);throw err('audio_file_invalid','音频文件不完整。')}guard(entry)
  complete(entry,stored.path)
 }catch(error){
  if(entry.pendingPath&&!records().some(item=>item.path===entry.pendingPath)){await drain(entry.pendingPath);await unlink(entry.pendingPath);entry.pendingPath=''}
  if(['audio_range_unsupported','audio_range_invalid'].includes(error?.code))await removeRecord(entry.key)
  stop(entry,error?.code?error:interrupted(),{abort:error?.code==='audio_hard_timeout'})
 }
}
function acquireRangeAudio(url,{version='',onProgress=()=>{}}={}){
 if(!supported())return null
 if(!URL_OK.test(url)||/\.\.|%2e|%2f|%5c/i.test(url))throw Error('音频地址无效，请重新选题。')
 const normalizedVersion=String(version);if(normalizedVersion.length>200)throw Error('音频版本标识无效，请重新选题。')
 const key=url+'|'+normalizedVersion,existing=entries.get(key)
 if(existing?.stale)return waitStale(existing,url,{version:normalizedVersion,onProgress})
 let entry=existing
 if(!entry){entry={key,url,version:normalizedVersion,refs:0,listeners:new Set(),done:false,path:'',progress(bytes,total){const value={bytes,total,percent:total?Math.min(99,Math.floor(bytes*100/total)):null};for(const listener of this.listeners)listener(value)}};entry.promise=new Promise((resolve,reject)=>{entry.resolve=resolve;entry.reject=reject});entry.closed=new Promise(resolve=>{entry.close=resolve});entries.set(key,entry);entry.hard=setTimeout(()=>stop(entry,err('audio_hard_timeout','音频准备超时，进度已保留。'),{abort:true}),HARD_MS);run(entry)}
 entry.refs++;entry.listeners.add(onProgress)
 const stored=records().find(item=>item.key===key);onProgress(stored?{bytes:stored.offset,total:stored.total,percent:stored.total?Math.min(99,Math.floor(stored.offset*100/stored.total)):null}:{bytes:0,total:0,percent:null})
 let released=false
 return{promise:entry.promise,invalidate(){if(released||entries.get(key)!==entry)return;entry.stale=true;const stored=records().find(item=>item.key===key&&item.path===entry.path);if(stored)forget(key,entry.path);if(!entry.refs)closeEntry(entry)},release(){if(released)return;released=true;entry.listeners.delete(onProgress);entry.refs=Math.max(0,entry.refs-1);if(!entry.refs&&!entry.done)stop(entry,cancelled(),{abort:true});if(!entry.refs)closeEntry(entry);prune()}}
}
module.exports={acquireRangeAudio,REGISTRY_KEY}
