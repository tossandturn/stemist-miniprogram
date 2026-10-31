import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'

assert.ok(fs.existsSync(new URL('../utils/coachImageUpload.js',import.meta.url)),'resumable image uploader must exist')
const PROTOCOL='stem-coach-image-upload-v1',body=Buffer.alloc(150000,65).toString('base64'),image='data:image/png;base64,'+body
function setup({lostAck=false,failAll=false}={}){
 const r=miniRuntime();r.storage.set('stemistUser',{id:'ielts:101'});r.storage.set('stemistPrivacyEpoch',1)
 const uploads=new Map(),calls=[];let now=10000,lost=false
 const snapshot=u=>({protocol:PROTOCOL,id:u.id,status:u.ready?'ready':'uploading',mimeType:u.mimeType,base64Length:u.base64Length,base64Sha256:u.base64Sha256,receivedChars:u.data.length,chunkChars:65536,expiresAt:now+900000})
 const request=async(path,data,options={})=>{
  calls.push({path,data,method:options.method});now+=1000
  if(path.endsWith('/capabilities'))return{protocol:PROTOCOL,enabled:true,chunkChars:65536,maxImageBytes:4194304,ttlMs:900000}
  const parts=path.split('/'),id=parts.at(-1)==='complete'?parts.at(-2):parts.at(-1)
  if(options.method==='PUT'){
   if(!uploads.has(id))uploads.set(id,{id,...data,data:'',ready:false})
   return snapshot(uploads.get(id))
  }
  const u=uploads.get(id);if(!u)throw Object.assign(Error('missing'),{statusCode:404,code:'coach_upload_not_found'})
  if(options.method==='PATCH'){
   assert.ok(data.chunk.length<=65536);assert.equal(data.offset,u.data.length)
   if(failAll)throw Object.assign(Error('offline'),{code:'network_timeout'})
   u.data+=data.chunk
   if(lostAck&&!lost){lost=true;throw Object.assign(Error('lost ack'),{code:'network_timeout'})}
  }else if(options.method==='POST'){
   assert.ok(path.endsWith('/complete'),'validation uses the agreed completion endpoint')
   assert.equal(u.data.length,u.base64Length);assert.equal(crypto.createHash('sha256').update(u.data).digest('hex'),u.base64Sha256);u.ready=true
  }else if(options.method==='DELETE'){uploads.delete(id);return{deleted:true}}
  return snapshot(u)
 }
 return{r,uploads,calls,request,now:()=>now,uploader:r.load('utils/coachImageUpload').prepareCoachImagePayload}
}

