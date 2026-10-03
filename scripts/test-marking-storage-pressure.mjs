import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const pdf=Buffer.alloc(30000,65);pdf.set(Buffer.from('%PDF-1.7\n'))
const tag='"'+crypto.createHash('sha256').update(pdf).digest('hex')+'"'
const publicFile='/app/pdf-cache/pdf-finished-001/public-paper.pdf'
const partialFile='/app/pdf-cache/pdf-partial-001/unfinished-paper.pdf'
const privateFiles=['/app/whole-paper-inputs/paper-kept.pdf','/app/native-coach/student-photo.jpg','/app/marking-reports/整卷批改_kept_批改报告.pdf']
const toArray=buffer=>Uint8Array.from(buffer).buffer
function fixture({quota=150000,completed=true,corrupt=false,storageError='storage limit exceeded'}={}){
 const files=new Map(),removed=[],temporary=[]
 for(const file of privateFiles)files.set(file,Buffer.alloc(20000,2))
 files.set(partialFile,Buffer.alloc(20000,3))
 if(completed)files.set(publicFile,Buffer.alloc(200000,4))
 let runtime
 const used=()=>[...files].filter(([p])=>p.startsWith('/app/')).reduce((sum,[,b])=>sum+b.length,0)
 const manager={
  mkdirSync(){},accessSync(){},
  statSync:p=>{if(!files.has(p))throw Error('missing');return {size:files.get(p).length,isFile:()=>true}},
  getFileInfo:o=>files.has(o.filePath)?o.success({size:files.get(o.filePath).length}):o.fail?.({}),
  writeFile:o=>{const bytes=Buffer.from(new Uint8Array(o.data));if(used()-(files.get(o.filePath)?.length||0)+bytes.length>quota)return o.fail({errMsg:'writeFile:fail '+storageError});files.set(o.filePath,bytes);o.success({})},
  appendFile:o=>{const addition=Buffer.from(new Uint8Array(o.data));if(used()+addition.length>quota)return o.fail({errMsg:'appendFile:fail '+storageError});files.set(o.filePath,Buffer.concat([files.get(o.filePath)||Buffer.alloc(0),addition]));o.success({})},
  readFile:o=>{const data=files.get(o.filePath);if(!data)return o.fail({});const at=o.position||0;o.success({data:toArray(data.subarray(at,o.length===undefined?data.length:at+o.length))})},
  unlink:o=>{removed.push(o.filePath);files.delete(o.filePath);o.success({})},
 }
 runtime=miniRuntime({wx:{env:{USER_DATA_PATH:'/app'},getFileSystemManager:()=>manager,
  request:o=>{queueMicrotask(()=>{const [,a,b]=/^bytes=(\d+)-(\d+)$/.exec(o.header.Range),start=Number(a),end=Number(b),data=pdf.subarray(start,end+1);o.success({statusCode:206,data:toArray(data),header:{'Content-Type':'application/pdf','Content-Range':`bytes ${start}-${end}/${pdf.length}`,'Content-Length':String(data.length),ETag:tag}})});return {abort(){}}},
  downloadFile:o=>{temporary.push(o);assert.equal(o.header.Authorization,'Bearer fixture-report-token');const data=Buffer.from(pdf);if(corrupt)data[data.length-1]^=1;files.set('/tmp/temporary-report.pdf',data);queueMicrotask(()=>o.success({statusCode:200,tempFilePath:'/tmp/temporary-report.pdf'}));return {abort(){},onProgressUpdate(){}}},
 }})
 const record=(path,offset,total)=>{const url='https://stem.ieltsist.com/api/stem/curriculum-papers/files/file-'+('a'.repeat(32));return{schema:1,key:'owner|'+url+'|',url,owner:'owner',path,offset,total,etag:'"public-v1"',used:1}}
 runtime.storage.set('stemistPdfRanges',[...(completed?[record(publicFile,200000,200000)]:[]),record(partialFile,20000,80000),record(privateFiles[0],20000,20000)])
 const scope={owner:'synthetic-owner',epoch:0}
 runtime.storage.set('stemistUser',{id:scope.owner})
 const api=runtime.load('bundles/marking/reportDownload')
 const download=()=>api.downloadWholePaperPdf({origin:'https://stem.ieltsist.com',jobId:'synthetic-report-job',kind:'report',scope,token:'fixture-report-token',current:()=>true,label:'storage-QA'})
 return {...runtime,download,files,removed,temporary,manager,record}
}

