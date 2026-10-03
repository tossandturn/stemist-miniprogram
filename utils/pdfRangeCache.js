const {createSha256}=require('./sha256')
const REGISTRY='stemistPdfRanges',CHUNK=128*1024,MAX_FILE=32*1024*1024,MAX_FILES=4,MAX_BYTES=8*1024*1024
const activePdfFiles=new WeakMap()
const URL_OK=/^https:\/\/stem\.ieltsist\.com\/(?:api\/stem\/curriculum-papers\/files\/file-[a-f0-9]{32}|local-pdf\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.%~-]+\.pdf)$/i
const header=(h,n)=>{const k=Object.keys(h||{}).find(k=>k.toLowerCase()===n.toLowerCase());return k===undefined?'':String(h[k]).trim()}
const bytes=d=>Object.prototype.toString.call(d)==='[object ArrayBuffer]'?new Uint8Array(d):ArrayBuffer.isView(d)?new Uint8Array(d.buffer,d.byteOffset,d.byteLength):null
const binary=d=>d.buffer.slice(d.byteOffset,d.byteOffset+d.byteLength)
const problem=(code,message)=>Object.assign(Error(message),{code})
const etag=s=>/^"[^"\s]{1,180}"$/.test(s)?s:''
const contentRange=s=>{const m=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(s);if(!m)return null;const n=m.slice(1).map(Number);return n.every(Number.isSafeInteger)?{start:n[0],end:n[1],total:n[2]}:null}

async function reclaimCompletedPublicPdfs(wxApi,isCurrent=()=>true){
 const root=String(wxApi?.env?.USER_DATA_PATH||''),fs=wxApi?.getFileSystemManager?.(),folder=root+'/pdf-cache/'
 if(!root||!fs||typeof fs.unlink!=='function')return 0
 const list=()=>{const r=wxApi.getStorageSync?.(REGISTRY);return Array.isArray(r)?r:[]}
 const active=activePdfFiles.get(wxApi)||new Map()
 const owned=p=>typeof p==='string'&&p.startsWith(folder)&&!(/\.\.|%2e|%2f|%5c/i.test(p.slice(folder.length)))&&/^pdf-[a-z0-9-]+\/[A-Za-z0-9_\u4e00-\u9fff .()%-]+\.pdf$/.test(p.slice(folder.length))
 let removed=0
 for(const r of list().slice(-8)){
  if(!isCurrent())break
  if(r?.schema!==1||!owned(r.path)||!URL_OK.test(r.url||'')||/\.\.|%2e|%2f|%5c/i.test(r.url||'')||typeof r.owner!=='string'||!etag(r.etag)||!Number.isSafeInteger(r.total)||r.total<5||r.total>MAX_FILE||r.offset!==r.total||active.has(r.path))continue
  // Remove the exact registry path before unlink so a new transfer creates a
  // new path instead of concurrently opening the file selected for eviction.
  try{const kept=list().filter(x=>x?.path!==r.path);if(kept.length)wxApi.setStorageSync(REGISTRY,kept);else wxApi.removeStorageSync(REGISTRY)}catch{continue}
  const ok=await new Promise(resolve=>{try{fs.unlink({filePath:r.path,success:()=>resolve(true),fail:()=>resolve(false)})}catch{resolve(false)}})
  if(ok)removed++
 }
 return removed
}

