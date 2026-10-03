// Opt-in real HTTPS/model acceptance using only generated synthetic documents.
// The account and bearer credentials remain inside the native runtime.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {createRequire}=require('node:module')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const account=require('./helpers/native-qa-account.cjs')
if(!process.argv.includes('--run-production'))throw Error('Explicit --run-production required: this grades synthetic documents using the live AI.')
const outputIndex=process.argv.indexOf('--output')
if(outputIndex<0||!process.argv[outputIndex+1])throw Error('Pass --output <evidence directory>')
const output=path.resolve(process.argv[outputIndex+1])
const pdfInput=process.argv.includes('--pdf-input')
const backendRequire=createRequire('D:/CodexWork/stem-whole-paper-candidate/package.json')
const {PDFDocument,StandardFonts}=backendRequire('pdf-lib')
const {createCanvas}=backendRequire('@napi-rs/canvas')

async function reference(lines){
 const document=await PDFDocument.create(),font=await document.embedFont(StandardFonts.Helvetica)
 const page=document.addPage([595,842])
 lines.forEach((line,index)=>page.drawText(line,{x:40,y:780-index*30,size:15,font}))
 return Buffer.from(await document.save())
}
function image(lines){
 const canvas=createCanvas(600,800),context=canvas.getContext('2d')
 context.fillStyle='white';context.fillRect(0,0,600,800)
 context.fillStyle='#141b36';context.font='24px sans-serif'
 lines.forEach((line,index)=>context.fillText(line,35,70+index*48))
 return canvas.toBuffer('image/png')
}
async function operation(fn,label,timeout=70000){
 // Native HTTP/file operations can legitimately outlive the automator's
 // evaluation budget. Schedule them once, then observe their final state.
 await evaluate('function(){const q=getApp().__wholePaperLive;q.operation="pending";q.operationResult=null;('+fn.toString()+')().then(value=>{q.operationResult=value;q.operation="complete"}).catch(error=>{q.operationError=String(error.code||error.message||"request_failed").slice(0,200);q.operation="failed"});return true}')
 const state=await until(function(){const q=getApp().__wholePaperLive;return q&&q.operation!=='pending'?{status:q.operation,error:q.operationError||'',value:q.operationResult}:null},label,timeout)
 assert.equal(state.status,'complete',label+': '+state.error)
 return state.value
}
async function main(){
 fs.mkdirSync(output,{recursive:true})
 const materials=[
  {id:'answer-page-0001',role:'answer',kind:'image',name:'synthetic-answer-1.png',bytes:image(['Synthetic answer - page 1','Question 1','2x + 3 = 11','2x = 8','x = 4'])},
  {id:'answer-page-0002',role:'answer',kind:'image',name:'synthetic-answer-2.png',bytes:image(['Synthetic answer - page 2','Question 2','3(x + 2) = 3x + 2'])},
  {id:'question-paper-0001',role:'question-paper',kind:'pdf',name:'synthetic-question-paper.pdf',bytes:await reference(['Synthetic mathematics practice paper','1. Solve 2x + 3 = 11. Show working. [2]','2. Expand 3(x + 2). [2]','Total: 4 marks.'])},
  {id:'mark-scheme-0001',role:'mark-scheme',kind:'pdf',name:'synthetic-mark-scheme.pdf',bytes:await reference(['Synthetic mathematics mark scheme','Q1 M1: subtract 3 and divide by 2.','Q1 A1: x = 4. Maximum 2 marks.','Q2 M1: correct x term, 3x.','Q2 A1: correct constant term, +6.','Q2 maximum 2 marks. Correct expansion: 3x + 6.'])},
 ]
 if(pdfInput){
  const document=await PDFDocument.create()
  for(const answer of materials.slice(0,2)){const picture=await document.embedPng(answer.bytes);document.addPage([600,800]).drawImage(picture,{x:0,y:0,width:600,height:800})}
  materials.splice(0,2,{id:'answer-pdf-0001',role:'answer',kind:'pdf',name:'synthetic-answers.pdf',bytes:Buffer.from(await document.save())})
 }
 try{
  // Warm the newly compiled native view before the automator's navigation
  // command: otherwise a cold Developer Tools window can have no page meta.
  await evaluate(function(){return new Promise((resolve,reject)=>wx.reLaunch({url:'/pages/index/index',success:()=>resolve(true),fail:()=>reject(Error('Native Home initialization failed'))}))})
  await account.begin()
  console.log(JSON.stringify({phase:'isolated-account-ready'}))
  // The marking service lives in a WeChat subpackage; loading Home alone does
  // not register it in the native runtime, even though Node fixtures can load it.
  await call('automation_navigate',{action:'navigateTo',url:'/bundles/marking/index'})
  await until(function(){return getCurrentPages().at(-1)?.route==='bundles/marking/index'},'marking subpackage')
  console.log(JSON.stringify({phase:'marking-subpackage-ready'}))
  await evaluate(function(){const app=getApp();if(app.__wholePaperLive)throw Error('Another whole-paper QA is active');app.__wholePaperLive={inputs:[],ownedPaths:[],reports:[],states:[],phase:'prepare'};return true})
  for(const material of materials){
   const inputFile=path.join(output,'synthetic-input.json')
   fs.writeFileSync(inputFile,JSON.stringify([{id:material.id,role:material.role,kind:material.kind,name:material.name},material.bytes.toString('base64')]),'utf8')
   await call('automation_evaluate',{'args-file':inputFile,'fn-source':function(file,base64){
    return new Promise((resolve,reject)=>{
     const q=getApp().__wholePaperLive,manager=wx.getFileSystemManager()
     if(!q.folder){q.folder=wx.env.USER_DATA_PATH+'/qa-paper-'+Date.now();manager.mkdirSync(q.folder)}
     const destination=q.folder+'/'+file.name
     manager.writeFile({filePath:destination,data:wx.base64ToArrayBuffer(base64),success:()=>{q.inputs.push({...file,path:destination});q.ownedPaths.push(destination);resolve({saved:true})},fail:()=>reject(Error('Synthetic input write failed'))})
    })
   }.toString()})
  }
  await evaluate(function(){
   const q=getApp().__wholePaperLive,service=require('bundles/marking/service.js'),s=service.scope()
   q.scope=s;q.service=service
   q.draft={clientRequestId:'synthetic-native-paper-'+Date.now(),title:'Synthetic release acceptance',routeId:'cie-9709-as-p1-p2',files:[]}
   return true
  })
  for(let index=0;index<materials.length;index++){
   await evaluate('function(){getApp().__wholePaperLive.nextIndex='+index+';return true}')
   await operation(async function(){const q=getApp().__wholePaperLive,inspected=await q.service.inspect(q.inputs[q.nextIndex],q.scope);q.draft.files.push(inspected);q.ownedPaths.push(inspected.path);return {inspected:true}},'inspect synthetic input '+index)
  }
  await operation(async function(){const q=getApp().__wholePaperLive,created=await q.service.create(q.draft,q.scope);q.draft.jobId=created.jobId;q.assets=created.assets;q.states.push(created.status);return {created:true}},'create synthetic marking job')
  for(let index=0;index<materials.length;index++){
   await evaluate('function(){getApp().__wholePaperLive.nextIndex='+index+';return true}')
   await operation(async function(){const q=getApp().__wholePaperLive,file=q.draft.files[q.nextIndex];file.assetId=q.assets.find(a=>a.clientAssetId===file.id).assetId;await q.service.upload(q.draft.jobId,file,q.scope,{cancelled:()=>false});return {uploaded:true}},'upload synthetic input '+index)
  }
  await operation(async function(){
   const q=getApp().__wholePaperLive,submitted=await q.service.submit(q.draft,q.scope);q.states.push(submitted.status);q.phase='submitted'
   return {submitted:true,status:submitted.status,files:q.draft.files.length}
  },'submit synthetic marking job')
  const job=await until(async function(){
   const q=getApp().__wholePaperLive,value=await q.service.get(q.draft.jobId,q.scope)
   if(q.states.at(-1)!==value.status)q.states.push(value.status)
   if(!['completed','failed'].includes(value.status))return null
   q.job=value
   return {status:value.status,failureCode:value.failureCode||'',states:q.states,mode:value.result?.assessmentMode,score:value.result?.provisionalScore,maxScore:value.result?.maxScore,questionCount:value.result?.questionResults?.length||0,scoreReady:value.result?.scoreReady,missingPages:value.result?.missingPages||[],missingQuestions:value.result?.missingQuestions||[]}
  },'live whole-paper report',220000)
  assert.equal(job.status,'completed',JSON.stringify(job))
  assert.equal(job.questionCount,2)
  assert.equal(job.score,3,'Two synthetic answers should receive 2/2 and 1/2 under the supplied mark scheme')
  assert.equal(job.maxScore,4)
  assert.deepEqual(job.missingPages,[]);assert.deepEqual(job.missingQuestions,[])
  const report=await operation(async function(){
   const q=getApp().__wholePaperLive
   for(const kind of ['source','report'])q.reports.push(await q.service.download(q.job.jobId,kind,q.scope,'Synthetic '+kind))
   const manager=wx.getFileSystemManager(),values=[]
   for(const file of q.reports){const bytes=await new Promise((resolve,reject)=>manager.readFile({filePath:file,success:r=>resolve(r.data),fail:()=>reject(Error('Synthetic report read failed'))}));values.push({bytes:bytes.byteLength,base64:wx.arrayBufferToBase64(bytes)})}
   return values
  },'download synthetic source and AI report',150000)
  for(let index=0;index<report.length;index++){
   const bytes=Buffer.from(report[index].base64,'base64');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.equal(bytes.length,report[index].bytes);assert.ok(bytes.length>2000)
   fs.writeFileSync(path.join(output,index===0?'synthetic-source.pdf':'synthetic-report.pdf'),bytes)
  }
  const result={...job,jobStatus:job.status,status:'pass',nativeNetwork:true,nativeFilesystem:true,realProductionAI:true,studentDocumentsUsed:false,inputImages:pdfInput?0:2,inputPdfPages:pdfInput?2:0,referencePdfs:2,sourceBytes:report[0].bytes,reportBytes:report[1].bytes}
  fs.writeFileSync(path.join(output,'whole-paper-live.json'),JSON.stringify(result,null,2),'utf8')
  console.log(JSON.stringify(result))
 }finally{
  await evaluate(function(){const app=getApp(),q=app.__wholePaperLive;if(!q)return true;const manager=wx.getFileSystemManager(),partial=q.scope&&wx.getStorageSync('stemistDraft:whole-paper-download:'+q.scope.owner);const extra=partial?.owner===q.scope?.owner&&partial?.epoch===q.scope?.epoch&&typeof partial.filePath==='string'?[partial.filePath]:[];for(const file of [...q.ownedPaths,...q.reports,...extra])manager.unlink({filePath:file,success(){},fail(){}});delete app.__wholePaperLive;return true}).catch(()=>{})
  await account.end()
 }
}
main().catch(error=>{console.error(String(error.message||'Synthetic whole-paper QA failed'));process.exitCode=1})
