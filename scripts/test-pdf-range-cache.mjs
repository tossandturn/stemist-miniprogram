import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const source=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(390000,42),Buffer.from('\n%%EOF')])
const digest=b=>crypto.createHash('sha256').update(b).digest('hex')
const URL='https://stem.ieltsist.com/api/stem/curriculum-papers/files/file-'+ 'a'.repeat(32)
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))

function harness({data=source,failAt=-1,damage=false}={}){
 const files=new Map(),storage=new Map(),requests=[],opens=[],states=[],phases=[]
 let calls=0,errorAt=failAt,changedData=data,badRange=false,badEtag=false,writesFail=false
 const manager={
  mkdirSync(){},accessSync(p){if(!files.has(p))throw Error('not found')},statSync(p){if(!files.has(p))throw Error('not found');return{size:files.get(p).length}},
  writeFile(o){if(writesFail)return queueMicrotask(()=>o.fail());files.set(o.filePath,Buffer.from(o.data));queueMicrotask(()=>o.success())},
  appendFile(o){if(writesFail)return queueMicrotask(()=>o.fail());files.set(o.filePath,Buffer.concat([files.get(o.filePath),Buffer.from(o.data)]));queueMicrotask(()=>o.success())},
  readFile(o){const b=files.get(o.filePath);if(!b)return queueMicrotask(()=>o.fail());let part=b.subarray(o.position||0,(o.position||0)+(o.length||b.length));if(damage&&o.position>5)part=Buffer.alloc(part.length,9);queueMicrotask(()=>o.success({data:part.buffer.slice(part.byteOffset,part.byteOffset+part.length)}))},
  unlink(o){files.delete(o.filePath);o.success?.()},
 }
 const wx={env:{USER_DATA_PATH:'/user'},getFileSystemManager:()=>manager,getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),request(o){
  const m=/^bytes=(\d+)-(\d+)$/.exec(o.header.Range);assert.ok(m,'all native PDF requests must have a finite end');const start=Number(m[1]),end=Number(m[2]);assert.ok(end-start+1<=128*1024)
  requests.push({start,end,etag:o.header['If-Range']||''});const at=calls++,task={aborted:false,abort(){this.aborted=true}}
  setImmediate(()=>{if(task.aborted)return o.fail({errMsg:'abort'});if(errorAt>=0&&at>=errorAt)return o.fail({errMsg:'request:fail timeout'});const body=changedData.subarray(start,end+1);o.success({statusCode:206,header:{'Content-Type':'application/pdf','Content-Length':String(body.length),'Content-Range':'bytes '+(badRange?start+1:start)+'-'+end+'/'+changedData.length,ETag:'"'+(badEtag?'wrong':digest(changedData))+'"'},data:body.buffer.slice(body.byteOffset,body.byteOffset+body.length)})});return task
 },openDocument(o){opens.push(o);o.success()}}
 storage.set('stemistUser',{id:'student-1'});storage.set('stemistPrivacyEpoch',1)
 const r=miniRuntime({wx,globals:{setTimeout:(fn,ms)=>setTimeout(fn,ms===350||ms===900?0:ms)}}),module=r.load('utils/pdfRangeCache')
 const acquire=(extra={})=>module.acquirePdf({wxApi:wx,url:URL,owner:'student-1|1',version:'v1',fileName:'IB_Math_AA_2025_QP.pdf',expectedBytes:changedData.length,expectedSha256:digest(changedData),onProgress:(n,total)=>states.push({n,total}),onPhase:(phase,n,total)=>phases.push({phase,n,total}),...extra})
 return{acquire,module,wx,files,storage,requests,states,phases,opens,r,setFail:v=>errorAt=v,setData:v=>changedData=v,setBadRange:v=>badRange=v,setBadEtag:v=>badEtag=v,setStorageFailure:v=>writesFail=v}
}

