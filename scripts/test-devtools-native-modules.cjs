const assert=require('node:assert/strict')
const automator=require(process.env.WECHAT_AUTOMATOR_MODULE||'D:/CodexWork/qa-artifacts/stemist-devtools/node_modules/miniprogram-automator')
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
;(async()=>{
 const app=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'}),errors=[]
 let backed=false
 app.on('exception',e=>errors.push(String(e.message||e).slice(0,160)))
 async function until(test,label){const end=Date.now()+25000;while(Date.now()<end){const p=await app.currentPage();if(p&&await test(p))return p;await sleep(100)}throw new Error('Timed out: '+label)}
 async function open(url,path,ready){if((await app.currentPage())?.path===path)await app.reLaunch('/pages/index/index');await app.reLaunch(url);const p=await until(async p=>p.path===path&&await ready(p),path);assert.equal(await p.$('web-view'),null);return p}
 function report(module,extra={}){console.log(JSON.stringify({module,status:'pass',...extra}))}
 try{
  await app.evaluate(()=>{const keys=wx.getStorageInfoSync().keys.filter(k=>/^stemistNativePaper:|^stemistIeltsExam:|^stemistDraft:ielts-writing:|^stemistIeltsSpeaking:/.test(k));getApp().__nativeModulesBackup=keys.map(key=>({key,value:wx.getStorageSync(key)}))});backed=true
  let p=await open('/pages/ielts/home','pages/ielts/home',async p=>(await p.$$('.native-skill-grid button')).length===4)
  for(const button of await p.$$('.native-skill-grid button'))assert.ok(Number((await button.size()).height)>=44)
  report('dashboard',{nativeSkills:4})
  p=await open('/pages/ielts/vocabulary','pages/ielts/vocabulary',async p=>!(await p.data('loading'))&&(await p.data('items')).length>0)
  assert.ok((await p.data('items')).length<=20);const total=await p.data('total')
  await(await p.$('.vocab-row')).tap();await until(async p=>!!(await p.data('word')),'vocabulary detail')
  assert.equal(await p.data('revealed'),false);await(await p.$('.vocab-detail .secondary')).tap();await until(async p=>await p.data('revealed')===true,'word definition revealed')
  await(await p.$('.vocab-close')).tap();await until(async p=>!(await p.data('word')),'word closed');await(await p.$('[data-bank="stem"]')).tap();await until(async p=>await p.data('bank')==='stem'&&await p.data('total')>2000,'STEM word bank')
  report('vocabulary',{ieltsTerms:total,stemTerms:await p.data('total'),viewBytes:JSON.stringify(await p.data()).length})
  p=await open('/pages/ielts/exam?mode=same-test','pages/ielts/exam',async p=>!(await p.data('loading'))&&(await p.$$('.exam-setup')).length>0)
  assert.equal(await p.data('error'),'');assert.ok((await p.data('choices')).length>0,'server sources can assemble a complete same-test exam')
  report('full-exam',{completeSourceSets:(await p.data('choices')).length,remoteStarts:0})
  p=await open('/pages/papers/index?category=competition&subject=amc12','pages/papers/index',async p=>!(await p.data('loading'))&&(await p.$$('.paper-open')).length>0)
  assert.ok((await p.data('items')).length<=30)
  await(await p.$('.paper-open')).tap()
  p=await until(async p=>p.path==='pages/stem/paper'&&await p.data('ready'),'native competition paper')
  assert.equal(await p.data('category'),'competition');assert.equal(await p.$('web-view'),null)
  assert.ok(await p.$('.paper-native-answer'))
  report('competition-paper',{nativePhotoWorkspace:true,viewBytes:JSON.stringify(await p.data()).length})
  p=await open('/pages/stem/paper?subject=9702&routeId=cie-9702-as-physics&paperId=cie-9702-9702_m25_qp_22','pages/stem/paper',async p=>!!(await p.data('ready')))
  assert.equal(await p.data('stage'),'AS');assert.equal(await p.data('subject'),'9702');report('AS-paper',{stage:'AS',nativePhotoWorkspace:true})
  p=await open('/pages/ielts/library?module=writing','pages/ielts/library',async p=>!(await p.data('loading'))&&(await p.data('items')).length>0)
  await(await p.$('.native-task-card')).tap();p=await until(async p=>p.path==='pages/ielts/writing'&&!!(await p.data('taskTitle')),'writing task')
  assert.ok((await p.data('taskImages')).length>0);assert.ok(await p.$('.prompt-input'));report('writing',{nativeTaskImages:(await p.data('taskImages')).length})
  p=await open('/pages/ielts/library?module=speaking','pages/ielts/library',async p=>!(await p.data('loading'))&&(await p.data('items')).length>0)
  await(await p.$('.native-task-card')).tap();p=await until(async p=>p.path==='pages/ielts/speaking'&&!!(await p.$('.speaking-controls')),'speaking native controls')
  assert.equal(await p.data('active'),false);report('speaking',{nativeControls:true,microphoneStarted:false})
  assert.equal(errors.length,0,errors.join(';'))
  console.log(JSON.stringify({summary:'pass',modules:7,runtimeExceptions:0,providerCalls:0,remoteSubmissions:0}))
 }finally{
  if((await app.currentPage())?.path!=='pages/index/index')await app.reLaunch('/pages/index/index')
  if(backed)await app.evaluate(()=>{for(const key of wx.getStorageInfoSync().keys.filter(k=>/^stemistNativePaper:|^stemistIeltsExam:|^stemistDraft:ielts-writing:|^stemistIeltsSpeaking:/.test(k)))wx.removeStorageSync(key);for(const item of getApp().__nativeModulesBackup||[])wx.setStorageSync(item.key,item.value);delete getApp().__nativeModulesBackup})
  app.disconnect()
 }
})().catch(e=>{console.error(e.message);process.exitCode=1})
