import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import {once} from 'node:events'
import {pathToFileURL} from 'node:url'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const backend=path.resolve(process.env.COACH_UPLOAD_BACKEND||'../backend')
const {createCoachImageUploads}=await import(pathToFileURL(path.join(backend,'server/coachImageUploads.js')))
const {createCoachJobs}=await import(pathToFileURL(path.join(backend,'server/coachJobs.js')))
const parent=path.resolve('../qa');fs.mkdirSync(parent,{recursive:true});const work=fs.mkdtempSync(path.join(parent,'cross-stack-'))
const sendJson=(response,status,value)=>{response.writeHead(status,{'content-type':'application/json'});response.end(JSON.stringify(value))}
const authenticate=req=>req.headers.authorization==='Bearer synthetic-owner-a'?'ielts:551':req.headers.authorization==='Bearer synthetic-owner-b'?'ielts:552':null
const uploads=createCoachImageUploads({authenticate,sendJson});let generations=0
const bytes=Buffer.alloc(4*1024*1024,65);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes)
const image='data:image/png;base64,'+bytes.toString('base64')
const readBody=req=>new Promise((resolve,reject)=>{const list=[];req.on('data',x=>list.push(x));req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(list).toString()))}catch(e){reject(e)}});req.on('error',reject)})
const jobs=createCoachJobs({root:()=>work,authenticate,readBody,sendJson,resolvePayload:(owner,p)=>uploads.resolvePayload(owner,p),validate:async(_r,p)=>({feature:p.feature,helpIntent:p.helpIntent}),run:async(_req,response,p)=>{
 generations++;assert.equal(p.imageUploadIds,undefined);assert.equal(p.imageDataUrls.length,1);assert.equal(p.imageDataUrls[0],image)
 response.write('event: done\ndata: '+JSON.stringify({mode:'ai',providerStatus:'connected',answer:'synthetic correct',answerStatus:'complete'})+'\n\n');response.end()
}})
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');if(await uploads.handle(req,res,url))return;if(await jobs.handle(req,res,url))return;sendJson(res,404,{code:'not_found'})}catch(e){sendJson(res,e.statusCode||500,{code:e.code||'test_error'})}})
server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port
const runtime=miniRuntime();runtime.storage.set('stemistUser',{id:'ielts:551'})
const calls=[];let lostChunk=false,lostJob=false
const request=async(url,data,options={})=>{
 const method=options.method||'GET';calls.push({url,method,offset:data?.offset,bytes:data?Buffer.byteLength(JSON.stringify(data)):0})
 const response=await fetch(origin+url,{method,headers:{authorization:'Bearer synthetic-owner-a','content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});const value=await response.json()
 if(!response.ok)throw Object.assign(Error('synthetic HTTP failure'),{statusCode:response.status,code:value.code})
 if(method==='PATCH'&&!lostChunk){lostChunk=true;throw Object.assign(Error('synthetic lost chunk ACK'),{code:'network_timeout'})}
 if(method==='POST'&&url.includes('/jobs/')&&!lostJob){lostJob=true;throw Object.assign(Error('synthetic lost job ACK'),{code:'network_timeout'})}
 return value
}
try{
 const payload={message:'synthetic maximum-size fixture',feature:'answers',helpIntent:'worked-solution',imageDataUrls:[image]}
 const prepare=runtime.load('utils/coachImageUpload').prepareCoachImagePayload
 const ask=runtime.load('utils/coachJob').askCoachJob
 const result=await ask(payload,{request,preparePayload:(p,o)=>prepare(p,{...o,retryDelayMs:0}),pollMs:1})
 assert.equal(result.answer,'synthetic correct');assert.equal(generations,1)
 assert.equal(calls.filter(c=>c.method==='PATCH'&&c.offset===0).length,1,'lost accepted chunk ACK must not cause retransmission')
 assert.equal(calls.filter(c=>c.method==='POST'&&c.url.includes('/jobs/')).length,1)
 assert.ok(calls.filter(c=>c.method==='POST'&&c.url.includes('/jobs/')).every(c=>c.bytes<2048),'4MiB picture becomes a small model-start request')
 const id=calls.find(c=>c.method==='PUT').url
 const foreign=await fetch(origin+id,{headers:{authorization:'Bearer synthetic-owner-b'}});assert.equal(foreign.status,404)
 const count=calls.length;uploads.close()
 const recovered=await ask(payload,{request,preparePayload:(p,o)=>prepare(p,o),pollMs:1})
 assert.equal(recovered.answer,'synthetic correct');assert.equal(generations,1);assert.equal(calls.length,count+1)
 console.log(JSON.stringify({status:'PASS',decodedImageBytes:bytes.length,chunkRequests:calls.filter(c=>c.method==='PATCH').length,jobPostBytes:calls.find(c=>c.method==='POST'&&c.url.includes('/jobs/')).bytes,generations,lostChunkAck:true,lostJobAck:true,foreignOwnerDenied:true,resultRecoveredWithoutUploadStore:true}))
}finally{
 uploads.close();await jobs.close();server.closeAllConnections();server.close();await once(server,'close')
 assert.equal(path.dirname(work),parent);assert.ok(path.basename(work).startsWith('cross-stack-'));fs.rmSync(work,{recursive:true,force:true})
}
