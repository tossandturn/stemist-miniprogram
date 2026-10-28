const {createSha256}=require('./sha256')
const REGISTRY='stemistPdfRanges',KiB=1024,PROBE=256*KiB,START_CHUNK=256*KiB,MIN_CHUNK=32*KiB,MAX_CHUNK=1024*KiB,HASH_CHUNK=512*KiB,MAX_PENDING=2*1024*KiB,FILE_REQUESTS=2,GLOBAL_REQUESTS=4,FAST_MS=2000,SLOW_MS=10000,MAX_FILE=32*1024*1024,MAX_FILES=64,MAX_BYTES=32*1024*1024
const PDF_CACHE_LIMITS=Object.freeze({files:MAX_FILES,bytes:MAX_BYTES})
const activePdfFiles=new WeakMap()
const globalPdfRequests=new WeakMap()
const URL_OK=/^https:\/\/stem\.ieltsist\.com\/(?:api\/stem\/curriculum-papers\/files\/(?:file-[a-f0-9]{24}(?:[a-f0-9]{8}|-[a-f0-9]{16})|(?:ap|ib)-[A-Za-z0-9][A-Za-z0-9._-]{0,195})|local-pdf\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.%~-]+\.pdf)$/i
const header=(h,n)=>{const k=Object.keys(h||{}).find(k=>k.toLowerCase()===n.toLowerCase());return k===undefined?'':String(h[k]).trim()}
const bytes=d=>Object.prototype.toString.call(d)==='[object ArrayBuffer]'?new Uint8Array(d):ArrayBuffer.isView(d)?new Uint8Array(d.buffer,d.byteOffset,d.byteLength):null
const binary=d=>d.byteOffset===0&&d.byteLength===d.buffer.byteLength?d.buffer:d.buffer.slice(d.byteOffset,d.byteOffset+d.byteLength)
const problem=(code,message)=>Object.assign(Error(message),{code})
const etag=s=>/^"[^"\s]{1,180}"$/.test(s)?s:''
const contentRange=s=>{const m=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(s);if(!m)return null;const n=m.slice(1).map(Number);return n.every(Number.isSafeInteger)?{start:n[0],end:n[1],total:n[2]}:null}
function pdfAccessHeaders(url,token){return /^https:\/\/stem\.ieltsist\.com\/(?:local-pdf\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.%~-]+\.pdf|api\/stem\/curriculum-papers\/files\/[A-Za-z0-9][A-Za-z0-9._-]{0,199})$/i.test(url)&&!/\.\.|%2e|%2f|%5c/i.test(url)&&typeof token==='string'&&/^[A-Za-z0-9._-]{1,4096}$/.test(token)?{Authorization:'Bearer '+token}:{}}
function pdfAccessError(status,headers){
 const code=header(headers,'x-pdf-access-code')
 if(Number(status)===401)return problem('pdf_auth_required','请登录后继续下载，已保存进度不会丢失。')
 if([403,429].includes(Number(status))&&code==='pdf_daily_limit_reached')return problem(code,'今日免费额度已用完，真题与答案合计 2 份；北京时间每天 00:00 重置，已缓存文件仍可打开。')
 if(Number(status)===403)return problem('pdf_access_denied','此文件暂不可下载，请返回刷新目录。')
 if(Number(status)===429)return problem('pdf_rate_limited','请求较多，请稍后重试。')
 if(Number(status)>=500)return Object.assign(problem(code==='pdf_quota_unavailable'?code:'pdf_network','下载服务暂不可用（HTTP '+Number(status)+'），请稍后重试。'),{httpStatus:Number(status)})
 return null
}

