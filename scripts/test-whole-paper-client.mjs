import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime, deferred, settle } from './helpers/mini-runtime.mjs'

const clone = value => JSON.parse(JSON.stringify(value))
const markingTemplate=fs.readFileSync(new URL('../bundles/marking/index.wxml',import.meta.url),'utf8')
const markingStyles=fs.readFileSync(new URL('../bundles/marking/index.wxss',import.meta.url),'utf8')
assert.doesNotMatch(markingTemplate,/需要人工复核|需人工复核|标注待复核/,'AI marking must not present human review as the final workflow step')
assert.match(markingTemplate,/AI 自动完成批改/)
assert.match(markingTemplate,/wx:if="{{selectionError}}"[^>]*role="alert"/,'File-selection failures must be announced beside the picker')
for(const id of ['marking-flow','marking-picker','marking-primary-action','marking-submit-primary','marking-optional-toggle','marking-optional-fields','marking-job-state','marking-report','marking-history'])assert.match(markingTemplate,new RegExp(`id="${id}"`),`Stable UI QA hook ${id} must remain available`)
const pickerPosition=markingTemplate.indexOf('id="marking-picker"'),actionPosition=markingTemplate.indexOf('id="marking-primary-action"'),optionalPosition=markingTemplate.indexOf('id="marking-optional-toggle"')
assert.ok(pickerPosition<actionPosition&&actionPosition<optionalPosition,'Selection summary and primary submit must precede optional reference fields')
assert.match(markingTemplate,/请先选择 1 份作答 PDF 或 1–20 张图片/,'Disabled submit explains exactly what is missing')
assert.match(markingTemplate,/<privacy-consent[^>]*button-text="同意隐私授权"/,'Privacy authorization stays adjacent to the picker with one explicit native action')
assert.match(markingStyles,/\.device-phone[^}]*\.marking-primary-action\s*\{[^}]*position:\s*fixed/s,'Phone primary action stays above the fixed app navigation')
assert.match(markingStyles,/bottom:\s*calc\(80px \+ env\(safe-area-inset-bottom\)\)/)
assert.match(markingTemplate,/marking-page[^\n]*jobId[^\n]*has-job/,'Current jobs expose a class for phone-first status ordering')
assert.match(markingStyles,/#marking-submit-primary\[disabled\]\{[^}]*background:#e4ddf7;[^}]*color:#5b4a7c;[^}]*opacity:1/s,'Disabled primary action remains legible without losing disabled semantics')
assert.match(markingStyles,/\.device-phone\.has-job \.marking-output\{grid-row:1\}/)
assert.match(markingStyles,/\.device-phone\.has-job \.marking-inputs\{grid-row:2\}/)
assert.match(markingTemplate,/id="marking-flow"[^>]*aria-label="[^"]*{{flowStep}}/,'Flow exposes the current step to assistive technology')
assert.match(markingTemplate,/id="marking-job-state"[^>]*role="status"[^>]*aria-label=/,'Current queue/report state is announced programmatically')
assert.match(markingTemplate,/job-actions[\s\S]*?wx:if="{{reportAvailable}}"[^>]*data-kind="report"[^>]*>下载批改报告/,'Completed status card includes a direct report shortcut')
assert.doesNotMatch(markingTemplate,/队列第|预计[^<]*(分钟|完成)/,'UI must not invent queue rank or completion time')
const pdf = Uint8Array.from(Buffer.from('%PDF-1.7\nfixture')).buffer
const jpg = Uint8Array.from([255,216,255,224,1,2]).buffer
const input = (id='file-answer1', role='answer', mediaType='image/jpeg') => ({id, role, mediaType, kind:mediaType==='application/pdf'?'pdf':'image', path:'/tmp/'+id, name:id+(mediaType==='application/pdf'?'.pdf':'.jpg'), size:mediaType==='application/pdf'?pdf.byteLength:jpg.byteLength})
const jobId='job-fixture-123'
const feedbackOnly={assessmentMode:'ai-advisory-unscored',officialScore:false,summary:'done',questionResults:[{questionLabel:'1',rationale:'Visible answer reviewed.',evidence:['Answer page 1'],provisionalScore:null,maxScore:null,reviewRequired:true}]}
function serviceRuntime() {
  let json = async () => ({}), bytes=jpg, size=jpg.byteLength, reads=0,readFailure=false, request, download
  const removed=[],copies=[]
  const r=miniRuntime({
    wx:{env:{USER_DATA_PATH:'/app'},getFileSystemManager:()=>({
      getFileInfo:opts=>opts.success({size}),readFile:opts=>{reads++;if(readFailure)opts.fail?.({errMsg:'fixture expired'});else opts.success({data:bytes})},
      mkdirSync(){},accessSync(){},copyFile:opts=>{copies.push([opts.srcPath,opts.destPath]);opts.success?.({})},unlink:opts=>{removed.push(opts.filePath);opts.success?.({})},
    }),request:opts=>{request=opts;return{abort(){opts.fail({errMsg:'abort'})}}},downloadFile:opts=>{download=opts}},
    modules:{'utils/api':{requestJson:(...args)=>json(...args),safeErrorMessage:(_,status)=>'failed '+status},
      'utils/nativeSession':{refreshNativeSession:async()=>{}},
      'utils/session':{clearLocalSession:()=>{r.storage.delete('stemistUser');r.storage.delete('stemistSessionToken')}},
    },
  })
  r.storage.set('stemistUser',{id:'student-a'});r.storage.set('stemistSessionToken','fixture-token')
  return{...r,api:r.load('bundles/marking/service'),removed,copies,setJson:fn=>{json=fn},setBytes:b=>{bytes=b;size=b.byteLength},setSize:n=>{size=n},setReadFailure:value=>{readFailure=value},get reads(){return reads},get request(){return request},get download(){return download}}
}

const r=serviceRuntime(), api=r.api, s=api.scope()
const persistedImage=await api.inspect(input(),s)
assert.equal(persistedImage.mediaType,'image/jpeg')
assert.match(persistedImage.path,/^\/app\/whole-paper-inputs\/paper-[a-z0-9-]+\.jpg$/)
assert.deepEqual(r.copies[0],[input().path,persistedImage.path],'Inspection stores an app-owned resumable copy without moving the picker source')
r.setBytes(pdf);const persistedPdf=await api.inspect(input('file-pdf123','answer','application/pdf'),s)
assert.equal(persistedPdf.mediaType,'application/pdf')
assert.match(persistedPdf.path,/^\/app\/whole-paper-inputs\/paper-[a-z0-9-]+\.pdf$/)
await api.releaseFiles([persistedPdf],[persistedPdf],s)
assert.ok(!r.removed.includes(persistedPdf.path),'Cleanup cannot delete a file while a draft still references it')
await api.releaseFiles([persistedPdf],[],s)
assert.ok(r.removed.includes(persistedPdf.path),'Cleanup deletes only a registered app-owned copy after its draft releases it')
assert.ok(!r.removed.includes(input('file-pdf123','answer','application/pdf').path),'Cleanup never deletes the original picker file')
await api.releaseFiles([persistedImage],[],{owner:s.owner,epoch:s.epoch+1})
assert.ok(!r.removed.includes(persistedImage.path),'A newer privacy epoch cannot delete a copy registered to the previous epoch')
const bounded=serviceRuntime(),boundedScope=bounded.api.scope()
bounded.storage.set('stemistWholePaperFiles',Array.from({length:80},(_,index)=>({path:'/app/whole-paper-inputs/paper-old-'+index+'.jpg',owner:'student-'+index,epoch:0,size:1,savedAt:index+1})))
await assert.rejects(()=>bounded.api.inspect(input('file-bounded1'),boundedScope),/暂存.*过多/,'Multi-account draft copies are bounded instead of accumulating without limit')
assert.equal(bounded.copies.length,0,'The local copy limit fails before allocating another private input')

