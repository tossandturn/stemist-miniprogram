const {call,evaluate,until}=require('./wechat-cli.cjs')
async function begin(){
 await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'})
 await evaluate(function(){
  const app=getApp()
  if(app.__nativeQa)throw Error('Another native QA flow is active')
  const keys=wx.getStorageInfoSync().keys.filter(k=>k.indexOf('stemist')===0)
  app.__nativeQa={status:'preparing',backup:keys.map(key=>({key,value:wx.getStorageSync(key)}))}
  const fail=code=>{app.__nativeQa.status='failed';app.__nativeQa.error=code}
  wx.getRandomValues({length:32,success:function(random){
   const password=Array.from(new Uint8Array(random.randomValues)).map(v=>v.toString(16).padStart(2,'0')).join('')
   const username='qa_'+Date.now().toString(36)+'_'+password.slice(0,6)
   wx.request({url:'https://stem.ieltsist.com/api/auth/register',method:'POST',timeout:15000,header:{'content-type':'application/json'},data:{username,password},success:function(response){
    const payload=response.data||{},identity=payload.identity||payload.user||{},id=String(payload.id||identity.id||'')
    if(response.statusCode!==200||!payload.accessToken||!/^ielts:\d+$/.test(id))return fail('registration_'+response.statusCode)
    const cookies=(response.cookies||[response.header?.['Set-Cookie']||response.header?.['set-cookie']||'']).join(';'),cookie=cookies.match(/stem_session=([a-zA-Z0-9_-]+)/)
    app.__nativeQa.cookie=cookie?.[1]||'';app.__nativeQa.id=id
    wx.setStorageSync('stemistPrivacyEpoch',(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)+1)
    wx.setStorageSync('stemistUser',{id,username,roles:['student']});wx.setStorageSync('stemistSessionToken',payload.accessToken)
    wx.setStorageSync('stemistSessionMeta',{kind:'password',owner:id,expiresAt:payload.expiresAt})
    wx.setStorageSync('stemistNativeSessionCookie',app.__nativeQa.cookie);wx.removeStorageSync('stemistIeltsSessionState')
    app.__nativeQa.status='ready'
   },fail:function(){fail('registration_network')}})
  },fail:function(){fail('secure_random')}})
  return {scheduled:true}
 })
 const state=await until(function(){const q=getApp().__nativeQa;return q&&q.status!=='preparing'?{status:q.status,error:q.error||''}:null},'isolated QA account',20000)
 if(state.status!=='ready')throw Error(state.error)
}
async function end(){
 await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'}).catch(()=>{})
 await evaluate(function(){
  const app=getApp(),qa=app.__nativeQa;if(!qa)return {restored:false}
  const session=wx.getStorageSync('stemistIeltsSessionState')
  if(session?.owner===qa.id&&session.token)wx.request({url:'https://ieltsist.com/api/logout',method:'POST',header:{Authorization:'Bearer '+session.token},data:{}})
  if(qa.cookie)wx.request({url:'https://stem.ieltsist.com/api/auth/logout',method:'POST',header:{Cookie:'stem_session='+qa.cookie},data:{}})
  for(const key of wx.getStorageInfoSync().keys.filter(k=>k.indexOf('stemist')===0))wx.removeStorageSync(key)
  for(const item of qa.backup)wx.setStorageSync(item.key,item.value)
  delete app.__nativeQa
  return {restored:true}
 })
}
module.exports={begin,end}