const recovered=fixture()
const local=await recovered.download()
assert.deepEqual(recovered.files.get(local),pdf)
assert.ok(recovered.removed.includes(publicFile),'Report allocation must reclaim only completed public PDF cache')
assert.ok(recovered.files.has(partialFile),'An unfinished AP/IB checkpoint is preserved')
for(const file of privateFiles)assert.ok(recovered.files.has(file),'Student inputs, photos and private reports remain untouched')
assert.equal(recovered.temporary.length,0)

const unavailable=fixture({storageError:'native storage unavailable'})
assert.equal(await unavailable.download(),'/tmp/temporary-report.pdf')
assert.ok(unavailable.files.has(publicFile),'Unclassified file errors do not trigger arbitrary cache deletion')

const protectedStorage=fixture({quota:81000,completed:false})
const temp=await protectedStorage.download()
assert.equal(temp,'/tmp/temporary-report.pdf')
assert.deepEqual(protectedStorage.files.get(temp),pdf)
assert.equal(protectedStorage.temporary.length,1)
assert.ok(protectedStorage.files.has(partialFile))
for(const file of privateFiles)assert.ok(protectedStorage.files.has(file))
assert.notEqual(protectedStorage.storage.get('stemistDraft:whole-paper-download:synthetic-owner')?.complete,true,'A temporary preview cannot pretend a persistent checkpoint completed')

const corrupted=fixture({quota:81000,completed:false,corrupt:true})
await assert.rejects(()=>corrupted.download(),error=>error.code==='download_pdf_invalid','Temporary report must match the production SHA-256 ETag')

const active=fixture(),cache=active.load('utils/pdfRangeCache')
 const originalRead=active.manager.readFile,releases=[]
active.manager.readFile=o=>{if(o.filePath===publicFile)releases.push(()=>o.success({data:toArray(Buffer.from('%PDF-'))}));else originalRead(o)}
active.files.get(publicFile).set(Buffer.from('%PDF-'))
const transfer=cache.acquirePdf({wxApi:active.wx,url:active.record(publicFile,200000,200000).url,owner:'owner',version:'',fileName:'public-paper.pdf'})
const transfer2=cache.acquirePdf({wxApi:active.wx,url:active.record(publicFile,200000,200000).url,owner:'owner',version:'',fileName:'public-paper.pdf'})
await Promise.resolve()
await cache.reclaimCompletedPublicPdfs(active.wx)
assert.ok(active.files.has(publicFile),'A public PDF under active validation/download is not removed')
transfer.release();releases[0]?.();await transfer.promise.catch(()=>{})
await cache.reclaimCompletedPublicPdfs(active.wx)
assert.ok(active.files.has(publicFile),'One completed consumer cannot unprotect the other active consumer')
transfer2.release();releases[1]?.();await transfer2.promise.catch(()=>{})
await cache.reclaimCompletedPublicPdfs(active.wx)
assert.ok(!active.files.has(publicFile))

const manyReports=fixture({quota:500000,completed:false}),registered=[]
for(let index=0;index<21;index++){const name='/app/marking-reports/整卷批改_earlier-'+index+'_批改报告.pdf';registered.push(name);manyReports.files.set(name,Buffer.alloc(1000))}
manyReports.storage.set('stemistPaperReports',registered)
assert.equal(await manyReports.download(),'/tmp/temporary-report.pdf','Reaching the local report count does not prevent a verified preview')
assert.deepEqual(manyReports.storage.get('stemistPaperReports'),registered,'A new preview cannot evict older private reports')

const encoded=fixture({quota:500000,completed:false}),encodedPath='/app/pdf-cache/pdf-forged-001/%2e%2e%2fprivate.pdf'
encoded.files.set(encodedPath,Buffer.alloc(20000))
encoded.storage.set('stemistPdfRanges',[encoded.record(encodedPath,20000,20000)])
await encoded.load('utils/pdfRangeCache').reclaimCompletedPublicPdfs(encoded.wx)
assert.ok(encoded.files.has(encodedPath),'Encoded traversal cannot be passed to the native filesystem cleanup')
console.log('Marking storage: completed-public reclamation, private/partial/active preservation, verified temporary report and corruption rejection passed.')