let emptyRootCopies=0
const emptyRoot=miniRuntime({wx:{env:{USER_DATA_PATH:''},getFileSystemManager:()=>({mkdirSync(){},accessSync(){},copyFile(){emptyRootCopies++}})}})
emptyRoot.storage.set('stemistUser',{id:'student-a'});emptyRoot.storage.set('stemistPrivacyEpoch',0)
await assert.rejects(()=>emptyRoot.load('bundles/marking/files').persistWholePaperFile('/tmp/no-root.jpg','image/jpeg',6,{owner:'student-a',epoch:0}),/目录不可用/)
assert.equal(emptyRootCopies,0,'An empty USER_DATA_PATH fails closed before copying')

let logoutCopy
const logoutUnlinks=[]
const logoutRace=miniRuntime({wx:{env:{USER_DATA_PATH:'/app'},getFileSystemManager:()=>({
  mkdirSync(){},accessSync(){},copyFile:options=>{logoutCopy=options},unlink:options=>{logoutUnlinks.push(options.filePath);options.success?.({})},
})}})
logoutRace.storage.set('stemistUser',{id:'student-a'});logoutRace.storage.set('stemistPrivacyEpoch',0)
const logoutHelper=logoutRace.load('bundles/marking/files'),logoutScope={owner:'student-a',epoch:0}
const logoutPending=logoutHelper.persistWholePaperFile('/tmp/logout-race.jpg','image/jpeg',6,logoutScope);await settle()
logoutRace.storage.delete('stemistUser');logoutRace.storage.set('stemistPrivacyEpoch',1);logoutRace.storage.delete('stemistWholePaperFiles')
logoutCopy.success({})
await assert.rejects(()=>logoutPending,/账号.*变化/,'A copy finishing after logout cannot resurrect its old registry record')
assert.equal(logoutRace.storage.get('stemistWholePaperFiles'),undefined)
assert.equal(logoutUnlinks.length,1,'The one just-copied stale-scope file is removed without touching old snapshots')

let releaseUnlink
const parallelRace=miniRuntime({wx:{env:{USER_DATA_PATH:'/app'},getFileSystemManager:()=>({
  mkdirSync(){},accessSync(){},copyFile:options=>options.success?.({}),unlink:options=>{releaseUnlink=options},
})}})
parallelRace.storage.set('stemistUser',{id:'student-a'});parallelRace.storage.set('stemistPrivacyEpoch',0)
const oldRecord={path:'/app/whole-paper-inputs/paper-old-release.jpg',owner:'student-a',epoch:0,size:6,savedAt:1}
parallelRace.storage.set('stemistWholePaperFiles',[oldRecord])
const parallelHelper=parallelRace.load('bundles/marking/files'),parallelScope={owner:'student-a',epoch:0}
const releasing=parallelHelper.releaseWholePaperFiles([oldRecord],[],parallelScope);await settle()
const parallelNewPath=await parallelHelper.persistWholePaperFile('/tmp/new-during-release.jpg','image/jpeg',6,parallelScope)
releaseUnlink.success({});await releasing
assert.deepEqual(clone(parallelRace.storage.get('stemistWholePaperFiles').map(record=>record.path)),[parallelNewPath],'Release re-reads the registry and cannot overwrite a concurrently persisted copy')
await assert.rejects(()=>api.inspect(input(),s),/格式/)
r.setSize(11*1024*1024);const reads=r.reads
await assert.rejects(()=>api.inspect(input('file-pdf123','answer','application/pdf'),s),/10 MB/)
assert.equal(r.reads,reads,'Oversize selection must fail before reading into memory')
r.setBytes(jpg)
assert.throws(()=>api.validateFiles([]),/作答/)
assert.throws(()=>api.validateFiles([input(),input('file-pdf123','answer','application/pdf')]),/作答/)
assert.throws(()=>api.validateFiles(Array.from({length:21},(_,i)=>input('file-'+i))),/作答/)
assert.throws(()=>api.validateFiles([input(),input('file-ref123','mark-scheme')]),/评分标准/)
assert.throws(()=>api.validateFiles([{...input(),size:NaN}]),/无效/)
assert.throws(()=>api.validateFiles([{...input(),role:'admin'}]),/无效/)
api.validateFiles([input(),input('file-ref123','mark-scheme','application/pdf')])
const draft={clientRequestId:'request-fixture',files:[input('file-first1'),input('file-second2')]}
let createBody
r.setJson(async(_path,body)=>{createBody=body;return {jobId,status:'draft',assets:body.files.map((f,i)=>({clientAssetId:f.clientAssetId,assetId:'asset-fixture'+i}))}})
await api.create(draft,s)
assert.deepEqual(clone(createBody.files.map(f=>[f.clientAssetId,f.order])),[['file-first1',1],['file-second2',2]])
r.setJson(async()=>({jobId,assets:[]}));await assert.rejects(()=>api.create(draft,s),/完整/)
const f={...input(),assetId:'asset-answer1'}
const control={cancelled:()=>false}
const uploading=api.upload(jobId,f,s,control);await settle()
assert.equal(r.request.method,'PUT');assert.equal(r.request.data.byteLength,jpg.byteLength)
assert.equal(r.request.header['Content-Type'],'image/jpeg')
assert.equal(r.request.header.Authorization,'Bearer fixture-token')
r.request.success({statusCode:200,data:{assetId:f.assetId,status:'uploaded'}});await uploading
const interrupted=api.upload(jobId,f,s,control);await settle();control.task.abort()
await assert.rejects(()=>interrupted,/已上传文件保留/)
const localGone=serviceRuntime(),localGoneScope=localGone.api.scope(),localGoneFile={...input('file-local-gone1'),assetId:'asset-local-gone1'}
localGone.setReadFailure(true)
await assert.rejects(()=>localGone.api.upload(jobId,localGoneFile,localGoneScope,{cancelled:()=>false}),/新建另一份批改/,'A legacy draft whose local read fails gives the only recovery action the locked draft actually supports')
const expired=api.upload(jobId,f,s,control);await settle();r.request.success({statusCode:401,data:{}})
await assert.rejects(()=>expired);assert.equal(api.current(s),false)

const arrayBuffer=value=>{const bytes=value instanceof Uint8Array?value:new Uint8Array(value);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}
function reportDownloadRuntime({deferWrite=false,deferAppend=false,deferFileInfo=false,deferRead=false}={}){
  const files=new Map(),requests=[],removed=[],pendingWrites=[],pendingAppends=[],pendingFileInfo=[],pendingReads=[]
  const r=miniRuntime({
    wx:{env:{USER_DATA_PATH:'/app'},getFileSystemManager:()=>({
      mkdirSync(){},accessSync(){},
      getFileInfo:options=>{const inspect=()=>files.has(options.filePath)?options.success({size:files.get(options.filePath).byteLength}):options.fail?.({errMsg:'not found'});if(deferFileInfo)pendingFileInfo.push(inspect);else inspect()},
      writeFile:options=>{const write=()=>{files.set(options.filePath,new Uint8Array(arrayBuffer(options.data)));options.success?.({})};if(deferWrite)pendingWrites.push({filePath:options.filePath,run:write});else write()},
      appendFile:options=>{const append=()=>{const before=files.get(options.filePath)||new Uint8Array();const addition=new Uint8Array(arrayBuffer(options.data));const next=new Uint8Array(before.byteLength+addition.byteLength);next.set(before);next.set(addition,before.byteLength);files.set(options.filePath,next);options.success?.({})};if(deferAppend)pendingAppends.push(append);else append()},
      readFile:options=>{const read=()=>{const value=files.get(options.filePath);if(!value)return options.fail?.({errMsg:'not found'});const start=Number(options.position)||0,end=options.length===undefined?value.byteLength:start+Number(options.length);options.success({data:arrayBuffer(value.slice(start,end))})};if(deferRead)pendingReads.push(read);else read()},
      unlink:options=>{removed.push(options.filePath);files.delete(options.filePath);options.success?.({})},
    }),request:options=>{const item={options,aborted:false};requests.push(item);return{abort(){if(item.aborted)return;item.aborted=true;options.fail?.({errMsg:'request:fail abort'})}}}},
    modules:{'utils/api':{requestJson:async()=>({}),safeErrorMessage:(_,status)=>'failed '+status},'utils/nativeSession':{refreshNativeSession:async()=>{}},'utils/session':{clearLocalSession:()=>{r.storage.delete('stemistUser');r.storage.delete('stemistSessionToken')}}},
  })
  r.storage.set('stemistUser',{id:'student-a'});r.storage.set('stemistSessionToken','fixture-token')
  return{...r,api:r.load('bundles/marking/service'),files,requests,removed,pendingWrites,flushWrite:(index=0)=>pendingWrites.splice(index,1)[0]?.run(),flushAppend:()=>pendingAppends.shift()?.(),flushFileInfo:()=>pendingFileInfo.shift()?.(),flushRead:()=>pendingReads.shift()?.()}
}
function answerRange(item,bytes,etag='"fixture-v1"',overrides={}){
  const match=String(item.options.header.Range||'').match(/^bytes=(\d+)-(\d+)$/)
  assert.ok(match,'Every report request must be a bounded byte range')
  const start=Number(match[1]),requestedEnd=Number(match[2]),end=Math.min(requestedEnd,bytes.byteLength-1),data=bytes.slice(start,end+1)
  item.options.success({statusCode:overrides.statusCode??206,data:arrayBuffer(overrides.data||data),header:{'Content-Type':'application/pdf','Content-Range':overrides.contentRange||`bytes ${start}-${end}/${overrides.total||bytes.byteLength}`,'Content-Length':String((overrides.data||data).byteLength),ETag:overrides.etag||etag,...overrides.header}})
}

