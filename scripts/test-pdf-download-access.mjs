import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const url='https://stem.ieltsist.com/local-pdf/9702/synthetic.pdf',token='synthetic.old.token'
const runtime=miniRuntime(),access=runtime.load('utils/pdfRangeCache')
assert.equal(typeof access.pdfAccessHeaders,'function','Downloads must carry credentials only to trusted paper endpoints')
assert.equal(access.pdfAccessHeaders(url,token).Authorization,'Bearer '+token)
assert.equal(access.pdfAccessHeaders('https://stem.ieltsist.com/api/stem/curriculum-papers/files/ap-calc-ab-2025-frq-qp',token).Authorization,'Bearer '+token,'Legacy published AP file IDs also require auth on fallback')
for(const bad of ['https://elsewhere.invalid/paper.pdf','https://stem.ieltsist.com.evil.test/local-pdf/9702/a.pdf','https://stem.ieltsist.com@elsewhere.invalid/local-pdf/9702/a.pdf',url+'?token=x','https://stem.ieltsist.com/local-pdf/9702/%2Fsecret.pdf','https://stem.ieltsist.com/api/stem/private','http://stem.ieltsist.com/local-pdf/9702/a.pdf'])assert.equal(Object.keys(access.pdfAccessHeaders(bad,token)).length,0)
assert.equal(access.pdfAccessHeaders(url,'bad\r\nHeader: injected').Authorization,undefined)
assert.equal(access.pdfAccessHeaders(url,'bad\r\nHeader: injected')['X-Stemist-Download-Policy'],'shared-files-v1','invalid credentials cannot opt out of strict quota')
const source=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(600000,42),Buffer.from('\n%%EOF')]),sha=crypto.createHash('sha256').update(source).digest('hex')
const wait=()=>new Promise(resolve=>setTimeout(resolve,5))
async function until(check){for(let i=0;i<200&&!check();i++)await wait();assert.ok(check())}
function fixture(){
 const files=new Map(),storage=new Map([['stemistUser',{id:'ielts:42'}],['stemistPrivacyEpoch',1],['stemistSessionToken',token]]),requests=[];let denyAfter=1,deniedStatus=429,code='pdf_daily_limit_reached'
 const manager={mkdirSync(){},accessSync(p){if(!files.has(p))throw Error('absent')},statSync:p=>({size:files.get(p)?.length||0}),writeFile:o=>{files.set(o.filePath,Buffer.from(o.data));o.success()},appendFile:o=>{files.set(o.filePath,Buffer.concat([files.get(o.filePath),Buffer.from(o.data)]));o.success()},readFile:o=>{const b=files.get(o.filePath);if(!b)return o.fail();const part=b.subarray(o.position||0,(o.position||0)+(o.length||b.length));o.success({data:part.buffer.slice(part.byteOffset,part.byteOffset+part.length)})},unlink:o=>{files.delete(o.filePath);o.success?.()}}
 const wx={env:{USER_DATA_PATH:'/user'},getFileSystemManager:()=>manager,getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),getStorageInfoSync:()=>({keys:[...storage.keys()]}),request(options){
  const match=/^bytes=(\d+)-(\d+)$/.exec(options.header.Range),start=Number(match[1]),end=Math.min(Number(match[2]),source.length-1),denied=denyAfter>=0&&requests.length>=denyAfter
  requests.push({start,end,authorization:options.header.Authorization});let listener;const task={aborted:false,abort(){this.aborted=true},onHeadersReceived(fn){listener=fn},offHeadersReceived(){listener=null}}
  queueMicrotask(()=>{const status=denied?deniedStatus:206,header=denied?{'X-Pdf-Access-Code':code}:{'Content-Type':'application/pdf','Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${source.length}`,ETag:'"'+sha+'"'};listener?.({statusCode:status,header});if(task.aborted)return;const b=denied?Buffer.from('{}'):source.subarray(start,end+1);options.success({statusCode:status,header,data:b.buffer.slice(b.byteOffset,b.byteOffset+b.length)})});return task
 },openDocument:o=>o.success()}
 const r=miniRuntime({wx}),module=r.load('utils/pdfRangeCache')
 const acquire=()=>module.acquirePdf({wxApi:wx,url,owner:'ielts:42|1',version:sha,fileName:'synthetic.pdf',expectedBytes:source.length,expectedSha256:sha,accessToken:token})
 return{wx,r,module,storage,files,requests,acquire,allow(){denyAfter=-1},deny(status,nextCode){denyAfter=0;deniedStatus=status;code=nextCode}}
}
{
 const h=fixture();await assert.rejects(h.acquire().promise,e=>e.code==='pdf_daily_limit_reached')
 const record={...h.storage.get(h.module.REGISTRY)[0]};assert.ok(record.offset>0&&record.offset<source.length)
 assert.ok(h.requests.every(request=>request.authorization==='Bearer '+token))
 assert.doesNotMatch(JSON.stringify(record),/synthetic\.old\.token|Authorization/)
 h.deny(401,'pdf_auth_required');await assert.rejects(h.acquire().promise,e=>e.code==='pdf_auth_required');assert.equal(h.storage.get(h.module.REGISTRY)[0].offset,record.offset)
 h.allow();const before=h.requests.length,path=await h.acquire().promise
 assert.equal(h.requests[before].end,4);assert.equal(h.requests[before+1].start,record.offset);assert.deepEqual(h.files.get(path),source)
 const count=h.requests.length;h.deny(429,'pdf_daily_limit_reached');h.storage.delete('stemistSessionToken');assert.equal(await h.acquire().promise,path);assert.equal(h.requests.length,count,'Verified full cache never performs login/quota/network work')
}
{
 const h=fixture(),controller=h.r.load('utils/pdfDownload').createPdfDownloadController({wxApi:h.wx});controller.setScope('test')
 await controller.open({url,fileName:'synthetic.pdf',expectedBytes:source.length,sha256:sha,cacheVersion:sha,ownerKey:'paper:qp',itemId:'paper',scope:'test'});await until(()=>controller.getState().phase==='error')
 assert.match(controller.getState().error,/2.*份|两份/);assert.match(controller.getState().error,/北京时间/);assert.equal(controller.getState().canRetry,false);assert.equal(controller.getState().authRequired,false)
 controller.dispose()
}
{
 const h=fixture();h.deny(401,'pdf_auth_required');const controller=h.r.load('utils/pdfDownload').createPdfDownloadController({wxApi:h.wx});controller.setScope('test')
 await controller.open({url,fileName:'synthetic.pdf',expectedBytes:source.length,sha256:sha,cacheVersion:sha,ownerKey:'paper:qp',scope:'test'});await until(()=>controller.getState().phase==='error')
 assert.equal(controller.getState().authRequired,true);assert.equal(controller.getState().canRetry,false);assert.equal(h.storage.get('stemistPrivacyEpoch'),1);assert.equal(h.storage.has('stemistSessionToken'),false)
 controller.dispose()
}
function fallbackFixture(){
 const storage=new Map([['stemistUser',{id:'ielts:42'}],['stemistPrivacyEpoch',1],['stemistSessionToken',token]]),downloads=[]
 const wx={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),getStorageInfoSync:()=>({keys:[...storage.keys()]}),downloadFile(options){let listener;const task={options,onHeadersReceived(fn){listener=fn},offHeadersReceived(){listener=null},onProgressUpdate(){},offProgressUpdate(){},abort(){},respond(status,code,failed=false){listener?.({statusCode:status,header:{'X-Pdf-Access-Code':code}});if(failed)options.fail({errMsg:'downloadFile:fail interrupted'});else options.success({statusCode:status,tempFilePath:'/tmp/test.pdf'})}};downloads.push(task);return task},openDocument:()=>{throw Error('Denied file must not open')}}
 const r=miniRuntime({wx}),controller=r.load('utils/pdfDownload').createPdfDownloadController({wxApi:wx});controller.setScope('test')
 const open=()=>controller.open({url,fileName:'test.pdf',ownerKey:'qp',scope:'test'})
 return{storage,downloads,controller,open}
}
{
 const h=fallbackFixture();await h.open();h.storage.set('stemistUser',{id:'ielts:43'});h.storage.set('stemistPrivacyEpoch',2);h.storage.set('stemistSessionToken','new.owner.token');h.downloads[0].respond(401,'pdf_auth_required')
 assert.equal(h.storage.get('stemistSessionToken'),'new.owner.token');assert.equal(h.controller.getState().active,false,'A stale identity response must retire its active transfer')
 await h.open();assert.equal(h.downloads.length,2);assert.equal(h.downloads[1].options.header.Authorization,'Bearer new.owner.token');h.controller.dispose()
}
{
 const h=fallbackFixture();await h.open();h.storage.set('stemistSessionToken','renewed.token');h.downloads[0].respond(401,'pdf_auth_required')
 assert.equal(h.storage.get('stemistSessionToken'),'renewed.token');assert.equal(h.controller.getState().authRequired,false);assert.equal(h.controller.getState().canRetry,true)
 await h.controller.retry();assert.equal(h.downloads[1].options.header.Authorization,'Bearer renewed.token');h.controller.dispose()
}
for(const [status,code] of [[401,'pdf_auth_required'],[403,'pdf_daily_limit_reached'],[429,'pdf_daily_limit_reached']]){
 for(const failed of [true,false]){
  const h=fallbackFixture();await h.open()
  const success=h.downloads[0].options.success;h.downloads[0].options.success=result=>success({...result,header:{'Content-Type':'application/json'}})
  h.downloads[0].respond(status,code,failed)
  assert.equal(h.controller.getState().authRequired,status===401);assert.equal(h.controller.getState().canRetry,false);h.controller.dispose()
 }
}
{
 const h=fallbackFixture();await h.controller.open({url:'https://stem.ieltsist.com/api/stem/curriculum-papers/files/ap-calc-ab-2025-frq-qp',sha256:sha,ownerKey:'known',scope:'test'})
 assert.equal(h.downloads.length,0,'Known paper digest must not bypass verification because its filename is absent');assert.equal(h.controller.getState().phase,'error');h.controller.dispose()
}
const markup=fs.readFileSync(new URL('../components/pdf-download-progress/index.wxml',import.meta.url),'utf8')
assert.match(markup,/state\.authRequired/);assert.match(markup,/登录/)
console.log('PDF access: trusted headers, captured tokens, quota/auth checkpoints, complete cache and login guidance PASS')