function requestSlot(wxApi){
 let pool=globalPdfRequests.get(wxApi);if(!pool){pool={active:0,queue:[]};globalPdfRequests.set(wxApi,pool)}
 const pump=()=>{while(pool.active<GLOBAL_REQUESTS&&pool.queue.length)pool.queue.shift().grant()}
 let entry
 const promise=new Promise((resolve,reject)=>{entry={granted:false,cancelled:false,error:null,reject,grant(){if(this.cancelled)return;this.granted=true;pool.active++;let released=false;this.release=()=>{if(released)return;released=true;pool.active--;pump()};resolve(this.release)}}})
 if(pool.active<GLOBAL_REQUESTS)entry.grant();else pool.queue.push(entry)
 return{promise,get error(){return entry.error},cancel(error){if(entry.cancelled)return;entry.cancelled=true;entry.error=error;if(entry.granted)entry.release?.();else{const index=pool.queue.indexOf(entry);if(index>=0)pool.queue.splice(index,1);entry.reject(error)}}}
}

async function reclaimCompletedPublicPdfs(wxApi,isCurrent=()=>true){
 const root=String(wxApi?.env?.USER_DATA_PATH||''),fs=wxApi?.getFileSystemManager?.(),folder=root+'/pdf-cache/'
 if(!root||!fs||typeof fs.unlink!=='function')return 0
 const list=()=>{const r=wxApi.getStorageSync?.(REGISTRY);return Array.isArray(r)?r:[]}
 const owned=p=>typeof p==='string'&&p.startsWith(folder)&&!(/\.\.|%2e|%2f|%5c/i.test(p.slice(folder.length)))&&/^pdf-[a-z0-9-]+\/[A-Za-z0-9_\u4e00-\u9fff .()%-]+\.pdf$/.test(p.slice(folder.length))
 const reclaimable=r=>r?.schema===1&&owned(r.path)&&URL_OK.test(r.url||'')&&!/\.\.|%2e|%2f|%5c/i.test(r.url||'')&&typeof r.owner==='string'&&etag(r.etag)&&Number.isSafeInteger(r.total)&&r.total>=5&&r.total<=MAX_FILE&&r.offset===r.total&&!activePdfFiles.get(wxApi)?.has(r.path)
 let removed=0
 for(const r of list().filter(reclaimable).sort((a,b)=>a.used-b.used).slice(0,8)){
  if(!isCurrent())break
  if(!reclaimable(r))continue
  try{const kept=list().filter(x=>x?.path!==r.path);if(kept.length)wxApi.setStorageSync(REGISTRY,kept);else wxApi.removeStorageSync(REGISTRY)}catch{continue}
  const ok=await new Promise(resolve=>{try{fs.unlink({filePath:r.path,success:()=>resolve(true),fail:()=>resolve(false)})}catch{resolve(false)}})
  if(ok)removed++
 }
 return removed
}