const reportBytes=new Uint8Array(70_000);reportBytes.set(Buffer.from('%PDF-1.7\n'));reportBytes.fill(65,9)
const ownerGuard=reportDownloadRuntime(),ownerGuardScope=ownerGuard.api.scope();let ownerGuardTask
const ownerGuardFirst=ownerGuard.api.download('job-owner-guard','report',ownerGuardScope,'Owner guard',{onTask:value=>{ownerGuardTask=value}});await settle()
const ownerGuardSecond=ownerGuard.api.download('job-owner-other','source',ownerGuardScope,'Owner other').then(()=>null,error=>error);await settle()
assert.equal(ownerGuard.requests.length,1,'Two marking pages for the same owner cannot start competing range sequences')
assert.equal((await ownerGuardSecond)?.code,'download_busy')
ownerGuardTask.abort();await assert.rejects(()=>ownerGuardFirst,/已暂停/)
let ownerGuardRetryTask;const ownerGuardRetry=ownerGuard.api.download('job-owner-other','source',ownerGuardScope,'Owner other',{onTask:value=>{ownerGuardRetryTask=value}});await settle();assert.equal(ownerGuard.requests.length,2,'The owner lock is released after the first download settles');ownerGuardRetryTask.abort();await assert.rejects(()=>ownerGuardRetry,/已暂停/)

const registryRace=reportDownloadRuntime({deferWrite:true}),registryScopeA=registryRace.api.scope();let registryTaskA
const registryOld=registryRace.api.download('job-registry-old','report',registryScopeA,'Old owner',{onTask:value=>{registryTaskA=value}});await settle();answerRange(registryRace.requests[0],reportBytes,'"registry-a"');await settle()
assert.equal(registryRace.pendingWrites.length,1);const registryOldPath=registryRace.pendingWrites[0].filePath
registryRace.storage.set('stemistUser',{id:'student-b'});const registryScopeB=registryRace.api.scope();let registryTaskB
const registryNew=registryRace.api.download('job-registry-new','report',registryScopeB,'New owner',{onTask:value=>{registryTaskB=value}});await settle();answerRange(registryRace.requests[1],reportBytes,'"registry-b"');await settle();assert.equal(registryRace.pendingWrites.length,2)
registryRace.flushWrite(1);await settle();const registryMetaB=registryRace.storage.get('stemistDraft:whole-paper-download:student-b');assert.ok(registryMetaB?.filePath);registryTaskB.abort();await assert.rejects(()=>registryNew,/已暂停/)
registryRace.flushWrite(0);await assert.rejects(()=>registryOld,/账号/)
assert.deepEqual(clone(registryRace.storage.get('stemistPaperReports')),[registryMetaB.filePath],'Late old-owner write cleanup removes only its exact path and preserves the newer registry entry')
assert.equal(registryRace.files.has(registryOldPath),false);assert.equal(registryRace.storage.get('stemistDraft:whole-paper-download:student-a'),undefined)

const d=reportDownloadRuntime(),ds=d.api.scope(),progress=[];let taskControl
const downloading=d.api.download(jobId,'report',ds,'Fixture report',{onProgress:value=>progress.push(value),onTask:value=>{taskControl=value},cancelled:()=>false})
await settle();assert.equal(d.requests[0].options.url,'https://stem.ieltsist.com/api/stem/paper-marking-jobs/job-fixture-123/report.pdf');assert.doesNotMatch(d.requests[0].options.url,/token|fixture-token/);assert.equal(d.requests[0].options.header.Range,'bytes=0-0');assert.equal(d.requests[0].options.timeout,30_000);assert.equal(d.requests[0].options.responseType,'arraybuffer');assert.equal(typeof taskControl.abort,'function')
answerRange(d.requests[0],reportBytes);await settle()
assert.equal(d.requests[1].options.header.Range,'bytes=1-65536');assert.equal(d.requests[1].options.header['If-Range'],'"fixture-v1"')
answerRange(d.requests[1],reportBytes);await settle();assert.equal(d.requests[2].options.header.Range,'bytes=65537-69999')
answerRange(d.requests[2],reportBytes);const firstPath=await downloading
assert.deepEqual(d.files.get(firstPath),reportBytes)
assert.ok(progress.slice(0,-1).every(item=>item.percent<100&&item.complete!==true),'Chunk progress cannot claim completion before PDF validation')
assert.equal(progress.at(-1).percent,100);assert.equal(progress.at(-1).complete,true)
assert.ok(d.storage.get('stemistPaperReports').includes(firstPath))
const requestCountBeforeCache=d.requests.length
const cached=d.api.download(jobId,'report',ds,'Fixture report');await settle();answerRange(d.requests.at(-1),reportBytes)
assert.equal(await cached,firstPath);assert.equal(d.requests.length,requestCountBeforeCache+1,'A matching ETag reuses the verified local PDF after one-byte validation')

const writeRace=reportDownloadRuntime({deferAppend:true});const writeRaceScope=writeRace.api.scope();let writeRaceTask
const writeRacePending=writeRace.api.download('job-write-race','report',writeRaceScope,'Write race',{onTask:value=>{writeRaceTask=value}});await settle();answerRange(writeRace.requests[0],reportBytes,'"write-race-v1"');await settle();answerRange(writeRace.requests[1],reportBytes,'"write-race-v1"');await settle()
writeRaceTask.abort();writeRace.flushAppend();await assert.rejects(()=>writeRacePending,/已暂停/)
const writeRaceMeta=writeRace.storage.get('stemistDraft:whole-paper-download:student-a');assert.equal(writeRaceMeta.bytes,65537);assert.equal(writeRace.files.get(writeRaceMeta.filePath).byteLength,65537,'Cancellation during a durable write checkpoints the validated chunk instead of discarding earlier progress')

const infoRace=reportDownloadRuntime({deferFileInfo:true}),infoRaceScope=infoRace.api.scope()
const infoRacePending=infoRace.api.download('job-info-race','report',infoRaceScope,'Info race');await settle();answerRange(infoRace.requests[0],reportBytes,'"info-race-v1"');await settle();answerRange(infoRace.requests[1],reportBytes,'"info-race-v1"');await settle()
const infoRacePath=infoRace.storage.get('stemistDraft:whole-paper-download:student-a').filePath;infoRace.storage.set('stemistUser',{id:'student-b'});infoRace.flushFileInfo();await assert.rejects(()=>infoRacePending,/账号/)
assert.equal(infoRace.files.has(infoRacePath),false,'Identity change during post-write fileInfo removes the old-account partial instead of publishing a checkpoint');assert.equal(infoRace.storage.get('stemistDraft:whole-paper-download:student-a'),undefined)

