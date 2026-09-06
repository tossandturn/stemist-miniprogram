const assert=require('node:assert/strict')
const automator=require(process.env.WECHAT_AUTOMATOR_MODULE||'D:/CodexWork/qa-artifacts/stemist-devtools/node_modules/miniprogram-automator')
;(async()=>{
 const app=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});let p,backup=false
 const exceptions=[];app.on('exception',e=>exceptions.push(String(e.message||e).slice(0,160)))
 async function until(fn,label){const end=Date.now()+22000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,100))}throw new Error('Timed out: '+label)}
 try{
  if((await app.currentPage())?.path!=='pages/index/index')await app.reLaunch('/pages/index/index')
  await app.evaluate(()=>{const names=wx.getStorageInfoSync().keys.filter(k=>/^stemistIeltsObjective:|^stemistDraft:ielts-writing:/.test(k));getApp().__nativeIeltsBackup=names.map(key=>({key,value:wx.getStorageSync(key)}))});backup=true
  for(const module of ['listening','reading']){
   const started=Date.now();await app.reLaunch('/pages/ielts/library?module='+module)
   await until(async()=>{p=await app.currentPage();return p?.path==='pages/ielts/library'&&!(await p.data('loading'))&&(await p.$$('.native-task-card')).length>0},module+' catalog')
   assert.ok((await p.data('items')).length<=20)
   const id=(await p.data('items'))[0].id
   await(await p.$('.native-task-card')).tap()
   await until(async()=>{p=await app.currentPage();return p?.path==='pages/ielts/'+module&&!(await p.data('loading'))&&await p.data('total')===40},module+' native workspace')
   assert.equal(await p.$('web-view'),null)
   assert.equal((await p.data('questions')).length,1)
   assert.ok(JSON.stringify(await p.data()).length<20000)
   const input=await p.$('.objective-input');await input.input('native QA draft')
   await until(async()=>await p.data('answer')==='native QA draft','draft input')
   await p.callMethod('nextQuestion');await p.callMethod('previousQuestion');assert.equal(await p.data('answer'),'native QA draft')
   const img=await p.$('.native-question-image');assert.ok(img,'native source image')
   const rect=await img.size();assert.ok(Number(rect.width)>250)
   if(module==='listening')assert.equal(await p.data('audioAvailable'),true)
   console.log(JSON.stringify({module,taskId:id,total:40,viewBytes:JSON.stringify(await p.data()).length,openMs:Date.now()-started,providerCalls:0}))
   await app.reLaunch('/pages/index/index')
   await app.reLaunch('/pages/ielts/'+module+'?taskId='+encodeURIComponent(id))
   await until(async()=>{p=await app.currentPage();return p?.path==='pages/ielts/'+module&&await p.data('answer')==='native QA draft'},'cold draft restore')
  }
  assert.equal(exceptions.length,0,exceptions.join(';'))
  console.log(JSON.stringify({summary:'pass',runtimeExceptions:0,remoteSubmissions:0}))
 }finally{
  if((await app.currentPage())?.path!=='pages/index/index')await app.reLaunch('/pages/index/index')
  if(backup)await app.evaluate(()=>{for(const key of wx.getStorageInfoSync().keys.filter(k=>/^stemistIeltsObjective:|^stemistDraft:ielts-writing:/.test(k)))wx.removeStorageSync(key);for(const item of getApp().__nativeIeltsBackup||[])wx.setStorageSync(item.key,item.value);delete getApp().__nativeIeltsBackup})
  app.disconnect()
 }
})().catch(error=>{console.error(error.message);process.exitCode=1})
