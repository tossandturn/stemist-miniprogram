// Explicit production QA: one isolated account, one synthetic objective
// submission. Credentials remain inside the Mini Program runtime. No real
// student's files are uploaded or deleted, and app storage is restored.
const assert=require('node:assert/strict')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
if(!process.argv.includes('--run-production'))throw Error('Use --run-production explicitly; this creates an isolated QA account.')
;(async()=>{
 let backed=false
 try{
  const current=await evaluate(function(){return getCurrentPages().slice(-1)[0].route})
  if(current!=='pages/index/index')await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'})
  await evaluate(function(){
   const app=getApp(),keys=wx.getStorageInfoSync().keys.filter(k=>k.indexOf('stemist')===0)
   app.__nativeQa={status:'preparing',backup:keys.map(key=>({key,value:wx.getStorageSync(key)}))}
   const fail=code=>{app.__nativeQa.status='failed';app.__nativeQa.error=code}
   wx.getRandomValues({length:32,success:function(random){
    const password=Array.from(new Uint8Array(random.randomValues)).map(v=>v.toString(16).padStart(2,'0')).join('')
    const username='qa_'+Date.now().toString(36)+'_'+password.slice(0,6)
    wx.request({url:'https://stem.ieltsist.com/api/auth/register',method:'POST',timeout:15000,header:{'content-type':'application/json'},data:{username,password},success:function(r){
     const p=r.data||{},user=p.identity||p.user||{},id=String(p.id||user.id||'')
     if(r.statusCode!==200||!p.accessToken||!/^ielts:\d+$/.test(id))return fail('registration_'+r.statusCode)
     const cookies=(r.cookies||[r.header?.['Set-Cookie']||r.header?.['set-cookie']||'']).join(';'),cookie=cookies.match(/stem_session=([a-zA-Z0-9_-]+)/)
     app.__nativeQa.cookie=cookie?.[1]||'';app.__nativeQa.token=p.accessToken;app.__nativeQa.id=id
     wx.setStorageSync('stemistPrivacyEpoch',(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)+1)
     wx.setStorageSync('stemistUser',{id,username,roles:['student']});wx.setStorageSync('stemistSessionToken',p.accessToken)
     wx.setStorageSync('stemistSessionMeta',{kind:'password',owner:id,expiresAt:p.expiresAt});wx.setStorageSync('stemistNativeSessionCookie',app.__nativeQa.cookie)
     wx.removeStorageSync('stemistIeltsSessionState');app.__nativeQa.status='ready'
    },fail:function(){fail('registration_network')}})
   },fail:function(){fail('secure_random')}})
   return {scheduled:true}
  });backed=true
  const auth=await until(function(){const q=getApp().__nativeQa;return q&&q.status!=='preparing'?{status:q.status,error:q.error||''}:null},'isolated account',20000)
  assert.equal(auth.status,'ready',auth.error)
  console.log(JSON.stringify({step:'isolated-account',status:'pass',credentialsPrinted:false}))
  const started=Date.now()
  await call('automation_navigate',{action:'navigateTo',url:'/pages/ielts/reading?taskId=cam15-r-test1&section=2'})
  const ready=await until(function(){const p=getCurrentPages().slice(-1)[0];return p.route==='pages/ielts/reading'&&!p.data.loading?{total:p.data.total,number:p.data.questions[0]?.number,error:p.data.error}:null},'section workspace')
  assert.equal(ready.total,13);assert.equal(ready.number,14);assert.equal(ready.error,'')
  console.log(JSON.stringify({step:'source-bound-section',status:'pass',openAndReadyMs:Date.now()-started,firstQuestion:14,questions:13}))
  await call('automation_element_action',{action:'tap',selector:'.objective-jumps [data-target="answer"]'})
  await call('automation_element_action',{action:'input',selector:'.objective-input',value:'native-qa-response'})
  await call('automation_element_action',{action:'tap',selector:'.objective-answer .primary'})
  const result=await until(function(){const p=getCurrentPages().slice(-1)[0];return !p.data.busy&&(p.data.submitted||p.data.error)?{submitted:p.data.submitted,result:p.data.result,error:p.data.error}:null},'real objective scoring',30000)
  assert.equal(result.submitted,true,result.error)
  assert.equal(result.result.answerAvailable,true,'source answer keys must actually be available')
  assert.equal(result.result.total,13);assert.equal(result.result.band,null,'a section is not a complete Reading Band')
  console.log(JSON.stringify({step:'real-objective-score',status:'pass',correct:result.result.correct,total:13,fullBandSuppressed:true}))
  await evaluate(function(){
   const app=getApp(),session=wx.getStorageSync('stemistIeltsSessionState');app.__nativeQa.cloud=null
   wx.request({url:'https://ieltsist.com/api/learning/state',method:'GET',timeout:12000,header:{Authorization:'Bearer '+session.token,'X-Stemist-Native':'1'},success:function(r){app.__nativeQa.cloud={status:r.statusCode,matchingRecords:(r.data?.attempts||[]).filter(a=>a.module==='reading'&&String(a.itemId).indexOf('cam15-r-test1')===0).length}},fail:function(){app.__nativeQa.cloud={status:0}}})
   return {started:true}
  })
  const cloud=await until(function(){return getApp().__nativeQa.cloud},'cloud record',15000)
  console.log(JSON.stringify({step:'cloud-record',...cloud}))
  assert.equal(cloud.status,200);assert.ok(cloud.matchingRecords>0,'completed work must be available to another device')
 }finally{
  if(backed){
   await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'}).catch(()=>{})
   await evaluate(function(){
    const app=getApp(),q=app.__nativeQa;if(!q)return
    const session=wx.getStorageSync('stemistIeltsSessionState')
    if(session?.owner===q.id&&session.token)wx.request({url:'https://ieltsist.com/api/logout',method:'POST',header:{Authorization:'Bearer '+session.token},data:{}})
    if(q.cookie)wx.request({url:'https://stem.ieltsist.com/api/auth/logout',method:'POST',header:{Cookie:'stem_session='+q.cookie},data:{}})
    // Storage only: do not invoke logout cleanup that would delete files.
    for(const key of wx.getStorageInfoSync().keys.filter(k=>k.indexOf('stemist')===0))wx.removeStorageSync(key)
    for(const item of q.backup)wx.setStorageSync(item.key,item.value)
    delete app.__nativeQa
    return {restored:true}
   })
  }
 }
})().catch(e=>{console.error(e.message);process.exitCode=1})