function acquirePdf({wxApi,url,owner,version='',fileName,expectedBytes=0,expectedSha256='',onProgress=()=>{},onTemporary=()=>{},onPhase=()=>{}}){
 const root=String(wxApi.env?.USER_DATA_PATH||''),fs=wxApi.getFileSystemManager?.()
 if(!URL_OK.test(url)||/\.\.|%2e|%2f|%5c/i.test(url)||!root||!fs||/\.\.|%2e|%2f|%5c/i.test(fileName)||!/^[A-Za-z0-9_\u4e00-\u9fff .()%-]+\.pdf$/.test(fileName)||typeof wxApi.request!=='function'||!['writeFile','appendFile','readFile','statSync','mkdirSync','accessSync','unlink'].every(k=>typeof fs[k]==='function'))return null
 const folder=root+'/pdf-cache',owned=p=>typeof p==='string'&&p.startsWith(folder+'/')&&!(/\.\.|%2e|%2f|%5c/i.test(p.slice(folder.length+1)))&&/^pdf-[a-z0-9-]+\/[A-Za-z0-9_\u4e00-\u9fff .()%-]+\.pdf$/.test(p.slice(folder.length+1))
 const key=owner+'|'+url+'|'+version
 let active=activePdfFiles.get(wxApi);if(!active){active=new Map();activePdfFiles.set(wxApi,active)}
 let task=null,stopped=false,rejectRequest=null,hard=null,chunkBytes=CHUNK
 const check=()=>{if(stopped)throw problem('pdf_cancelled','已暂停下载。')}
 const progress=(saved,total)=>{try{onProgress(saved,total)}catch{}}
 const phase=(value,saved=0,total=0)=>{try{onPhase(value,saved,total)}catch{}}
 const size=p=>{try{return Number(fs.statSync(p).size)||0}catch{return 0}}
 const registry=()=>{const r=wxApi.getStorageSync?.(REGISTRY);return Array.isArray(r)?r.filter(x=>x&&x.schema===1&&owned(x.path)&&URL_OK.test(x.url)&&typeof x.owner==='string'&&Number.isSafeInteger(x.offset)&&x.offset>0&&x.offset<=x.total&&x.total<=MAX_FILE&&etag(x.etag)):[]}
 const save=r=>{if(r.length)wxApi.setStorageSync(REGISTRY,r);else wxApi.removeStorageSync(REGISTRY)}
 const unlink=p=>new Promise(resolve=>{if(!owned(p))return resolve(false);try{fs.unlink({filePath:p,success:()=>resolve(true),fail:()=>resolve(false)})}catch{resolve(false)}})
 function forget(record){if(!record)return;save(registry().filter(x=>x.key!==record.key));unlink(record.path)}
 const reclaimable=x=>x.key!==key&&x.offset===x.total&&!active.has(x.path)
 function put(record){let list=registry().filter(x=>x.key!==record.key);list.push(record);list.sort((a,b)=>a.used-b.used);while(list.length>MAX_FILES||list.reduce((n,x)=>n+x.offset,0)>MAX_BYTES){const index=list.findIndex(reclaimable);if(index<0)break;const first=list.splice(index,1)[0];unlink(first.path)}save(list)}
 async function releaseSpace(all=false){
  let list=registry(),available=Math.max(0,MAX_BYTES-(record?.total||expectedBytes||0)),foreign=list.filter(reclaimable).sort((a,b)=>a.used-b.used)
  for(const item of foreign){if(active.has(item.path))continue;if(!all&&list.filter(x=>x.key!==key).reduce((n,x)=>n+x.offset,0)<=available)break;list=list.filter(x=>x.path!==item.path);save(list);await unlink(item.path)}
 }
 const call=async(method,args)=>{
  const attempt=()=>new Promise((resolve,reject)=>{try{fs[method]({...args,success:resolve,fail:e=>reject(problem(/limit|quota|no space|storage.*full|exceed|空间/i.test(String(e?.errMsg||''))?'pdf_storage_full':'pdf_storage','文件保存失败，请释放一些小程序存储后重试。'))})}catch{reject(problem('pdf_storage','文件保存失败，请重试。'))}})
  try{return await attempt()}catch(error){if(error.code!=='pdf_storage_full'||!['writeFile','appendFile'].includes(method))throw error;await releaseSpace(true);check();return attempt()}
 }
 const read=async(p,start,length)=>bytes((await call('readFile',{filePath:p,position:start,length})).data)
 function request(start,end,tag=''){
  return new Promise((resolve,reject)=>{
   let settled=false,timer;const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);task=null;rejectRequest=null;fn(value)}
   rejectRequest=e=>finish(reject,e)
   timer=setTimeout(()=>{const active=task;finish(reject,problem('pdf_timeout','文件分段下载超时。'));active?.abort?.()},20000)
   try{task=wxApi.request({url,method:'GET',responseType:'arraybuffer',timeout:20000,header:{Range:'bytes='+start+'-'+end,...(tag?{'If-Range':tag}:{})},success:r=>finish(resolve,r),fail:e=>{const raw=String(e?.errMsg||'');finish(reject,problem(/domain|合法域名/i.test(raw)?'pdf_domain':'pdf_network',/domain|合法域名/i.test(raw)?'服务连接配置需要更新，请使用最新版小程序。':'网络中断，请重试。'))}})}catch{finish(reject,problem('pdf_network','网络连接失败，请重试。'))}
  })
 }
 function checked(r,start,end,total=0,tag=''){
  const status=Number(r.statusCode),data=bytes(r.data),cr=contentRange(header(r.header,'content-range')),t=etag(header(r.header,'etag'))
  if(status===200)throw problem('pdf_source_changed','文件来源已更新，请重新下载。')
  if(status!==206||!cr||cr.start!==start||cr.end!==end||cr.total<=end||cr.total>MAX_FILE||!data||data.length!==end-start+1||Number(header(r.header,'content-length'))!==data.length||!t||tag&&t!==tag||total&&cr.total!==total||!/^application\/pdf(?:;|$)/i.test(header(r.header,'content-type')))throw problem('pdf_invalid_range','文件分段校验失败，请重新下载。')
  if(expectedBytes&&cr.total!==expectedBytes)throw problem('pdf_source_changed','文件大小与目录不一致，请刷新目录重试。')
  return{data,total:cr.total,etag:t}
 }
 async function segment(start,end,total=0,tag=''){
  for(let attempt=0;;attempt++){
   check()
   try{return checked(await request(start,end,tag),start,end,total,tag)}catch(error){
    if(!['pdf_network','pdf_timeout'].includes(error?.code)||attempt>=2)throw error
    if(end-start+1>32*1024){chunkBytes=Math.max(32*1024,Math.floor((end-start+1)/2));end=start+chunkBytes-1}
    await new Promise(resolve=>setTimeout(resolve,[350,900][attempt]));check()
   }
  }
 }
 async function verify(record){
  if(size(record.path)!==record.total)return false
  const head=await read(record.path,0,5);if(!head||String.fromCharCode(...head)!=='%PDF-')return false
  if(expectedSha256){const hash=createSha256();for(let at=0;at<record.total;at+=CHUNK){check();const d=await read(record.path,at,Math.min(CHUNK,record.total-at));if(!d||!d.length)return false;hash.update(d)}return hash.digest()===expectedSha256}
  return true
 }
 async function temporary(){
  if(typeof wxApi.downloadFile!=='function')throw problem('pdf_storage_full','本机空间不足，请清理下载缓存后重试。')
  try{onTemporary()}catch{}phase('downloading',0,record.total);progress(0,record.total)
  const result=await new Promise((resolve,reject)=>{
   let settled=false;const finish=(fn,value)=>{if(settled)return;settled=true;task=null;rejectRequest=null;fn(value)}
   rejectRequest=e=>finish(reject,e)
   try{task=wxApi.downloadFile({url,timeout:180000,success:r=>finish(resolve,r),fail:()=>finish(reject,problem('pdf_network','临时预览下载中断，请重试。'))});task?.onProgressUpdate?.(r=>{if(!settled&&!stopped)progress(Number(r.totalBytesWritten)||0,Number(r.totalBytesExpectedToWrite)||record.total)})}catch{finish(reject,problem('pdf_storage_full','临时文件未能准备，请重试。'))}
  })
  check();const p=String(result.tempFilePath||result.filePath||'')
  if(Number(result.statusCode)!==200||!p)throw problem('pdf_integrity','临时 PDF 校验失败，请重新下载。')
  phase('verifying',record.total,record.total)
  if(!await verify({path:p,total:record.total}))throw problem('pdf_integrity','临时 PDF 校验失败，请重新下载。')
  check();progress(record.total,record.total);return p
 }
 let record=registry().find(x=>x.key===key),restarts=0
 const reservations=new Set(),reserve=p=>{if(p&&!reservations.has(p)){reservations.add(p);active.set(p,(active.get(p)||0)+1)}}
 reserve(record?.path)
 async function run(){
  try{
   check()
   phase('connecting',record?.offset||0,record?.total||expectedBytes||0)
   if(record&&size(record.path)!==record.offset){forget(record);record=null}
   if(record?.offset===record?.total&&record){phase('verifying',record.total,record.total);if(await verify(record)){check();put({...record,used:Date.now()});progress(record.total,record.total);return record.path}forget(record);record=null;phase('connecting',0,expectedBytes||0)}
   const probe=await segment(0,4);check()
   if(String.fromCharCode(...probe.data)!=='%PDF-')throw problem('pdf_integrity','下载内容不是完整 PDF。')
   if(record&&(record.etag!==probe.etag||record.total!==probe.total)){forget(record);record=null}
   if(!record){
    const dir=folder+'/pdf-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)
    try{fs.mkdirSync(dir,true)}catch{fs.accessSync(dir)}
    record={schema:1,key,url,owner,version,path:dir+'/'+fileName,offset:0,total:probe.total,etag:probe.etag,used:Date.now()}
    reserve(record.path)
    await releaseSpace();await call('writeFile',{filePath:record.path,data:binary(probe.data)});record.offset=5;put(record)
   }
   phase('downloading',record.offset,record.total);progress(record.offset,record.total)
   while(record.offset<record.total){
    check();const start=record.offset,end=Math.min(start+chunkBytes-1,record.total-1),part=await segment(start,end,record.total,record.etag);check()
    await call('appendFile',{filePath:record.path,data:binary(part.data)});record.offset=start+part.data.length
    if(size(record.path)!==record.offset)throw problem('pdf_checkpoint','已保存的文件进度无效，请重新下载。')
    put({...record,used:Date.now()});check();progress(record.offset,record.total)
   }
   phase('verifying',record.total,record.total)
   if(!await verify(record))throw problem('pdf_integrity','PDF 完整性校验失败，请重新下载。')
   check();return record.path
  }catch(error){
   if(error?.code==='pdf_storage_full'&&record)return temporary()
   if(record&&record.offset===0){await unlink(record.path);record=null}
   if(['pdf_source_changed','pdf_invalid_range','pdf_checkpoint','pdf_integrity'].includes(error?.code)){forget(record);record=null;if(error.code==='pdf_source_changed'&&restarts++===0&&!stopped)return run()}
   throw error
  }
 }
 hard=setTimeout(()=>{stopped=true;rejectRequest?.(problem('pdf_timeout','下载等待超时，已保存的分段可继续下载。'));task?.abort?.()},300000)
 const promise=run().finally(()=>{clearTimeout(hard);for(const p of reservations){const count=(active.get(p)||1)-1;if(count)active.set(p,count);else active.delete(p)}})
 return{promise,release(){if(stopped)return;stopped=true;const active=task;rejectRequest?.(problem('pdf_cancelled','已暂停下载。'));active?.abort?.()},invalidate(){forget(record)}}
}
module.exports={acquirePdf,reclaimCompletedPublicPdfs,REGISTRY}
