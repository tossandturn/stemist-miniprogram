// Opt-in production acceptance with an isolated account and synthetic photographs.
// Only the camera hardware is substituted; crop, transport, model and records are real.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {call,evaluate,until} = require('./helpers/wechat-cli.cjs')
const account = require('./helpers/native-qa-account.cjs')
const fixtureFile = process.argv[process.argv.indexOf('--fixtures')+1]
const output = process.argv[process.argv.indexOf('--output')+1]
if (!process.argv.includes('--run-production') || !fixtureFile || !output) {
  console.error('Use --run-production --fixtures <synthetic args JSON> --output <QA directory>')
  process.exit(2)
}
const fixture = JSON.parse(fs.readFileSync(fixtureFile,'utf8'))[0]
fs.mkdirSync(output,{recursive:true})
const tap = selector => call('automation_element_action',{action:'tap',selector,'wait-for-selector':selector})
const input = (selector,value) => call('automation_element_action',{action:'input',selector,value,'wait-for-selector':selector})
const screenshot = name => call('simulator_screenshot',{path:path.resolve(output,name+'.png')})
const pageIs = route => until('function(){const p=getCurrentPages().slice(-1)[0];return p&&p.route==='+JSON.stringify(route)+'}',route)
const evidence = {hardware:'synthetic camera fixture; not a physical-device test',network:'real production APIs; no AI mocks',submission:'native page submit method; custom-component button hit target not covered'}
let cameraMocked = false

async function capture(kind) {
  await evaluate('function(){getApp().__nativeQa.fixtureKind='+JSON.stringify(kind)+';return true}')
  await pageIs('pages/stem/camera')
  await tap('.camera-shutter')
  await pageIs('pages/crop/crop')
  await screenshot(kind+'-crop')
  await tap('.crop-page .primary')
}