const cachedRace=reportDownloadRuntime({deferRead:true}),cachedRaceScope=cachedRace.api.scope(),cachedRacePath='/app/marking-reports/整卷批改_cached-race_批改报告.pdf'
cachedRace.files.set(cachedRacePath,reportBytes);cachedRace.storage.set('stemistPaperReports',[cachedRacePath]);cachedRace.storage.set('stemistDraft:whole-paper-download:student-a',{schemaVersion:'stem-paper-marking-download-v1',owner:'student-a',epoch:0,jobId:'job-cache-race',kind:'report',etag:'"cache-race-v1"',total:reportBytes.byteLength,filePath:cachedRacePath,bytes:reportBytes.byteLength,complete:true})
const cachedRacePending=cachedRace.api.download('job-cache-race','report',cachedRaceScope,'Cache race');await settle();answerRange(cachedRace.requests[0],reportBytes,'"cache-race-v1"');await settle();cachedRace.storage.set('stemistUser',{id:'student-b'});cachedRace.flushRead();await assert.rejects(()=>cachedRacePending,/账号/)
assert.equal(cachedRace.files.has(cachedRacePath),true,'A cache-head check cannot return or delete another owner’s completed report')

const tampered=reportDownloadRuntime(),tamperedScope=tampered.api.scope(),tamperedBytes=new Uint8Array(1000);tamperedBytes.set(Buffer.from('%PDF-tampered'));tamperedBytes.fill(69,13)
const tamperedPath='/app/marking-reports/整卷批改_tampered_批改报告.pdf';tampered.files.set(tamperedPath,tamperedBytes.slice(0,5));tampered.storage.set('stemistPaperReports',[tamperedPath]);tampered.storage.set('stemistDraft:whole-paper-download:student-a',{schemaVersion:'stem-paper-marking-download-v1',owner:'student-a',epoch:0,jobId:'job-tampered',kind:'report',etag:'"tampered-v1"',total:1000,filePath:tamperedPath,bytes:5,complete:true})
let tamperedTask;const tamperedPending=tampered.api.download('job-tampered','report',tamperedScope,'Tampered',{onTask:value=>{tamperedTask=value}});await settle();answerRange(tampered.requests[0],tamperedBytes,'"tampered-v1"');await settle()
const repairedMeta=tampered.storage.get('stemistDraft:whole-paper-download:student-a');assert.notEqual(repairedMeta.filePath,tamperedPath);assert.equal(tampered.requests[1].options.header.Range,'bytes=1-999','complete metadata with bytes below total is never returned as a cached PDF');tamperedTask.abort();await assert.rejects(()=>tamperedPending,/已暂停/)

const finalizing=reportDownloadRuntime(),finalizingScope=finalizing.api.scope(),finalizingPath='/app/marking-reports/整卷批改_finalizing_批改报告.pdf'
finalizing.files.set(finalizingPath,reportBytes);finalizing.storage.set('stemistPaperReports',[finalizingPath]);finalizing.storage.set('stemistDraft:whole-paper-download:student-a',{schemaVersion:'stem-paper-marking-download-v1',owner:'student-a',epoch:0,jobId:'job-finalizing',kind:'report',etag:'"finalizing-v1"',total:reportBytes.byteLength,filePath:finalizingPath,bytes:reportBytes.byteLength,complete:false})
const finalizingDownload=finalizing.api.download('job-finalizing','report',finalizingScope,'Finalizing');await settle();answerRange(finalizing.requests[0],reportBytes,'"finalizing-v1"')
assert.equal(await finalizingDownload,finalizingPath);assert.equal(finalizing.requests.length,1,'A fully persisted incomplete checkpoint runs final PDF validation without redownloading body chunks');assert.equal(finalizing.storage.get('stemistDraft:whole-paper-download:student-a').complete,true)

const resumeBytes=new Uint8Array(90_000);resumeBytes.set(Buffer.from('%PDF-resume'));resumeBytes.fill(66,11)
const resumeStart=d.requests.length,resumeProgress=[]
const interruptedDownload=d.api.download(jobId,'source',ds,'Resume source',{onProgress:value=>resumeProgress.push(value)});await settle();answerRange(d.requests[resumeStart],resumeBytes,'"resume-v1"');await settle();answerRange(d.requests[resumeStart+1],resumeBytes,'"resume-v1"');await settle()
assert.equal(d.requests[resumeStart+2].options.header.Range,'bytes=65537-89999');d.requests[resumeStart+2].options.fail({errMsg:'offline'})
await assert.rejects(()=>interruptedDownload,/已下载部分已保留/);assert.ok(resumeProgress.every(item=>item.percent<100))
const partialMeta=d.storage.get('stemistDraft:whole-paper-download:student-a'),partialPath=partialMeta.filePath
assert.equal(partialMeta.bytes,65537);assert.equal(d.files.get(partialPath).byteLength,65537)
const retryStart=d.requests.length,retried=d.api.download(jobId,'source',ds,'Resume source');await settle();answerRange(d.requests[retryStart],resumeBytes,'"resume-v1"');await settle()
assert.equal(d.requests[retryStart+1].options.header.Range,'bytes=65537-89999');assert.equal(d.requests[retryStart+1].options.header['If-Range'],'"resume-v1"')
answerRange(d.requests[retryStart+1],resumeBytes,'"resume-v1"');assert.equal(await retried,partialPath);assert.deepEqual(d.files.get(partialPath),resumeBytes)
assert.doesNotMatch(JSON.stringify(d.storage.get('stemistDraft:whole-paper-download:student-a')),/fixture-token|authorization/i,'Resume metadata never persists credentials')

const mismatch=reportDownloadRuntime(),mismatchScope=mismatch.api.scope(),mismatchBytes=new Uint8Array(70_000);mismatchBytes.set(Buffer.from('%PDF-mismatch'));mismatchBytes.fill(68,13)
const mismatchFirst=mismatch.api.download('job-length-123','report',mismatchScope,'Length mismatch');await settle();answerRange(mismatch.requests[0],mismatchBytes,'"length-v1"');await settle();answerRange(mismatch.requests[1],mismatchBytes,'"length-v1"');await settle();mismatch.requests[2].options.fail({errMsg:'offline'});await assert.rejects(()=>mismatchFirst)
const mismatchOldMeta=mismatch.storage.get('stemistDraft:whole-paper-download:student-a');mismatch.files.set(mismatchOldMeta.filePath,mismatch.files.get(mismatchOldMeta.filePath).slice(0,-1))
let mismatchTask;const mismatchRetry=mismatch.api.download('job-length-123','report',mismatchScope,'Length mismatch',{onTask:value=>{mismatchTask=value}});await settle();answerRange(mismatch.requests[3],mismatchBytes,'"length-v1"');await settle()
const mismatchNewMeta=mismatch.storage.get('stemistDraft:whole-paper-download:student-a');assert.notEqual(mismatchNewMeta.filePath,mismatchOldMeta.filePath);assert.equal(mismatch.files.has(mismatchOldMeta.filePath),false);assert.equal(mismatch.requests[4].options.header.Range,'bytes=1-65536','A file/checkpoint length mismatch resets instead of appending at a corrupt offset')
mismatchTask.abort();await assert.rejects(()=>mismatchRetry,/已暂停/)