{
 const r=miniRuntime(),{createSha256}=r.load('utils/sha256')
 for(const size of [0,1,55,56,63,64,65,8193,390000]){const b=crypto.randomBytes(size),hash=createSha256();for(let at=0;at<size;at+=31)hash.update(new Uint8Array(b.subarray(at,at+31)));assert.equal(hash.digest(),digest(b))}
}
{
 const h=harness({failAt:2}),first=h.acquire();await assert.rejects(first.promise,error=>error.code==='pdf_network');first.release()
 const record=h.storage.get(h.module.REGISTRY)[0],savedOffset=record.offset;assert.equal(savedOffset,128*1024+5);assert.equal(h.files.get(record.path).length,savedOffset)
 const attempts=h.requests.length;h.setFail(-1);const next=h.acquire(),path=await next.promise;assert.equal(h.requests[attempts].start,0,'retry probes source version');assert.equal(h.requests[attempts+1].start,savedOffset,'retry starts at the saved byte, not at zero');assert.deepEqual(h.files.get(path),source);next.release()
 assert.ok(h.phases.some(item=>item.phase==='connecting'));assert.ok(h.phases.some(item=>item.phase==='downloading'&&item.n===savedOffset),'resume reports its durable offset without treating it as new bytes');assert.ok(h.phases.some(item=>item.phase==='verifying'&&item.n===source.length),'integrity validation is a distinct phase')
 const count=h.requests.length,cache=h.acquire();assert.equal(await cache.promise,path);assert.equal(h.requests.length,count,'verified complete files survive controller recreation');cache.release()
}
{
 const h=harness({failAt:2});await assert.rejects(h.acquire().promise);const alternate=Buffer.from(source);alternate[30]=7;h.setData(alternate);const attempts=h.requests.length;h.setFail(-1)
 const path=await h.acquire().promise;assert.deepEqual(h.files.get(path),alternate);assert.equal(h.requests[attempts+1].start,5,'a changed ETag safely restarts before appending new data')
}
{
 const h=harness();h.setBadRange(true);await assert.rejects(h.acquire().promise,e=>e.code==='pdf_invalid_range');assert.equal(h.files.size,0)
 const bad=harness({damage:true});await assert.rejects(bad.acquire().promise,e=>e.code==='pdf_integrity');assert.equal(bad.files.size,0,'a digest mismatch cannot open or poison the cache')
 const full=harness();full.setStorageFailure(true);await assert.rejects(full.acquire().promise,e=>e.code==='pdf_storage')
}
{
 const h=harness(),handle=h.acquire();handle.release();await assert.rejects(handle.promise,e=>e.code==='pdf_cancelled'||e.code==='pdf_network');assert.equal(h.states.at(-1)?.n||0,0)
 const owner=harness({failAt:2});await assert.rejects(owner.acquire().promise);const attempts=owner.requests.length;owner.setFail(-1);const old=owner.storage.get(owner.module.REGISTRY)[0];const next=owner.acquire({owner:'student-2|2'}),path=await next.promise;assert.notEqual(path,old.path,'different owners have independent file paths');assert.equal(owner.requests[attempts+1].start,5)
}
{
 const h=harness({failAt:2}),{createPdfDownloadController}=h.r.load('utils/pdfDownload')
 let state;const timeline=[];const c=createPdfDownloadController({wxApi:h.wx,onState:s=>{state=s;timeline.push({...s})}});c.setScope('ap')
 const req={url:URL,scope:'ap',fileName:'AP_Test_QP.pdf',cacheVersion:'source',expectedBytes:source.length,sha256:digest(source),ownerKey:'ap:qp',itemId:'ap',label:'原卷'}
 await c.open(req);await wait(60);assert.equal(state.phase,'error');assert.ok(state.downloadedBytes>0);assert.match(state.error,/已保存/)
 h.setFail(-1);await c.retry();await wait(100);assert.equal(state.phase,'opened');assert.equal(h.opens.length,1);assert.deepEqual(h.files.get(h.opens[0].filePath),source)
 const verifying=timeline.filter(item=>item.phase==='verifying');assert.ok(verifying.length);assert.ok(verifying.every(item=>item.percent===null||item.percent<=99));assert.ok(verifying.every(item=>!item.speedLabel&&!item.remainingLabel),'verification never displays stale download estimates or 100%')
 c.dispose()
}
{
 const h=harness({failAt:2});let network,state
 h.wx.onNetworkStatusChange=fn=>network=fn;h.wx.offNetworkStatusChange=fn=>{if(network===fn)network=null}
 const {createPdfDownloadController}=h.r.load('utils/pdfDownload'),c=createPdfDownloadController({wxApi:h.wx,onState:s=>state=s})
 c.setScope('ib');const req={url:URL,scope:'ib',fileName:'IB_Physics_QP.pdf',cacheVersion:'source',expectedBytes:source.length,sha256:digest(source),ownerKey:'ib:qp',itemId:'ib'}
 await c.open(req);await wait(60);assert.equal(state.phase,'error');h.setFail(-1);network({isConnected:true});await wait(100);assert.equal(state.phase,'opened','restored network continues the saved download')
 c.dispose();assert.equal(network,null)
 const hidden=harness(),d=hidden.r.load('utils/pdfDownload').createPdfDownloadController({wxApi:hidden.wx,onState:s=>state=s});d.setScope('ib')
 await d.open(req);d.suspend();assert.equal(state.phase,'paused');d.resume();await wait(100);assert.equal(state.phase,'opened','returning from background resumes the same download');d.dispose()
 const manual=harness(),e=manual.r.load('utils/pdfDownload').createPdfDownloadController({wxApi:manual.wx,onState:s=>state=s});e.setScope('ib');await e.open(req);e.cancel();const count=manual.requests.length;e.resume();await wait(30);assert.equal(manual.requests.length,count,'explicit cancellation is not automatically restarted');e.dispose()
}
{
 const h=harness(),base=h.wx.request;let rejected=0
 h.wx.request=o=>{const m=/bytes=(\d+)-(\d+)/.exec(o.header.Range);if(Number(m[2])-Number(m[1])+1>32*1024){rejected++;setImmediate(()=>o.fail({errMsg:'timeout'}));return{abort(){}}}return base(o)}
 const handle=h.acquire(),p=await handle.promise;assert.equal(rejected,2);assert.deepEqual(h.files.get(p),source);assert.ok(h.requests.slice(1).every(r=>r.end-r.start+1<=32*1024),'slow links retain the smaller successful chunk size');handle.release()
 const refresh=harness(),{createPdfDownloadController}=refresh.r.load('utils/pdfDownload');let state
 const controller=createPdfDownloadController({wxApi:refresh.wx,onState:s=>state=s});controller.setScope('renew')
 await controller.open({url:URL,scope:'renew',fileName:'AP_Renew_QP.pdf',expectedBytes:source.length,sha256:digest(source),cacheVersion:'same-source'})
 refresh.storage.set('stemistSessionToken','renewed-same-owner-token');await wait(100);assert.equal(state.phase,'opened','same-owner session renewal does not abort a public download');controller.dispose()
}
console.log('Native PDF: bounded chunks, persisted resume, ETag restart, exact ranges, SHA-256, storage/cancel failures, account isolation and controller opening passed.')
{
 const h=harness(),manager=h.wx.getFileSystemManager(),oldPath='/user/pdf-cache/pdf-old/old.pdf',studentPath='/user/native-writing/student.jpg'
 h.files.set(oldPath,Buffer.from(source));h.files.set(studentPath,Buffer.alloc(100000,8))
 h.storage.set(h.module.REGISTRY,[{schema:1,key:'older-file',owner:'student-1|1',url:URL,version:'older',path:oldPath,total:source.length,offset:source.length,etag:'"'+digest(source)+'"',used:1}])
 let quotaErrors=0
 for(const name of ['writeFile','appendFile']){const original=manager[name];manager[name]=o=>{const occupied=[...h.files.values()].reduce((n,b)=>n+b.length,0),extra=o.data.byteLength-(name==='writeFile'?(h.files.get(o.filePath)?.length||0):0);if(occupied+extra>550000){quotaErrors++;queueMicrotask(()=>o.fail({errMsg:'appendFile:fail exceed the maximum size of the file storage limit'}));return}original(o)}}
 const path=await h.acquire().promise
 assert.ok(quotaErrors>0);assert.deepEqual(h.files.get(path),source);assert.equal(h.files.has(oldPath),false,'storage pressure evicts only old public PDF cache')
 assert.deepEqual(h.files.get(studentPath),Buffer.alloc(100000,8),'student photos are never reclaimed as cache')
}
{
 const h=harness(),manager=h.wx.getFileSystemManager(),student='/user/native-writing/student.jpg';h.files.set(student,Buffer.alloc(400000,7));let temporary=0
 for(const name of ['writeFile','appendFile']){const original=manager[name];manager[name]=o=>{const used=[...h.files].filter(([p])=>p.startsWith('/user/')).reduce((n,[,b])=>n+b.length,0);if(used+o.data.byteLength>550000){queueMicrotask(()=>o.fail({errMsg:'file storage limit exceeded'}));return}original(o)}}
 h.wx.downloadFile=o=>{temporary++;setImmediate(()=>{h.files.set('/tmp/native-pdf.pdf',Buffer.from(source));o.success({statusCode:200,tempFilePath:'/tmp/native-pdf.pdf'})});return{abort(){},onProgressUpdate(){}}}
 const p=await h.acquire().promise;assert.equal(p,'/tmp/native-pdf.pdf');assert.equal(temporary,1);assert.deepEqual(h.files.get(p),source)
 assert.ok(h.phases.some(item=>item.phase==='verifying'),'temporary previews are validated before completion')
 assert.deepEqual(h.files.get(student),Buffer.alloc(400000,7));assert.ok(h.storage.get(h.module.REGISTRY)[0].offset<source.length,'temporary preview never claims a durable complete checkpoint')
}
