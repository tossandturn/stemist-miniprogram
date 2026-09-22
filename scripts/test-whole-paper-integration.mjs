// Actual Mini Program service -> local HTTP -> STEM API -> real PDF pipeline.
// Only the vision-model inference is a deterministic fixture; never production.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import http from 'node:http'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const backend=process.argv[process.argv.indexOf('--backend')+1]
if(!process.argv.includes('--backend')||!backend)throw Error('Pass --backend <reviewed local STEM worktree>')
const root=path.resolve(backend),require=createRequire(path.join(root,'package.json'))
const {createCanvas,loadImage}=require('@napi-rs/canvas')
const {createStemApi,closeStemDatabaseForTests}=await import(pathToFileURL(path.join(root,'server/stemApi.js')))
const {renderPdfToPageImages}=await import(pathToFileURL(path.join(root,'server/wholePaperArtifacts.js')))
const temp=fs.mkdtempSync('D:/CodexWork/whole-paper-integration-')
const signingKey='synthetic-whole-paper-integration-key'
const timestamp=Math.floor(Date.now()/1000)
const segment=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
const payload=segment({alg:'HS256',typ:'JWT'})+'.'+segment({iss:'ieltsist.com',aud:'stem.ieltsist.com',sub:'ielts:2101',username:'synthetic-integration',iat:timestamp,exp:timestamp+3600})
const token=payload+'.'+crypto.createHmac('sha256',signingKey).update(payload).digest('base64url')
let providerCalls=0
const api=createStemApi({env:{STEM_INTERNAL_AUTH_KEY:signingKey,STEM_DB_PATH:':memory:'},questionBank:[],wholePaperMarkingOptions:{
 storageRoot:path.join(temp,'private-jobs'),jobTimeoutMs:15000,
 runner:async({answerPages})=>{
  providerCalls++;assert.equal(answerPages.length,2);assert.ok(answerPages.every(p=>p.dataUrl.startsWith('data:image/jpeg;base64,')))
  return{summary:'Two answer pages reviewed. No reference supplied.',provisionalScore:null,maxScore:null,reviewRequired:true,missingPages:[],missingQuestions:[],questionResults:[{questionLabel:'1(a)',provisionalScore:null,maxScore:null,confidence:0.8,reviewRequired:true,rationale:'The working is legible; a mark scheme is needed to award marks.',evidence:['Answer page 1'],criteria:[]}]}
 },
}})
const server=http.createServer((req,res)=>Promise.resolve(api(req,res,()=>{res.statusCode=404;res.end()})).catch(()=>{res.statusCode=500;res.end('fixture API failed')}))
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin='http://127.0.0.1:'+server.address().port
const files=new Map(),calls=[]
for(let page=1;page<=2;page++){
 const canvas=createCanvas(600,800),ctx=canvas.getContext('2d')
 ctx.fillStyle='white';ctx.fillRect(0,0,600,800);ctx.fillStyle=page===1?'#173':'#137';ctx.font='28px sans-serif';ctx.fillText('Synthetic answer page '+page,30,80)
 files.set('/qa/answer-'+page+'.png',canvas.toBuffer('image/png'))
}
function localUrl(value){const url=new URL(value);assert.equal(url.hostname,'stem.ieltsist.com');return origin+url.pathname+url.search}
const runtime=miniRuntime({
 modules:{'utils/nativeSession':{refreshNativeSession:async()=>{},captureNativeCookie(){}},'utils/ieltsLearning':{}},
 wx:{env:{USER_DATA_PATH:'/qa/app'},getFileSystemManager:()=>({
  getFileInfo:({filePath,success,fail})=>files.has(filePath)?success({size:files.get(filePath).length}):fail(),
  readFile:({filePath,success,fail})=>{const b=files.get(filePath);if(!b)return fail();success({data:Uint8Array.from(b).buffer})},
  mkdirSync(){},accessSync(){},unlink:({filePath})=>files.delete(filePath),
 }),request:options=>{
  const controller=new AbortController();calls.push({method:options.method,url:new URL(options.url).pathname})
  const binary=Object.prototype.toString.call(options.data)==='[object ArrayBuffer]'
  fetch(localUrl(options.url),{method:options.method,headers:options.header,body:options.data===undefined?undefined:binary?Buffer.from(new Uint8Array(options.data)):JSON.stringify(options.data),signal:controller.signal})
   .then(async response=>options.success({statusCode:response.status,data:await response.json()})).catch(error=>options.fail({errMsg:error.message}))
  return{abort:()=>controller.abort()}
 },downloadFile:options=>{
  fetch(localUrl(options.url),{headers:options.header}).then(async response=>{
   files.set(options.filePath,Buffer.from(await response.arrayBuffer()));options.success({statusCode:response.status,filePath:options.filePath})
  }).catch(error=>options.fail({errMsg:error.message}))
 }},
})
runtime.storage.set('stemistUser',{id:'ielts:2101'});runtime.storage.set('stemistSessionToken',token)
try{
 const service=runtime.load('bundles/marking/service'),s=service.scope()
 const draft={clientRequestId:'whole-paper-cross-repo-0001',title:'Synthetic ordered image integration',routeId:'cie-9702-as-physics',files:[]}
 for(let n=1;n<=2;n++)draft.files.push(await service.inspect({id:'file-page-'+n,role:'answer',kind:'image',path:'/qa/answer-'+n+'.png',name:'answer-'+n+'.png'},s))
 const created=await service.create(draft,s);draft.jobId=created.jobId
 assert.equal(created.status,'draft')
 for(const f of draft.files){f.assetId=created.assets.find(a=>a.clientAssetId===f.id).assetId;await service.upload(draft.jobId,f,s,{cancelled:()=>false})}
 await service.submit(draft,s)
 const duplicate=await service.submit(draft,s);assert.ok(['queued','processing','completed'].includes(duplicate.status))
 let job
 const deadline=Date.now()+15000
 do{job=await service.get(draft.jobId,s);if(['completed','failed'].includes(job.status))break;await new Promise(resolve=>setTimeout(resolve,40))}while(Date.now()<deadline)
 assert.equal(job.status,'completed',job.failureCode)
 assert.equal(job.result.assessmentMode,'ai-advisory-unscored');assert.equal(job.result.provisionalScore,null);assert.equal(providerCalls,1)
 assert.equal(job.result.questionResults[0].questionLabel,'1(a)')
 const page=runtime.page('bundles/marking/index');page.onLoad();page.setJob(job)
 assert.equal(page.data.questions[0].questionId,'1(a)');assert.match(page.data.questions[0].feedback,/legible/);assert.equal(page.data.result.scoreReady,false)
 const source=await service.download(job.jobId,'source',s,'Synthetic answers')
 const report=await service.download(job.jobId,'report',s,'Synthetic report')
 for(const file of [source,report])assert.equal(files.get(file).subarray(0,5).toString(),'%PDF-')
 assert.ok(files.get(report).length>2000,'Report must contain more than an empty PDF envelope')
 const reportPages=await renderPdfToPageImages(files.get(report))
 assert.ok(reportPages.length>0)
 const firstImage=await loadImage(reportPages[0].bytes),canvas=createCanvas(firstImage.width,firstImage.height),ctx=canvas.getContext('2d')
 ctx.drawImage(firstImage,0,0)
 const pixels=ctx.getImageData(40,100,canvas.width-80,canvas.height-200).data
 let ink=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<180&&pixels[i+1]<180&&pixels[i+2]<180)ink++
 assert.ok(ink>1000,'Actual report body must render visible text, not only a header/footer')
 assert.ok((await service.list(s)).some(j=>j.jobId===job.jobId))
 const cancellable=await service.create({...draft,clientRequestId:'whole-paper-cancel-0001'},s)
 const cancelled=await service.cancel(cancellable.jobId,'cancel-request-fixture-0001',s)
 assert.equal(cancelled.status,'failed');assert.equal(cancelled.failureCode,'cancelled')
 await service.cancel(cancellable.jobId,'cancel-request-fixture-0001',s)
 assert.equal(providerCalls,1,'Unsubmitted cancellation never invokes the model')
 page.onUnload()
 console.log(JSON.stringify({status:'pass',realLocalHttp:true,clientService:true,serverApi:true,orderedImages:2,sourcePdfBytes:files.get(source).length,reportPdfBytes:files.get(report).length,providerCalls,model:'deterministic fixture, NOT live AI',requests:calls.length}))
}finally{
 await new Promise(resolve=>server.close(resolve));closeStemDatabaseForTests()
 const resolved=path.resolve(temp)
 if(path.dirname(resolved)==='D:\\CodexWork'&&path.basename(resolved).startsWith('whole-paper-integration-'))fs.rmSync(resolved,{recursive:true,force:true})
}