const etagBytes=new Uint8Array(70_000);etagBytes.set(Buffer.from('%PDF-etag'));etagBytes.fill(67,9)
const etagStart=d.requests.length,etagInterrupted=d.api.download('job-etag-123','report',ds,'ETag report');await settle();answerRange(d.requests[etagStart],etagBytes,'"etag-v1"');await settle();d.requests[etagStart+1].options.fail({errMsg:'offline'});await assert.rejects(()=>etagInterrupted)
const etagOldPath=d.storage.get('stemistDraft:whole-paper-download:student-a').filePath,etagRetryStart=d.requests.length
let etagTask;const etagRetry=d.api.download('job-etag-123','report',ds,'ETag report',{onTask:value=>{etagTask=value}});await settle();answerRange(d.requests[etagRetryStart],etagBytes,'"etag-v2"');await settle()
const etagNewMeta=d.storage.get('stemistDraft:whole-paper-download:student-a');assert.notEqual(etagNewMeta.filePath,etagOldPath);assert.equal(d.files.has(etagOldPath),false);assert.equal(d.requests[etagRetryStart+1].options.header.Range,'bytes=1-65536')
etagTask.abort();await assert.rejects(()=>etagRetry,/已暂停/);assert.equal(d.files.get(etagNewMeta.filePath).byteLength,1)

const identityRuntime=reportDownloadRuntime(),identityScope=identityRuntime.api.scope(),identityBytes=new Uint8Array(Buffer.from('%PDF-identity'))
const identityDownload=identityRuntime.api.download('job-identity-123','report',identityScope,'Identity');await settle();answerRange(identityRuntime.requests[0],identityBytes,'"identity-v1"');await settle()
assert.equal(identityRuntime.files.values().next().value.byteLength,1);identityRuntime.storage.set('stemistUser',{id:'student-b'});answerRange(identityRuntime.requests[1],identityBytes,'"identity-v1"')
await assert.rejects(()=>identityDownload,/账号/);assert.equal(identityRuntime.files.values().next().value.byteLength,1,'A late old-account response cannot append private bytes')

for(const malformed of [
  {etag:'W/"weak"'},
  {contentRange:'bytes 0-1/10'},
  {total:40*1024*1024+1},
]){
  const bad=reportDownloadRuntime(),badScope=bad.api.scope(),pending=bad.api.download('job-malformed-123','report',badScope,'Bad');await settle();answerRange(bad.requests[0],identityBytes,'"bad-v1"',malformed)
  await assert.rejects(()=>pending,error=>['download_response_invalid','download_too_large'].includes(error?.code));assert.equal(bad.files.size,0)
}

const failedDownload=reportDownloadRuntime(),fsScope=failedDownload.api.scope()
const storedReports=Array.from({length:20},(_,i)=>'/app/marking-reports/整卷批改_saved-'+i+'_批改报告.pdf')
failedDownload.storage.set('stemistPaperReports',storedReports)
const failure=failedDownload.api.download(jobId,'report',fsScope,'Failure');await settle();failedDownload.requests[0].options.fail({errMsg:'offline'});await assert.rejects(()=>failure)
assert.deepEqual(clone(failedDownload.storage.get('stemistPaperReports')),storedReports,'A failed probe must not evict completed reports')
const unauthorized=failedDownload.api.download(jobId,'report',fsScope,'401');await settle();failedDownload.requests[1].options.success({statusCode:401,data:new ArrayBuffer(0),header:{}})
await assert.rejects(()=>unauthorized);assert.equal(failedDownload.api.current(fsScope),false)

function pageRuntime(overrides={},wx={},globals={}) {
  let currentOwner='student-a',epoch=0
  const calls=[], jobs=new Map(), uploads=[]
  const service={scope:()=>({owner:currentOwner,epoch}),current:s=>s?.owner===currentOwner&&s.epoch===epoch,
    validateFiles:api.validateFiles,inspect:async f=>({...f,size:6,mediaType:f.kind==='pdf'?'application/pdf':'image/jpeg'}),
    list:async()=>[],get:async id=>jobs.get(id),
    create:async draft=>{calls.push(['create',draft.clientRequestId]);const job={jobId,status:'draft',assets:draft.files.map((f,i)=>({clientAssetId:f.id,assetId:'asset-fixture'+i}))};jobs.set(jobId,job);return job},
    upload:async(id,file)=>{uploads.push(file.id);jobs.get(id).assets.find(a=>a.assetId===file.assetId).status='uploaded'},
    submit:async draft=>{calls.push(['submit',draft.files.map(f=>f.assetId)]);const job=jobs.get(jobId);job.status='queued';return {...job}},
    retry:async()=>{},...overrides,
  }
  const r=miniRuntime({wx,globals,modules:{'bundles/marking/service':service}})
  r.storage.set('stemistUser',{id:currentOwner});r.storage.set('stemistSessionToken','fixture')
  const p=r.page('bundles/marking/index');p.onLoad()
  return {...r,p,service,calls,jobs,uploads,switchOwner:owner=>{currentOwner=owner;r.storage.set('stemistUser',{id:owner})},switchEpoch:value=>{epoch=value;r.storage.set('stemistPrivacyEpoch',value)}}
}
function fakeTimers(){
  let next=0
  const timers=new Map()
  return{globals:{setTimeout:(fn,delay)=>{const id=++next;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id)},pending:()=>timers.size,runAll:()=>{const queued=[...timers.values()];timers.clear();for(const timer of queued)timer.fn()}}
}
const q=pageRuntime(),p=q.p
assert.equal(p.data.flowStep,1)
assert.equal(p.data.optionalOpen,false)
assert.equal(p.data.actionVisible,true)
p.toggleOptional();assert.equal(p.data.optionalOpen,true)
p.toggleOptional();assert.equal(p.data.optionalOpen,false)

let chooser,privacyChecks=0
const inspected=deferred()
const selection=pageRuntime({inspect:file=>inspected.promise.then(()=>({...file,size:pdf.byteLength,mediaType:'application/pdf'}))},{
  getPrivacySetting:options=>{privacyChecks++;options.success({needAuthorization:false})},
  chooseMessageFile:options=>{chooser=options},
})
selection.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.ok(chooser,'PDF chooser must be invoked synchronously from the user tap')
assert.equal(privacyChecks,1,'Privacy is prefetched before the user tap, not awaited inside it')
assert.equal(selection.p.data.picking,true)
selection.p.onHide()
assert.equal(selection.p.data.picking,true,'Native chooser lifecycle hide must not end selection state')
chooser.success({tempFiles:[{path:'/tmp/answer.pdf',name:'answer.pdf'}]})
selection.p.onShow()
assert.equal(privacyChecks,2,'Returning from the native chooser revalidates privacy state')
await settle()
assert.equal(selection.p.data.picking,true,'Submit remains blocked while the selected PDF is inspected')
inspected.resolve()
await settle()
assert.equal(selection.p.data.picking,false)
assert.equal(selection.p.data.answers.length,1,'Selection survives the chooser hide/show lifecycle')
assert.equal(selection.p.data.answers[0].mediaType,'application/pdf')
assert.match(selection.p.data.selectionSummary,/1 份 PDF/)
await selection.p.submit();selection.p.pause()
assert.equal(selection.p.data.jobStatus,'queued','A PDF selected through the native chooser can be submitted')
assert.deepEqual(selection.uploads,[selection.p.__draft.files[0].id])
assert.equal(selection.p.data.uploadTotal,1)
assert.equal(selection.p.data.uploadCompleted,1)
assert.equal(selection.p.data.flowStep,2)
assert.equal(selection.p.data.actionVisible,false)

const queuedReleases=[]
const queuedCleanup=pageRuntime({
  isManagedFile:path=>String(path).startsWith('/app/whole-paper-inputs/'),
  releaseFiles:async(files,kept)=>queuedReleases.push({files:clone(files),kept:clone(kept)}),
})
queuedCleanup.p.__draft.files=[{...input('file-owned1'),path:'/app/whole-paper-inputs/paper-owned-1.jpg'}];queuedCleanup.p.save()
await queuedCleanup.p.submit();queuedCleanup.p.pause()
assert.equal(queuedCleanup.p.__draft.files[0].path,'','A server-confirmed queued job releases its now-unreferenced local copy')
assert.equal(queuedCleanup.p.__draft.files[0].localReleased,true)
assert.equal(queuedReleases.length,1)
assert.equal(queuedReleases[0].files[0].path,'/app/whole-paper-inputs/paper-owned-1.jpg')
assert.equal(queuedReleases[0].kept[0].path,'','The persisted draft stops referencing a copy before deletion')