{
 const s=setup({lostAck:true}),progress=[]
 const result=await s.uploader({message:'synthetic',imageDataUrls:[image]},{request:s.request,now:s.now,onStage:v=>progress.push(v),retryDelayMs:0})
 assert.equal(result.imageDataUrls.length,0);assert.equal(result.imageUploadIds.length,1)
 assert.equal(s.calls.filter(x=>x.method==='PATCH'&&x.data.offset===0).length,1,'accepted chunk with lost ACK is not resent')
 assert.ok(s.calls.some(x=>x.method==='GET'&&!x.path.endsWith('/capabilities')),'query confirmed offset after uncertainty')
 assert.equal([...s.uploads.values()][0].data,body)
 assert.equal(progress.at(-1).uploadedBytes,150000);assert.equal(progress.at(-1).totalBytes,150000)
 assert.ok(progress.some(p=>p.speedBytesPerSecond>0&&Number.isFinite(p.etaSeconds)))
 const serialized=JSON.stringify([...s.r.storage.values()]);assert.ok(!serialized.includes(body.slice(0,120))&&!serialized.includes('synthetic'),'only upload metadata is persisted')
 const patches=s.calls.filter(c=>c.method==='PATCH').length
 await s.uploader({message:'different question',imageDataUrls:[image]},{request:s.request,now:s.now,retryDelayMs:0})
 assert.equal(s.calls.filter(c=>c.method==='PATCH').length,patches,'ready image reused within owner and TTL')
}
{
 const s=setup({failAll:true})
 await assert.rejects(s.uploader({imageDataUrls:[image]},{request:s.request,now:s.now,retryDelayMs:0}),e=>e.code==='coach_upload_pending')
 assert.ok(s.calls.filter(c=>c.method==='PATCH').length<=3,'bounded chunk retries')
}
{
 const s=setup(),payload={message:'text',imageDataUrls:[]}
 assert.equal(await s.uploader(payload,{request:s.request}),payload);assert.equal(s.calls.length,0)
 const legacy=await s.uploader({imageDataUrls:[image]},{request:async()=>{throw Object.assign(Error('old server'),{statusCode:404})}})
 assert.equal(legacy.imageDataUrls[0],image)
 await assert.rejects(s.uploader({imageDataUrls:[image]},{request:async()=>{throw Object.assign(Error('login'),{statusCode:401,code:'auth_required'})}}),e=>e.code==='auth_required')
}
{
 const s=setup(),wait=deferred();let cancelled=false
 const request=async(path,data,options)=>{const value=await s.request(path,data,options);if(options.method==='PATCH'){await wait.promise}return value}
 const running=s.uploader({imageDataUrls:[image]},{request,now:s.now,isCancelled:()=>cancelled,retryDelayMs:0})
 await settle();await settle();cancelled=true;wait.resolve()
 await assert.rejects(running,e=>e.code==='request_cancelled')
 assert.equal(s.calls.filter(c=>c.method==='POST').length,0,'cancelled upload cannot complete or start AI')
}
{
 const s=setup();let changed=false
 const request=async(path,data,options)=>{const value=await s.request(path,data,options);if(options.method==='PATCH'&&!changed){changed=true;s.r.storage.set('stemistUser',{id:'ielts:202'})}return value}
 await assert.rejects(s.uploader({imageDataUrls:[image]},{request,now:s.now,retryDelayMs:0}),e=>e.code==='account_changed')
 assert.equal(s.calls.filter(c=>c.method==='POST').length,0)
 assert.ok(![...s.r.storage.keys()].some(k=>k.includes('ielts%3A202')))
}
{
 const s=setup()
 const answer=await s.uploader({imageDataUrls:[image,image]},{request:s.request,now:s.now,retryDelayMs:0})
 assert.equal(answer.imageUploadIds.length,1,'identical attachments must not create duplicate reference IDs rejected by the backend')
}
{
 const s=setup(),pictures=[65,66,67,68,69].map(n=>'data:image/png;base64,'+Buffer.alloc(32,n).toString('base64'))
 for(const picture of pictures.slice(0,4))await s.uploader({imageDataUrls:[picture]},{request:s.request,now:s.now,retryDelayMs:0})
 const first=[...s.uploads.keys()][0],beforePuts=s.calls.filter(c=>c.method==='PUT').length
 const blockedDelete=async(path,data,options)=>{if(options.method==='DELETE')throw Object.assign(Error('offline'),{code:'network_timeout'});return s.request(path,data,options)}
 await assert.rejects(s.uploader({imageDataUrls:[pictures[4]]},{request:blockedDelete,now:s.now,retryDelayMs:0}),e=>e.code==='coach_upload_pending')
 assert.ok(JSON.stringify([...s.r.storage.values()]).includes(first),'failed cleanup retains its receipt instead of orphaning a capacity slot')
 assert.equal(s.calls.filter(c=>c.method==='PUT').length,beforePuts)
 await s.uploader({imageDataUrls:[pictures[4]]},{request:s.request,now:s.now,retryDelayMs:0});assert.equal(s.uploads.size,4)
}
{
 const s=setup(),pictures=[70,71,72,73,74].map(n=>'data:image/png;base64,'+Buffer.alloc(32,n).toString('base64'))
 for(const picture of pictures.slice(0,4))await s.uploader({imageDataUrls:[picture]},{request:s.request,now:s.now,retryDelayMs:0})
 const result=await s.uploader({imageDataUrls:[pictures[0],pictures[4]]},{request:s.request,now:s.now,retryDelayMs:0})
 assert.ok(result.imageUploadIds.every(id=>s.uploads.has(id)),'eviction cannot delete an image already referenced by this same multi-image request')
}
console.log('PASS resumable Coach image uploads: confirmed chunks, bounded retries, progress, reuse, cancel and account isolation')