async function run() {
  try {
    await account.begin()
    console.log('Isolated QA account ready; user state retained in runtime memory.')
    await call('automation_evaluate',{'args-file':path.resolve(fixtureFile),'fn-source':function(data){
      const qa=getApp().__nativeQa,manager=wx.getFileSystemManager()
      qa.fixturePaths={};qa.createdFiles=[]
      for(const kind of ['writing','stem']){
        const file=wx.env.USER_DATA_PATH+'/qa-photo-'+Date.now()+'-'+kind+'.png'
        let exists=false;try{manager.accessSync(file);exists=true}catch{}
        if(exists)throw Error('Fixture filename already exists')
        manager.writeFileSync(file,data[kind].base64,'base64')
        qa.fixturePaths[kind]=file;qa.createdFiles.push(file)
      }
      return {created:true}
    }.toString()})
    await call('automation_wx_api',{action:'mock',method:'createCameraContext','function-declaration':function(){
      return {takePhoto:function(options){const qa=getApp().__nativeQa;options.success({tempImagePath:qa.fixturePaths[qa.fixtureKind]})}}
    }.toString()})
    cameraMocked=true
    if(!process.argv.includes('--stem-only')){
    await call('automation_navigate',{action:'navigateTo',url:'/pages/ielts/writing'})
    await input('.prompt-input',fixture.prompt)
    await tap('.writing-editor [data-mode="photo"]')
    await tap('.photo-button')
    await capture('writing')
    await pageIs('pages/ielts/writing')
    const writingInput=await evaluate(function(){
      const p=getCurrentPages().slice(-1)[0],q=getApp().__nativeQa
      if(p.data.photoPath)q.createdFiles.push(p.data.photoPath)
      return {photo:Boolean(p.data.photoPath),mode:p.data.inputMode,textEmpty:p.data.text==='',error:p.data.error}
    })
    assert.deepEqual(writingInput,{photo:true,mode:'photo',textEmpty:true,error:''})
    await screenshot('writing-photo-input')
    if(process.argv.includes('--camera-only')){console.log('PASS: synthetic camera -> real crop -> owned native photo input (no AI call).');return}
    await evaluate(function(){getCurrentPages().slice(-1)[0].submit();return {scheduled:true}})
    await until(function(){const p=getCurrentPages().slice(-1)[0];if(!p.__jobId)return null;getApp().__nativeQa.expectedJob=p.__jobId;return {created:true}},'owned Writing job started')
    await call('automation_navigate',{action:'navigateBack'})
    await call('automation_navigate',{action:'navigateTo',url:'/pages/ielts/writing'})
    await until(function(){const p=getCurrentPages().slice(-1)[0];return p.data.loading&&p.__jobId===getApp().__nativeQa.expectedJob},'resume the same job without reupload')
    evidence.resumedSameJob=true
    console.log('Writing photo submitted through the native page; waiting for the real vision model.')
    const writing=await until(function(){
      const p=getCurrentPages().slice(-1)[0]
      if(p.route!=='pages/ielts/writing'||p.data.loading)return null
      return {band:p.data.band,criteria:p.data.criteria.length,status:p.data.coachStatus,error:p.data.error,answerLength:p.data.answer.length,warning:p.data.warning}
    },'real Writing vision feedback',220000)
    evidence.writing=writing
    console.log(JSON.stringify({writing}))
    await call('automation_viewport_action',{action:'pageScrollTo','scroll-top':500})
    await screenshot('writing-feedback')
    assert.equal(writing.error,'')
    assert.ok(writing.answerLength>100,'The model must return useful feedback')
    await evaluate(function(){
      const qa=getApp().__nativeQa,record=wx.getStorageSync('stemistSubmission:writing'),session=wx.getStorageSync('stemistIeltsSessionState')
      if(!record?.id||session?.owner!==qa.id||!session.token)throw Error('Owned Writing job/session missing')
      const id=record.id.replace(/^writing-/,'')
      qa.visionProof={status:'pending'}
      wx.request({url:'https://ieltsist.com/api/writing/feedback/job/'+encodeURIComponent(id),header:{Authorization:'Bearer '+session.token,'X-Stemist-Native':'1'},success:function(response){
        const r=response.data?.result||{}
        const essay=String(r.contract?.attempt?.items?.[0]?.response||'')
        qa.visionProof={status:'done',http:response.statusCode,mode:r.mode||'',images:r.provenance?.studentImagesSubmitted||0,pixelsRead:/24\s+computers/.test(essay),essayLength:essay.length,reviewRequired:r.analysis?.reviewRequired===true,reason:String(r.analysis?.reviewReason||'').slice(0,300),confidence:r.analysis?.confidence||'',criteria:r.analysis?.criteria?.map(c=>({label:c.label,score:c.score,evidencePresent:Boolean(c.evidence)})),contractReview:r.contract?.review,model:r.provenance?.model||''}
      },fail:function(){qa.visionProof={status:'error'}}})
      return {scheduled:true}
    })
    const proof=await until(function(){const p=getApp().__nativeQa.visionProof;return p.status!=='pending'?p:null},'owned image evidence')
    evidence.vision=proof
    fs.writeFileSync(path.resolve(output,'latest-writing-diagnostic.json'),JSON.stringify({writing,vision:proof},null,2)+'\n','utf8')
    console.log(JSON.stringify({vision:proof}))
    assert.equal(proof.http,200);assert.ok(proof.mode.startsWith('ai:'));assert.equal(proof.images,1);assert.equal(proof.pixelsRead,true,'Model must read the unique phrase visible only in pixels')
    assert.equal(writing.criteria,4);assert.equal(typeof writing.band,'number')
    await evaluate(function(){
      const qa=getApp().__nativeQa,record=wx.getStorageSync('stemistSubmission:writing'),session=wx.getStorageSync('stemistIeltsSessionState');qa.cloudProof={status:'pending'}
      wx.request({url:'https://ieltsist.com/api/learning/attempts/'+encodeURIComponent(record.id),header:{Authorization:'Bearer '+session.token,'X-Stemist-Native':'1'},success:function(response){const a=response.data?.attempt||{};qa.cloudProof={status:'done',http:response.statusCode,ownedId:a.id===record.id||a.attemptId===record.id,images:a.result?.provenance?.studentImagesSubmitted||0,mode:a.result?.mode||'',band:a.score?.band}},fail:function(){qa.cloudProof={status:'error'}}})
      return {scheduled:true}
    })
    const cloud=await until(function(){const p=getApp().__nativeQa.cloudProof;return p.status!=='pending'?p:null},'owned cloud Writing record')
    evidence.cloud=cloud;console.log(JSON.stringify({cloud}));assert.equal(cloud.http,200);assert.equal(cloud.ownedId,true);assert.equal(cloud.images,1)
    fs.writeFileSync(path.resolve(output,'writing-acceptance.json'),JSON.stringify({writing,vision:proof,cloud,resumedSameJob:true},null,2)+'\n','utf8')
    console.log('Writing photograph reached the real model and the visible-only phrase was recovered.')
    }

    await evaluate(function(){
      wx.setStorageSync('stemistCameraReturn',{route:'stem',context:{category:'alevel',family:'exam',subjectCode:'9709',stage:'AS',routeId:'cie-9709-as-p1-p2'},createdAt:Date.now()})
      return true
    })
    await call('automation_navigate',{action:'navigateTo',url:'/pages/stem/camera'})
    await capture('stem')
    await pageIs('pages/stem/coach')
    await evaluate(function(){const p=getCurrentPages().slice(-1)[0];if(p.data.imagePath)getApp().__nativeQa.createdFiles.push(p.data.imagePath);return {photo:Boolean(p.data.imagePath)}})
    await evaluate(function(){const p=getCurrentPages().slice(-1)[0];p.onMessage({detail:{value:'Check the working in my photograph. Is the answer correct?'}});p.ask();return {scheduled:true}})
    console.log('STEM photograph submitted; waiting for the real AI Coach.')
    const stem=await until(function(){const p=getCurrentPages().slice(-1)[0];if(p.route!=='pages/stem/coach'||p.data.loading)return null;return {error:p.data.error,status:p.data.coachStatus,answerLength:p.data.answer.length,containsAnswer:/x\s*(?:=|equals|等于)\s*2/i.test(p.data.answer),syncStatus:p.data.syncStatus,warning:p.data.warning}},'real STEM photo Coach',70000)
    evidence.stem=stem
    console.log(JSON.stringify({stem}))
    await call('automation_viewport_action',{action:'pageScrollTo','scroll-top':400})
    await screenshot('stem-feedback')
    assert.equal(stem.error,'');assert.ok(stem.answerLength>40);assert.equal(stem.containsAnswer,true)
    fs.writeFileSync(path.resolve(output,'acceptance.json'),JSON.stringify(evidence,null,2)+'\n','utf8')
    console.log('PASS: '+(process.argv.includes('--stem-only')?'STEM photo Coach':'native crop -> real multimodal Writing and STEM Coach')+'.')
  } finally {
    if(cameraMocked)await call('automation_wx_api',{action:'restore',method:'createCameraContext'}).catch(()=>{})
    await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'}).catch(()=>{})
    await evaluate(function(){
      const qa=getApp().__nativeQa;if(!qa)return {cleaned:false}
      const manager=wx.getFileSystemManager(),base=wx.env.USER_DATA_PATH+'/'
      // Only files created and tracked by this isolated fixture run are removed.
      for(const file of new Set(qa.createdFiles||[]))if(file.startsWith(base)&&(/\/qa-photo-[^/]+\.png$/.test(file)||/\/native-writing\/writing-[a-z0-9-]+\.jpg$/.test(file))){try{manager.unlinkSync(file)}catch{}}
      return {cleaned:true}
    }).catch(()=>{})
    await account.end()
  }
}
run().catch(error=>{console.error(String(error.message).replace(/Bearer\s+\S+|sk-[A-Za-z0-9_-]+/g,'[redacted]'));process.exitCode=1})