const newTaskReleases=[]
const newTaskCleanup=pageRuntime({
  isManagedFile:()=>true,
  releaseFiles:async(files,kept)=>newTaskReleases.push({files:clone(files),kept:clone(kept)}),
},{showModal:options=>options.success({confirm:true})})
newTaskCleanup.p.__draft.files=[{...input('file-owned2'),path:'/app/whole-paper-inputs/paper-owned-2.jpg'}];newTaskCleanup.p.save()
newTaskCleanup.p.newTask();await settle()
assert.equal(newTaskReleases.length,1)
assert.equal(newTaskReleases[0].kept.length,0,'Starting a new task releases only files no longer referenced by its draft')

let scrolledTo
const scrolling=pageRuntime({}, {pageScrollTo:options=>{scrolledTo=options}})
scrolling.p.__draft.files=[input('file-scroll1')];scrolling.p.save()
await scrolling.p.submit();scrolling.p.pause()
assert.equal(scrolledTo.selector,'#marking-job-state','Confirmed submission focuses the real current job state')

let confirmedSubmits=0,failedStatusReads=0
const confirmedQueue=pageRuntime({
  submit:async()=>{confirmedSubmits++;return{jobId,status:'queued',progress:{}}},
  get:async()=>{failedStatusReads++;throw Error('状态读取暂时失败')},
})
confirmedQueue.p.__draft.files=[input('file-confirmed1')];confirmedQueue.p.save()
await confirmedQueue.p.submit()
assert.equal(confirmedSubmits,1)
assert.equal(failedStatusReads,1)
assert.equal(confirmedQueue.p.data.jobStatus,'queued','Validated submit response remains visible when immediate status GET fails')
assert.equal(confirmedQueue.p.data.flowStep,2)
assert.equal(confirmedQueue.p.data.actionVisible,false)
await confirmedQueue.p.submit()
assert.equal(confirmedSubmits,1,'Retry after confirmed queue state cannot submit the same job twice')
confirmedQueue.p.pause()

const stateView=pageRuntime()
stateView.p.__draft.jobId=jobId
stateView.p.setJob({jobId,status:'draft',progress:{}})
assert.equal(stateView.p.data.flowStep,1);assert.match(stateView.p.data.jobStateHint,/上传/)
stateView.p.setJob({jobId,status:'queued',progress:{}})
assert.equal(stateView.p.data.flowStep,2);assert.match(stateView.p.data.jobStateHint,/等待 AI 批改/)
stateView.p.setJob({jobId,status:'processing',progress:{completedPages:2,totalPages:5}})
assert.equal(stateView.p.data.flowStep,2);assert.match(stateView.p.data.jobStateHint,/正在批改/)
stateView.p.setJob({jobId,status:'completed',result:feedbackOnly})
assert.equal(stateView.p.data.flowStep,3);assert.match(stateView.p.data.jobStateHint,/批改完成/)
assert.equal(stateView.p.data.jobLabel,'批改已完成','Completed label must not claim a PDF exists before reportPdfPath does')
stateView.p.setJob({jobId,status:'failed',retryable:true,progress:{}})
assert.equal(stateView.p.data.flowStep,2);assert.match(stateView.p.data.jobStateHint,/未完成/)

const recoveryClock=fakeTimers()
let recoveryChooser
const recovery=pageRuntime({}, {
  getPrivacySetting:options=>options.success({needAuthorization:false}),
  chooseMessageFile:options=>{recoveryChooser=options},
},recoveryClock.globals)
recovery.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
const abandonedChooser=recoveryChooser
recovery.p.onHide()
assert.equal(recoveryClock.pending(),0,'No recovery timeout runs while the native chooser owns the screen')
recoveryClock.runAll();assert.equal(recovery.p.data.picking,true)
recovery.p.onShow()
assert.equal(recoveryClock.pending(),0,'Returning from the native chooser never starts an arbitrary failure timeout')
recoveryClock.runAll();await settle()
abandonedChooser.success({tempFiles:[{path:'/tmp/slow-provider.pdf',name:'slow-provider.pdf'}]})
await settle()
assert.equal(recovery.p.data.answers.length,1,'A valid late callback from an iPad file provider remains accepted')
assert.equal(recovery.p.data.picking,false)
recovery.p.remove({currentTarget:{dataset:{id:recovery.p.__draft.files[0].id}}})
recovery.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
const pickerCancelledChooser=recoveryChooser
recovery.p.onHide();recovery.p.onShow();recovery.p.cancelPicker();await settle()
assert.equal(recovery.p.data.picking,false,'A visible cancel action exits a chooser that never returned')
recovery.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
const retryChooser=recoveryChooser
assert.notEqual(retryChooser,pickerCancelledChooser)
pickerCancelledChooser.success({tempFiles:[{path:'/tmp/stale.pdf',name:'stale.pdf'}]});await settle()
assert.equal(recovery.p.data.answers.length,0,'A callback from a user-cancelled chooser cannot add a stale file')
assert.equal(recovery.p.data.picking,true,'A stale callback cannot unlock the newer chooser')
retryChooser.fail({errMsg:'chooseMessageFile:fail cancel'});await settle()
assert.equal(recovery.p.data.picking,false)

const inspectionClock=fakeTimers()
const inspectionResult=deferred()
let inspectionChooser
const inspectionRecovery=pageRuntime({inspect:file=>inspectionResult.promise.then(()=>({...file,size:pdf.byteLength,mediaType:'application/pdf'}))},{
  getPrivacySetting:options=>options.success({needAuthorization:false}),
  chooseMessageFile:options=>{inspectionChooser=options},
},inspectionClock.globals)
inspectionRecovery.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
inspectionRecovery.p.onHide();inspectionRecovery.p.onShow()
assert.equal(inspectionClock.pending(),0)
inspectionChooser.success({tempFiles:[{path:'/tmp/inspect.pdf',name:'inspect.pdf'}]})
await settle()
inspectionClock.runAll()
assert.equal(inspectionRecovery.p.data.picking,true,'Lifecycle recovery never interrupts file inspection')
inspectionResult.resolve();await settle()
assert.equal(inspectionRecovery.p.data.answers.length,1)

const lifecycleClock=fakeTimers()
let lifecycleChooser
const lifecycleRecovery=pageRuntime({}, {
  getPrivacySetting:options=>options.success({needAuthorization:false}),
  chooseMessageFile:options=>{lifecycleChooser=options},
},lifecycleClock.globals)
lifecycleRecovery.p.pickPdf({currentTarget:{dataset:{role:'answer'}}});lifecycleRecovery.p.onHide();lifecycleRecovery.p.onShow()
assert.equal(lifecycleClock.pending(),0)
lifecycleRecovery.switchOwner('student-b');lifecycleRecovery.p.bindOwner()
assert.equal(lifecycleRecovery.p.data.picking,false,'Owner changes clear pending chooser recovery')
lifecycleChooser.success({tempFiles:[{path:'/tmp/old-owner.pdf',name:'old-owner.pdf'}]});await settle()
assert.equal(lifecycleRecovery.p.data.answers.length,0)
lifecycleRecovery.p.pickPdf({currentTarget:{dataset:{role:'answer'}}});lifecycleRecovery.p.onHide();lifecycleRecovery.p.onShow()
assert.equal(lifecycleClock.pending(),0)
lifecycleRecovery.p.onUnload()
assert.equal(lifecycleClock.pending(),0,'Unload clears pending chooser recovery')

let legacyChooser
const legacyImages=pageRuntime({}, {
  getPrivacySetting:options=>options.success({needAuthorization:false}),
  chooseImage:options=>{legacyChooser=options},
})
legacyImages.p.pickImages()
legacyChooser.success({tempFilePaths:['/tmp/legacy-only.jpg']});await settle()
assert.equal(legacyImages.p.data.answers.length,1,'Legacy chooseImage tempFilePaths-only results remain usable')
assert.equal(legacyImages.p.data.answers[0].path,'/tmp/legacy-only.jpg')