function acquirePdf(options){
 const {wxApi,url,owner,version='',fileName,expectedBytes=0,expectedSha256='',accessToken='',onProgress=()=>{},onTemporary=()=>{},onPhase=()=>{}}=options
 const root=String(wxApi.env?.USER_DATA_PATH||''),fs=wxApi.getFileSystemManager?.()
 if(!URL_OK.test(url)||/\.\.|%2e|%2f|%5c/i.test(url)||!root||!fs||/\.\.|%2e|%2f|%5c/i.test(fileName)||!/^[A-Za-z0-9_\u4e00-\u9fff .()%-]+\.pdf$/.test(fileName)||typeof wxApi.request!=='function'||!['writeFile','appendFile','readFile','statSync','mkdirSync','accessSync','unlink'].every(k=>typeof fs[k]==='function'))return null
 const folder=root+'/pdf-cache',owned=p=>typeof p==='string'&&p.startsWith(folder+'/')&&!(/\.\.|%2e|%2f|%5c/i.test(p.slice(folder.length+1)))&&/^pdf-[a-z0-9-]+\/[A-Za-z0-9_\u4e00-\u9fff .()%-]+\.pdf$/.test(p.slice(folder.length+1))
 const key=owner+'|'+url+'|'+version
 let active=activePdfFiles.get(wxApi);if(!active){active=new Map();activePdfFiles.set(wxApi,active)}
 const prior=active.get(key)
 if(prior){let next,stop=false,stale=false;const promise=prior.then(()=>{if(stop)throw problem('pdf_cancelled','已暂停下载。');next=acquirePdf(options);if(stale)next.invalidate();return next.promise});return{promise,release(){stop=true;next?.release()},invalidate(){stale=true;next?.invalidate()}}}
 let stopped=false,hard=null,targetBytes=START_CHUNK,fastStreak=0
 const waitingSlots=new Map(),requests=new Set()
 const check=()=>{if(stopped)throw problem('pdf_cancelled','已暂停下载。')}
 const guard=batch=>{check();if(batch?.error)throw batch.error}
 const cancelBatch=(batch,error)=>{if(batch&&!batch.error)batch.error=error;for(const [slot,owner] of waitingSlots)if(!batch||owner===batch)slot.cancel(error);for(const item of [...requests])if(!batch||item.batch===batch)item.cancel(error)}
 const cancelAll=error=>cancelBatch(null,error)
 const progress=(saved,total)=>{try{onProgress(saved,total)}catch{}}
 const phase=(value,saved=0,total=0)=>{try{onPhase(value,saved,total)}catch{}}
 const size=p=>{try{return Number(fs.statSync(p).size)||0}catch{return 0}}
 const registry=()=>{const r=wxApi.getStorageSync?.(REGISTRY);return Array.isArray(r)?r.filter(x=>x&&x.schema===1&&owned(x.path)&&URL_OK.test(x.url)&&typeof x.owner==='string'&&Number.isSafeInteger(x.offset)&&x.offset>0&&x.offset<=x.total&&x.total<=MAX_FILE&&etag(x.etag)):[]}
 const save=r=>{if(r.length)wxApi.setStorageSync(REGISTRY,r);else wxApi.removeStorageSync(REGISTRY)}
 const unlink=p=>new Promise(resolve=>{if(!owned(p))return resolve(false);try{fs.unlink({filePath:p,success:()=>resolve(true),fail:()=>resolve(false)})}catch{resolve(false)}})
 function forget(record){if(!record)return;save(registry().filter(x=>x.key!==record.key));unlink(record.path)}
 const reclaimable=x=>x.key!==key&&x.offset===x.total&&!active.has(x.path)
 function put(record){let list=registry().filter(x=>x.key!==record.key&&x.path!==record.path);list.push(record);list.sort((a,b)=>a.used-b.used);while(list.length>MAX_FILES||list.reduce((n,x)=>n+x.offset,0)>MAX_BYTES){const index=list.findIndex(reclaimable);if(index<0)break;const first=list.splice(index,1)[0];unlink(first.path)}save(list)}
 async function releaseSpace(all=false){
  let list=registry(),available=Math.max(0,MAX_BYTES-(record?.total||expectedBytes||0)),foreign=list.filter(reclaimable).sort((a,b)=>a.used-b.used)
  for(const item of foreign){if(active.has(item.path))continue;if(!all&&list.filter(x=>x.key!==key).reduce((n,x)=>n+x.offset,0)<=available)break;list=list.filter(x=>x.path!==item.path);save(list);await unlink(item.path)}
 }
 const call=async(method,args)=>{
  const attempt=()=>new Promise((resolve,reject)=>{try{fs[method]({...args,success:resolve,fail:e=>reject(problem(/limit|quota|no space|storage.*full|exceed|空间/i.test(String(e?.errMsg||''))?'pdf_storage_full':'pdf_storage','文件保存失败，请释放一些小程序存储后重试。'))})}catch{reject(problem('pdf_storage','文件保存失败，请重试。'))}})
  try{return await attempt()}catch(error){if(error.code!=='pdf_storage_full'||!['writeFile','appendFile'].includes(method))throw error;await releaseSpace(true);check();return attempt()}
 }
 const read=async(p,start,length)=>bytes((await call('readFile',{filePath:p,position:start,length})).data)
 function headerError(meta,start,end,total,tag,allowEof){
  const denied=pdfAccessError(meta?.statusCode,meta?.header||meta?.headers);if(denied)return denied
  const h=meta?.header||meta?.headers||{},rawStatus=meta?.statusCode,status=rawStatus===undefined||rawStatus===null||rawStatus===''?NaN:Number(rawStatus),rawLength=header(h,'content-length'),length=rawLength===''?0:Number(rawLength),rawTag=header(h,'etag'),t=etag(rawTag),rawRange=header(h,'content-range'),cr=rawRange?contentRange(rawRange):null
  if(Number.isFinite(status)&&status!==206)return problem(status===200?'pdf_source_changed':'pdf_invalid_range',status===200?'文件来源已更新，请重新下载。':'文件分段校验失败，请重新下载。')
  if(rawLength!==''&&(!Number.isSafeInteger(length)||length<0||length>end-start+1))return problem('pdf_invalid_range','文件分段校验失败，请重新下载。')
  if(tag&&rawTag&&(!t||t!==tag))return problem(t?'pdf_source_changed':'pdf_invalid_range',t?'文件来源已更新，请重新下载。':'文件分段校验失败，请重新下载。')
  if(rawRange){
   if(!cr||cr.total<5||cr.total>MAX_FILE||cr.start!==start||cr.end!==(allowEof?Math.min(end,cr.total-1):end)||cr.end>=cr.total||rawLength!==''&&length!==cr.end-cr.start+1)return problem('pdf_invalid_range','文件分段校验失败，请重新下载。')
   if(total&&cr.total!==total||expectedBytes&&cr.total!==expectedBytes)return problem('pdf_source_changed','文件大小与目录不一致，请刷新目录重试。')
  }
  return null
 }
 async function request(start,end,tag='',batch,allowEof=false){
  guard(batch);const slot=requestSlot(wxApi);waitingSlots.set(slot,batch);let release
  try{release=await slot.promise}finally{waitingSlots.delete(slot)}
  try{
   guard(batch);if(slot.error)throw slot.error
   return await new Promise((resolve,reject)=>{
    let settled=false,timer,listener;const started=Date.now(),item={batch,task:null,cancel:error=>{const active=item.task;finish(reject,error);try{active?.abort?.()}catch{}}}
    const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(listener&&typeof item.task?.offHeadersReceived==='function')try{item.task.offHeadersReceived(listener)}catch{}requests.delete(item);fn(value)}
    requests.add(item);timer=setTimeout(()=>item.cancel(problem('pdf_timeout','文件分段下载超时。')),20000)
    try{
     item.task=wxApi.request({url,method:'GET',responseType:'arraybuffer',timeout:20000,header:{...pdfAccessHeaders(url,accessToken),Range:'bytes='+start+'-'+end,...(tag?{'If-Range':tag}:{})},success:r=>finish(resolve,{response:r,activeMs:Date.now()-started}),fail:e=>{const raw=String(e?.errMsg||'');finish(reject,problem(/domain|合法域名/i.test(raw)?'pdf_domain':'pdf_network',/domain|合法域名/i.test(raw)?'服务连接配置需要更新，请使用最新版小程序。':'网络中断，请重试。'))}})
     if(!settled&&typeof item.task?.onHeadersReceived==='function'){listener=meta=>{const error=headerError(meta,start,end,totalFor(batch),tag,allowEof);if(error)item.cancel(error)};item.task.onHeadersReceived(listener)}
    }catch{const active=item.task;finish(reject,problem('pdf_network','网络连接失败，请重试。'));try{active?.abort?.()}catch{}}
   })
  }finally{release?.()}
 }
 const totalFor=batch=>Number(batch?.total)||0
 function checked(result,start,end,total=0,tag='',allowEof=false){
  const denied=pdfAccessError(result.response?.statusCode,result.response?.header);if(denied)throw denied
  const r=result.response,status=Number(r.statusCode),data=bytes(r.data),cr=contentRange(header(r.header,'content-range')),t=etag(header(r.header,'etag')),length=Number(header(r.header,'content-length'))
  if(status===200)throw problem('pdf_source_changed','文件来源已更新，请重新下载。')
  if(status!==206||!cr||cr.total<5||cr.total>MAX_FILE||cr.start!==start||cr.end!==(allowEof?Math.min(end,cr.total-1):end)||cr.end>=cr.total||!data||data.length!==cr.end-cr.start+1||!Number.isSafeInteger(length)||length!==data.length||!t||!/^application\/pdf(?:;|$)/i.test(header(r.header,'content-type')))throw problem('pdf_invalid_range','文件分段校验失败，请重新下载。')
  if(tag&&t!==tag||total&&cr.total!==total||expectedBytes&&cr.total!==expectedBytes)throw problem('pdf_source_changed','文件大小或版本与目录不一致，请刷新目录重试。')
  return{data,total:cr.total,etag:t,activeMs:result.activeMs}
 }
 async function probe(batch,resume=false){
  let length=resume?5:Math.max(5,expectedBytes?Math.min(PROBE,expectedBytes):PROBE)
  for(let attempt=0;;attempt++){
   guard(batch)
   try{const part=checked(await request(0,length-1,'',batch,true),0,length-1,0,'',true);if(part.activeMs>=SLOW_MS)targetBytes=Math.max(MIN_CHUNK,Math.floor(targetBytes/2));return part}catch(error){
    if(!['pdf_network','pdf_timeout'].includes(error?.code)||attempt>=2)throw error
    const next=resume?5:attempt===0?Math.max(MIN_CHUNK,Math.floor(length/2)):MIN_CHUNK;length=Math.max(5,expectedBytes?Math.min(expectedBytes,next):next);targetBytes=Math.min(targetBytes,Math.max(MIN_CHUNK,length));fastStreak=0
    await new Promise(resolve=>setTimeout(resolve,[350,900][attempt]));guard(batch)
   }
  }
 }
 async function segment(start,end,total,tag,batch){
  const pieces=[];let at=start,pieceBytes=end-start+1,transient=false,maxMs=0,minPiece=pieceBytes
  while(at<=end){
   let wanted=Math.min(pieceBytes,end-at+1)
   for(let attempt=0;;attempt++){
    guard(batch)
    try{const part=checked(await request(at,at+wanted-1,tag,batch),at,at+wanted-1,total,tag);pieces.push({start:at,data:part.data});at+=part.data.length;maxMs=Math.max(maxMs,part.activeMs);minPiece=Math.min(minPiece,part.data.length);break}catch(error){
     if(!['pdf_network','pdf_timeout'].includes(error?.code)||attempt>=2)throw error
     transient=true;pieceBytes=attempt===0?Math.max(MIN_CHUNK,Math.floor(wanted/2)):MIN_CHUNK;wanted=Math.min(pieceBytes,end-at+1);targetBytes=Math.min(targetBytes,pieceBytes);fastStreak=0
     await new Promise(resolve=>setTimeout(resolve,[350,900][attempt]));guard(batch)
    }
   }
  }
  return{start,end,bytes:end-start+1,pieces,transient,activeMs:maxMs,minPiece}
 }
 function adapt(result){
  if(result.transient){fastStreak=0;targetBytes=Math.max(MIN_CHUNK,Math.min(targetBytes,result.minPiece));return}
  if(result.activeMs>=SLOW_MS){fastStreak=0;targetBytes=Math.max(MIN_CHUNK,Math.floor(targetBytes/2));return}
  if(result.activeMs>FAST_MS){fastStreak=0;return}
  if(++fastStreak>=2){targetBytes=Math.min(MAX_CHUNK,targetBytes*2);fastStreak=0}
 }
 async function verify(record){
  if(expectedBytes&&record.total!==expectedBytes)return false
  if(size(record.path)!==record.total)return false
  const head=await read(record.path,0,5);if(!head||String.fromCharCode(...head)!=='%PDF-')return false
  const expected=expectedSha256||record.sha256||'',hash=createSha256()
  for(let at=0;at<record.total;at+=HASH_CHUNK){check();const length=Math.min(HASH_CHUNK,record.total-at),d=await read(record.path,at,length);if(!d||d.length!==length)return false;hash.update(d)}
  const actual=hash.digest();if(expected&&actual!==expected)return false
  record.sha256=actual;return true
 }
 async function temporary(){
  if(typeof wxApi.downloadFile!=='function')throw problem('pdf_storage_full','本机空间不足，请清理下载缓存后重试。')
  try{onTemporary()}catch{}phase('downloading',0,record.total);progress(0,record.total)
  const batch={error:null,total:record.total},slot=requestSlot(wxApi);waitingSlots.set(slot,batch);let release,result,accessHeaders={},accessStatus
  try{release=await slot.promise}finally{waitingSlots.delete(slot)}
  try{
   guard(batch);if(slot.error)throw slot.error
   result=await new Promise((resolve,reject)=>{
    let settled=false,item={batch,task:null,cancel:error=>{const active=item.task;finish(reject,error);try{active?.abort?.()}catch{}}},finish=(fn,value)=>{if(settled)return;settled=true;requests.delete(item);fn(value)}
    requests.add(item)
    try{item.task=wxApi.downloadFile({url,header:pdfAccessHeaders(url,accessToken),timeout:180000,success:r=>finish(resolve,r),fail:()=>finish(reject,pdfAccessError(accessStatus,accessHeaders)||problem('pdf_network','临时预览下载中断，请重试。'))});item.task?.onHeadersReceived?.(r=>{accessHeaders=r.header||{};accessStatus=r.statusCode});item.task?.onProgressUpdate?.(r=>{if(!settled&&!stopped)progress(Number(r.totalBytesWritten)||0,Number(r.totalBytesExpectedToWrite)||record.total)})}catch{const active=item.task;finish(reject,problem('pdf_storage_full','临时文件未能准备，请重试。'));try{active?.abort?.()}catch{}}
   })
  }finally{release?.()}
  check();const p=String(result.tempFilePath||result.filePath||'')
  const denied=pdfAccessError(result.statusCode,{...accessHeaders,...result.header});if(denied)throw denied
  if(Number(result.statusCode)!==200||!p)throw problem('pdf_integrity','临时 PDF 校验失败，请重新下载。')
  phase('verifying',record.total,record.total)
  if(!await verify({path:p,total:record.total}))throw problem('pdf_integrity','临时 PDF 校验失败，请重新下载。')
  check();progress(record.total,record.total);return p
 }
 let record=registry().find(x=>x.key===key)||(expectedSha256?registry().find(x=>x.url===url&&x.owner===owner&&x.offset===x.total&&(!expectedBytes||x.total===expectedBytes)):null),restarts=0
 const reservations=new Set(),reserve=p=>{if(p&&!reservations.has(p)){reservations.add(p);active.set(p,(active.get(p)||0)+1)}}
 reserve(record?.path)
 let done,gate=new Promise(resolve=>done=resolve);active.set(key,gate)
 async function append(start,data,batch,report=true){
  guard(batch);if(start!==record.offset)throw problem('pdf_checkpoint','已保存的文件进度无效，请重新下载。')
  await call('appendFile',{filePath:record.path,data:binary(data)});record.offset=start+data.length
  if(size(record.path)!==record.offset)throw problem('pdf_checkpoint','已保存的文件进度无效，请重新下载。')
  put({...record,used:Date.now()});guard(batch);if(report)progress(record.offset,record.total)
 }
 async function pipeline(batch){
  let next=record.offset,outstanding=0;const jobs=[],ready=new Map()
  const launch=()=>{
   while(jobs.length<FILE_REQUESTS&&next<record.total){
    const length=Math.min(targetBytes,record.total-next,MAX_PENDING-outstanding);if(length<=0)break
    const job={start:next,end:next+length-1,bytes:length};job.settled=segment(job.start,job.end,record.total,record.etag,batch).then(value=>({job,value}),error=>({job,error}));jobs.push(job);next+=length;outstanding+=length
   }
  }
  try{
   launch()
   while(record.offset<record.total){
    guard(batch);if(!jobs.length)throw problem('pdf_checkpoint','已保存的文件进度无效，请重新下载。')
    const settled=await Promise.race(jobs.map(job=>job.settled)),index=jobs.indexOf(settled.job);if(index>=0)jobs.splice(index,1)
    if(settled.error)throw settled.error
    ready.set(settled.value.start,settled.value);adapt(settled.value)
    while(ready.has(record.offset)){
     const part=ready.get(record.offset);ready.delete(record.offset)
     for(const piece of part.pieces)await append(piece.start,piece.data,batch)
     outstanding-=part.bytes
    }
    launch()
   }
  }catch(error){cancelBatch(batch,error);await Promise.all(jobs.map(job=>job.settled));throw error}
 }
 async function run(){
  const batch={error:null,total:0}
  try{
   check()
   if(record&&size(record.path)!==record.offset){forget(record);record=null}
   if(record?.offset===record?.total&&record){phase('checking-cache',record.total,record.total);if(await verify(record)){check();record={...record,key,version,used:Date.now()};put(record);phase('cached',record.total,record.total);progress(record.total,record.total);return record.path}forget(record);record=null}
   phase('connecting',record?.offset||0,record?.total||expectedBytes||0)
   let first=await probe(batch,Boolean(record));batch.total=first.total;guard(batch)
   if(first.data.length<5||String.fromCharCode(...first.data.subarray(0,5))!=='%PDF-')throw problem('pdf_integrity','下载内容不是完整 PDF。')
   if(record&&(record.etag!==first.etag||record.total!==first.total)){forget(record);record=null;first=await probe(batch);batch.total=first.total;guard(batch);if(first.data.length<5||String.fromCharCode(...first.data.subarray(0,5))!=='%PDF-')throw problem('pdf_integrity','下载内容不是完整 PDF。')}
   if(!record){
    const dir=folder+'/pdf-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)
    try{fs.mkdirSync(dir,true)}catch{fs.accessSync(dir)}
    record={schema:1,key,url,owner,version,path:dir+'/'+fileName,offset:0,total:first.total,etag:first.etag,used:Date.now()}
    reserve(record.path)
    await releaseSpace();await call('writeFile',{filePath:record.path,data:binary(first.data)});record.offset=first.data.length;put(record);guard(batch)
   }else if(record.offset<first.data.length){
    await append(record.offset,first.data.subarray(record.offset),batch,false)
   }
   phase('downloading',record.offset,record.total);progress(record.offset,record.total)
   if(record.offset<record.total)await pipeline(batch)
   phase('verifying',record.total,record.total)
   if(!await verify(record))throw problem('pdf_integrity','PDF 完整性校验失败，请重新下载。')
   check();put({...record,used:Date.now()});return record.path
  }catch(error){
   if(error?.code==='pdf_storage_full'&&record)return temporary()
   if(record&&record.offset===0){await unlink(record.path);record=null}
   if(['pdf_source_changed','pdf_invalid_range','pdf_checkpoint','pdf_integrity'].includes(error?.code)){forget(record);record=null;if(error.code==='pdf_source_changed'&&restarts++===0&&!stopped)return run()}
   throw error
  }
 }
  hard=setTimeout(()=>{if(stopped)return;stopped=true;cancelAll(problem('pdf_timeout','下载等待超时，已保存的分段可继续下载。'))},300000)
  const promise=run().finally(()=>{clearTimeout(hard);for(const p of reservations){const count=(active.get(p)||1)-1;if(count)active.set(p,count);else active.delete(p)}active.delete(key);done()})
  return{promise,release(){if(stopped)return;stopped=true;cancelAll(problem('pdf_cancelled','已暂停下载。'))},invalidate(){forget(record)}}
 }
 module.exports={acquirePdf,reclaimCompletedPublicPdfs,REGISTRY,PDF_CACHE_LIMITS,pdfAccessHeaders,pdfAccessError}