let consentChooser
const consent=pageRuntime({}, {
  getPrivacySetting:options=>options.success({needAuthorization:true}),
  chooseMessageFile:options=>{consentChooser=options},
})
assert.equal(consent.p.data.privacy,true)
consent.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.equal(consentChooser,undefined,'Privacy consent is required before opening protected file APIs')
consent.p.agreePrivacy()
assert.match(consent.p.data.selectionNotice,/再次点击/)
consent.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.ok(consentChooser,'The tap after confirmed privacy consent opens the chooser synchronously')
const cancelledChooser=consentChooser
consentChooser.fail({errMsg:'chooseMessageFile:fail cancel'})
await settle()
assert.equal(consent.p.data.selectionError,'','Cancelling the native chooser is not presented as an error')
consent.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.notEqual(consentChooser,cancelledChooser,'Cancelling leaves the picker immediately retryable')
consentChooser.success({tempFiles:[{path:'/tmp/retry.pdf',name:'retry.pdf'}]})
await settle()
assert.equal(consent.p.data.answers.length,1)

let blockedChooser
const privacyPending=pageRuntime({}, {
  getPrivacySetting:()=>{},
  chooseMessageFile:options=>{blockedChooser=options},
})
privacyPending.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.equal(blockedChooser,undefined,'Unknown privacy state never enters a protected file API')
assert.equal(privacyPending.p.data.picking,false)
assert.match(privacyPending.p.data.selectionError,/隐私设置/)

let privacyFailChecks=0,privacyFailChooser
const privacyFailure=pageRuntime({}, {
  getPrivacySetting:options=>{privacyFailChecks++;options.fail({errMsg:'getPrivacySetting:fail'})},
  chooseMessageFile:options=>{privacyFailChooser=options},
})
privacyFailure.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.equal(privacyFailChecks,2,'A tap retries a failed privacy preflight')
assert.equal(privacyFailChooser,undefined)
assert.equal(privacyFailure.p.data.picking,false)
assert.match(privacyFailure.p.data.selectionError,/隐私设置暂时无法读取/)

let failedChooser
const nativeFailure=pageRuntime({}, {
  getPrivacySetting:options=>options.success({needAuthorization:false}),
  chooseMessageFile:options=>{failedChooser=options},
})
nativeFailure.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
failedChooser.fail({errMsg:'chooseMessageFile:fail api scope is not declared in the privacy agreement wxfile://tmp/private-answer.pdf?token=fixture-secret',errno:20001,code:'PRIVACY_SCOPE'})
await settle()
assert.equal(nativeFailure.p.data.picking,false)
assert.match(nativeFailure.p.data.selectionError,/隐私声明尚未生效/,'A missing or pending privacy declaration points to its review state, not repeated student consent')
assert.match(nativeFailure.p.data.selectionError,/重复授权无法解决/)
assert.equal(nativeFailure.p.data.selectionCode,'PRIVACY_SCOPE / 20001')
assert.deepEqual(clone(nativeFailure.p.__pickerDiagnostic),{errno:'20001',code:'PRIVACY_SCOPE',errMsg:'chooseMessageFile:fail api scope is not declared in the privacy agreement [file]'})
assert.doesNotMatch(JSON.stringify(nativeFailure.p.__pickerDiagnostic),/private-answer|fixture-secret|token=/)
nativeFailure.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
failedChooser.fail({errMsg:'chooseMessageFile:fail privacy authorization required'})
await settle()
assert.match(nativeFailure.p.data.selectionError,/完成隐私授权/,'A consent failure tells the student how to recover')
assert.doesNotMatch(nativeFailure.p.data.selectionError,/尚未生效/)

let invalidChooser
const invalidSelection=pageRuntime({inspect:async()=>{throw Error('PDF 不能超过 10 MB。')}},{
  getPrivacySetting:options=>options.success({needAuthorization:false}),
  chooseMessageFile:options=>{invalidChooser=options},
})
invalidSelection.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
invalidChooser.success({tempFiles:[{path:'/tmp/oversize.pdf',name:'oversize.pdf'}]})
await settle()
assert.equal(invalidSelection.p.data.picking,false)
assert.equal(invalidSelection.p.data.selectionError,'PDF 不能超过 10 MB。','Local inspection errors remain precise and actionable')

let scopedChooser,scopePrivacyChecks=0
const scopedInspection=deferred()
const scopedSelection=pageRuntime({inspect:file=>scopedInspection.promise.then(()=>({...file,size:pdf.byteLength,mediaType:'application/pdf'}))},{
  getPrivacySetting:options=>{scopePrivacyChecks++;options.success({needAuthorization:false})},
  chooseMessageFile:options=>{scopedChooser=options},
})
scopedSelection.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
scopedChooser.success({tempFiles:[{path:'/tmp/private-a.pdf',name:'private-a.pdf'}]})
await settle()
assert.equal(scopedSelection.p.data.picking,true)
scopedSelection.switchOwner('student-b');scopedSelection.p.bindOwner()
assert.equal(scopePrivacyChecks,2,'Owner changes revalidate privacy instead of reusing cached state')
assert.equal(scopedSelection.p.data.picking,false)
scopedInspection.resolve();await settle()
assert.equal(scopedSelection.p.data.answers.length,0,'Inspection finishing after an owner change cannot publish the old private file')
scopedSelection.switchEpoch(1);scopedSelection.p.bindOwner()
assert.equal(scopePrivacyChecks,3,'Privacy epoch changes also revalidate cached state')

p.__draft.files=[input('file-first1'),input('file-second2'),input('file-ref123','mark-scheme','application/pdf')];p.save()
p.move({currentTarget:{dataset:{id:'file-second2',delta:-1}}})
assert.deepEqual(clone(p.__draft.files.map(f=>f.id)),['file-second2','file-first1','file-ref123'])
await p.submit();p.pause()
assert.deepEqual(q.uploads,['file-second2','file-first1','file-ref123'])
assert.equal(p.data.jobStatus,'queued')
assert.deepEqual(clone(q.calls.find(c=>c[0]==='submit')[1]),['asset-fixture0','asset-fixture1','asset-fixture2'])
const requestId=p.__draft.clientRequestId
await p.submit();p.pause()
assert.equal(q.calls.filter(c=>c[0]==='create').length,1,'Retry retrieves same job, never creates duplicate')
assert.equal(q.calls.filter(c=>c[0]==='submit').length,1,'Already queued job not resubmitted')
p.data.history=[{jobId}];p.openJob({currentTarget:{dataset:{id:jobId}}});await settle();p.pause()
assert.equal(p.__draft.files.length,3,'History restores local upload paths')
assert.equal(p.__draft.clientRequestId,requestId)

p.setJob({jobId,status:'completed',result:{assessmentMode:'ai-advisory-unscored',officialScore:false,provisionalScore:100,maxScore:100,summary:'feedback',questionResults:[{questionId:'1',score:1,maxScore:1,feedback:'test'}]}})
assert.equal(p.data.result.scoreReady,false);assert.equal(p.data.questions[0].scoreReady,false)
p.setJob({jobId,status:'completed',result:{assessmentMode:'ai-provisional',officialScore:false,summary:'Visible question feedback.',provisionalScore:5,maxScore:21,questionResults:Array.from({length:21},(_,i)=>({questionId:String(i+1),feedback:'test',provisionalScore:i<5?1:0,maxScore:1,evidence:['Answer page 1']}))}})
assert.equal(p.data.result.scoreReady,true);assert.equal(p.data.questions.length,10)
p.reportPage({currentTarget:{dataset:{delta:1}}});assert.equal(p.data.questions[0].questionId,'11')
p.reportPage({currentTarget:{dataset:{delta:1}}});assert.equal(p.data.questions.length,1)
p.setJob({jobId,status:'completed',result:{...feedbackOnly,assessmentMode:'ai-provisional',officialScore:true,provisionalScore:5,maxScore:10}})
assert.equal(p.data.result.scoreReady,false,'Official flag cannot be promoted by UI')
p.setJob({jobId,status:'completed',result:{assessmentMode:'ai-provisional',officialScore:false,summary:'Partial evidence only.',provisionalScore:3,maxScore:4,reviewRequired:true,missingPages:[2],missingQuestions:['3(b)'],questionResults:[{questionLabel:'2(a)',provisionalScore:3,maxScore:4,rationale:'单位缺失',confidence:0.7,reviewRequired:true,evidence:['作答第 1 页第二行'],criteria:[{label:'单位',awarded:0,maxScore:1,comment:'缺少 N'}]}]}})
assert.equal(p.data.questions[0].questionId,'2(a)')
assert.equal(p.data.questions[0].score,null,'Incomplete source must not leave apparently complete question scores')
assert.equal(p.data.questions[0].feedback,'单位缺失')
assert.match(p.data.questions[0].evidence,/第 1 页/)
assert.match(p.data.result.completeness,/3\(b\)/)
assert.equal(p.data.reportAvailable,false,'Saved AI feedback does not imply that a report PDF exists')
p.setJob({jobId,status:'completed',reportPdfPath:'/private/report.pdf',sourcePdfPath:'/private/source.pdf'})
assert.equal(p.data.reportAvailable,false,'A PDF path without a usable report result is not a successful assessment')
p.setJob({jobId,status:'completed',result:feedbackOnly,reportPdfPath:'/private/report.pdf',sourcePdfPath:'/private/source.pdf'})
assert.equal(p.data.reportAvailable,true)

const late=deferred(),a=pageRuntime({list:()=>late.promise})
const pendingHistory=a.p.loadHistory();a.switchOwner('student-b');a.p.bindOwner();late.resolve([{jobId,title:'private student A'}]);await pendingHistory
assert.equal(a.p.data.history.length,0,'Late history cannot cross accounts')
const authFail=deferred(),b=pageRuntime({get:()=>authFail.promise})
b.p.__draft.jobId=jobId;b.p.setData({result:{summary:'private'}})
const pendingStatus=b.p.refreshJob();b.switchOwner('guest');authFail.reject(Error('401'));await pendingStatus
assert.equal(b.p.data.authenticated,false);assert.equal(b.p.data.result,null,'Expired identity clears visible private report')
const first=deferred(),second=deferred();let requestCount=0
const race=pageRuntime({get:()=>++requestCount===1?first.promise:second.promise})
race.p.__draft.jobId=jobId
const earlier=race.p.refreshJob(),later=race.p.refreshJob()
second.resolve({jobId,status:'completed',result:feedbackOnly});await later
first.resolve({jobId,status:'processing'});await earlier
assert.equal(race.p.data.jobStatus,'completed','Older poll cannot roll back a newer result')
const stale=pageRuntime()
stale.storage.set('stemistDraft:whole-paper:student-b',{epoch:0,files:[],routeId:'old-removed-route'})
stale.switchOwner('student-b');stale.p.bindOwner()
assert.equal(stale.p.__draft.routeId,stale.p.data.routes[stale.p.data.routeIndex].id,'Visible course must match new submission route')
let cancellationCalls=0
const cancelledReleases=[]
const cancellation=pageRuntime({cancel:async()=>{cancellationCalls++},get:async()=>({jobId,status:'failed',failureCode:'cancelled',retryable:false}),isManagedFile:()=>true,releaseFiles:async(files,kept)=>cancelledReleases.push({files:clone(files),kept:clone(kept)})})
cancellation.p.__draft.files=[{...input('file-cancel1'),path:'/app/whole-paper-inputs/paper-cancel-1.jpg'}];cancellation.p.__draft.jobId=jobId;cancellation.p.setJob({jobId,status:'draft'})
cancellation.wx.showModal=opts=>opts.success({confirm:false})
await cancellation.p.cancelDraft();assert.equal(cancellationCalls,0)
cancellation.wx.showModal=opts=>opts.success({confirm:true})
await cancellation.p.cancelDraft();assert.equal(cancellationCalls,1);assert.equal(cancellation.p.data.jobLabel,'已取消');assert.equal(cancellation.p.data.error,'')
assert.equal(cancellation.p.__draft.files[0].path,'','Confirmed cancellation removes the draft reference before managed cleanup')
assert.equal(cancelledReleases.length,1)
await cancellation.p.cancelDraft();assert.equal(cancellationCalls,1,'Completed cancellation cannot be repeated through UI')

const c=pageRuntime();let uploadAttempts=0,uploadAborts=0
c.service.upload=async(id,file,_scope,control)=>{
  uploadAttempts++
  if(uploadAttempts===1)return new Promise((_resolve,reject)=>{control.task={abort(){uploadAborts++;reject(Error('上传已暂停，点击继续上传。'))}}})
  c.jobs.get(id).assets.find(asset=>asset.assetId===file.assetId).status='uploaded'
}
c.p.__draft.files=[input()];const pendingUpload=c.p.submit();await settle();c.p.onHide();await pendingUpload
assert.equal(uploadAborts,1)
assert.equal(c.calls.filter(x=>x[0]==='submit').length,0)
assert.equal(c.p.data.error,'','Lifecycle pause does not publish a false upload failure')
assert.match(c.p.data.status,/已暂停/)
c.p.onShow();await settle();await settle();await settle()
assert.equal(uploadAttempts,2,'Returning to the same owner and privacy epoch safely resumes an interrupted upload once')
assert.equal(c.calls.filter(x=>x[0]==='submit').length,1,'Lifecycle resume reaches the queue without a second student tap')
assert.equal(c.p.data.jobStatus,'queued')

const manual=pageRuntime();let manualAttempts=0
manual.service.upload=async(_id,_file,_scope,control)=>{manualAttempts++;return new Promise((_resolve,reject)=>{control.task={abort(){reject(Error('上传已暂停，点击继续上传。'))}}})}
manual.p.__draft.files=[input('file-manual1')];const manualPending=manual.p.submit();await settle();manual.p.pauseUpload();await manualPending
manual.p.onHide();manual.p.onShow();await settle();await settle()
assert.equal(manualAttempts,1,'An explicit student pause never auto-resumes on show')
assert.match(manual.p.data.status,/点击.*继续上传/)

const pendingCreate=deferred(),manualCreate=pageRuntime({create:()=>pendingCreate.promise})
manualCreate.p.__draft.files=[input('file-create-pause1')]
const manualCreatePending=manualCreate.p.submit();manualCreate.p.pauseUpload()
const createdWhilePaused={jobId,status:'draft',assets:[{clientAssetId:'file-create-pause1',assetId:'asset-create-pause1',status:'pending'}]}
manualCreate.jobs.set(jobId,createdWhilePaused);pendingCreate.resolve(createdWhilePaused);await manualCreatePending
assert.equal(manualCreate.p.data.jobStatus,'draft')
assert.equal(manualCreate.p.data.actionVisible,true,'A create response arriving after explicit pause still exposes the continue action')
assert.match(manualCreate.p.data.status,/点击.*继续上传/)

let staleChooserCalls=0
const staleLocal=pageRuntime({upload:async()=>{throw Error('本机作答文件已失效，请点击“新建另一份批改”后重新选择文件。')}},{chooseMessageFile:()=>{staleChooserCalls++}})
staleLocal.p.__draft.files=[input('file-stale1','answer','application/pdf')]
await staleLocal.p.submit()
staleLocal.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.equal(staleChooserCalls,0,'A legacy server draft does not pretend its disabled picker can replace a missing local file')
assert.match(staleLocal.p.data.error,/新建另一份批改/)
assert.equal(staleLocal.p.data.actionVisible,true)

for(const fixture of [q,selection,queuedCleanup,newTaskCleanup,scrolling,confirmedQueue,stateView,recovery,inspectionRecovery,lifecycleRecovery,legacyImages,consent,privacyPending,privacyFailure,nativeFailure,invalidSelection,scopedSelection,a,b,c,manual,manualCreate,staleLocal,race,stale,cancellation])fixture.p.onUnload()
console.log('Whole-paper client: native PDF selection, inspection, upload, privacy, ordering, idempotence, auth expiry, history, scoring, paging and pause regressions PASS')
