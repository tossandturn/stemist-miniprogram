// Opt-in DevTools UI acceptance. All storage and media APIs use memory-only
// fixtures. Never clear, snapshot, or seed the learner's real device storage.
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const output=process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:''
if(!output){console.error('Use --output <QA directory>');process.exit(2)}
const tap=selector=>call('automation_element_action',{action:'tap',selector,'wait-for-selector':selector})
const shot=name=>call('simulator_screenshot',{path:path.resolve(output,name+'.png'),optimize:false})
const mocked=[]
async function mock(method,fn){await call('automation_wx_api',{action:'mock',method,'function-declaration':fn.toString()});mocked.push(method)}
async function run(){
 const current=await call('automation_runtime_info',{action:'currentPage'})
 assert.equal(current.currentPage?.path,'pages/index/index','Begin on Home; do not interrupt an active practice')
 fs.mkdirSync(output,{recursive:true})
 await evaluate(function(){
  if(getApp().__speechPermissionQA)throw Error('A permission QA run is already active')
  const record={sessionId:'qa-permission-session',epoch:0,taskId:'',taskTitle:'权限恢复测试 · 模拟记录',turns:Array.from({length:150},(_,i)=>({role:i%2?'assistant':'user',text:'模拟对话 '+i,at:i})),feedback:'模拟旧反馈：授权失败后仍应保留。',band:7,elapsed:90}
  getApp().__speechPermissionQA={store:{'stemistIeltsSpeaking:guest:general':record},original:JSON.stringify(record),mini:false,system:'authorized',privacy:false,media:0,socket:0,authorize:0,settings:0}
  return {fixtureCreated:true}
 })
 try{
  await mock('getStorageSync',function(key){return getApp().__speechPermissionQA.store[key]})
  await mock('setStorageSync',function(key,value){getApp().__speechPermissionQA.store[key]=JSON.parse(JSON.stringify(value))})
  await mock('removeStorageSync',function(key){delete getApp().__speechPermissionQA.store[key]})
  await mock('getStorageInfoSync',function(){return {keys:Object.keys(getApp().__speechPermissionQA.store)}})
  await mock('getPrivacySetting',function(){return {needAuthorization:getApp().__speechPermissionQA.privacy,privacyContractName:'测试隐私指引'}})
  // This DevTools SDK treats the newer synchronous API as async when mocked.
  // Override only this function in AppService, and restore it in finally.
  await evaluate(function(){const q=getApp().__speechPermissionQA;q.appAuthorizeOriginal=wx.getAppAuthorizeSetting;wx.getAppAuthorizeSetting=function(){return {microphoneAuthorized:getApp().__speechPermissionQA.system}};return true})
  await mock('getSetting',function(){return {authSetting:{'scope.record':getApp().__speechPermissionQA.mini}}})
  await mock('authorize',function(){getApp().__speechPermissionQA.authorize++;throw Error('authorize:fail auth deny')})
  await mock('getRecorderManager',function(){getApp().__speechPermissionQA.media++;throw Error('Unexpected recorder in permission-denied test')})
  await mock('createWebAudioContext',function(){getApp().__speechPermissionQA.media++;throw Error('Unexpected playback in permission-denied test')})
  await mock('connectSocket',function(){getApp().__speechPermissionQA.socket++;throw Error('Unexpected socket in permission-denied test')})
  await mock('openSetting',function(){const q=getApp().__speechPermissionQA;q.settings++;q.mini=true;return {authSetting:{'scope.record':true}}})
  assert.equal(await evaluate(function(){return wx.getStorageSync('stemistIeltsSpeaking:guest:general')?.sessionId==='qa-permission-session'}),true,'storage fixture must be active before opening the page')
  await call('automation_navigate',{action:'navigateTo',url:'/pages/ielts/speaking'})
  console.log(JSON.stringify(await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {phase:'loaded',route:p.route,turnCount:p.data.turnCount,newPermissionUI:Object.prototype.hasOwnProperty.call(p.data,'permissionAction')}})))
  await tap('.speaking-start')
  const denied=await until(function(){const p=getCurrentPages().slice(-1)[0];return p.data.permissionAction==='mini'?{feedback:p.data.feedback,turnCount:p.data.turnCount,rendered:p.data.turns.length,action:p.data.permissionAction,active:p.data.active}:null},'microphone recovery button')
  assert.equal(denied.feedback,'模拟旧反馈：授权失败后仍应保留。');assert.equal(denied.turnCount,150);assert.equal(denied.rendered,12);assert.equal(denied.active,false)
  await shot('mock-microphone-denied-phone')
  await tap('.microphone-settings')
  const restored=await evaluate(function(){const q=getApp().__speechPermissionQA,p=getCurrentPages().slice(-1)[0];return {media:q.media,socket:q.socket,authorize:q.authorize,settings:q.settings,active:p.data.active,action:p.data.permissionAction,unchanged:JSON.stringify(q.store['stemistIeltsSpeaking:guest:general'])===q.original}})
  assert.deepEqual(restored,{media:0,socket:0,authorize:0,settings:1,active:false,action:'',unchanged:true})
  assert.equal(await evaluate(function(){getApp().__speechPermissionQA.system='denied';return wx.getAppAuthorizeSetting().microphoneAuthorized}),'denied')
  await tap('.speaking-start')
  assert.equal(await evaluate(function(){return getCurrentPages().slice(-1)[0].data.permissionAction}),'system')
  await shot('mock-system-permission-phone')
  await evaluate(function(){const q=getApp().__speechPermissionQA;q.system='authorized';q.privacy=true;return true})
  await tap('.speaking-start')
  assert.equal(await evaluate(function(){return getCurrentPages().slice(-1)[0].data.permissionAction}),'privacy')
  await call('automation_page_action',{action:'querySelector',selector:'#speaking-privacy-agree'})
  await shot('mock-privacy-permission-phone')
  // Do not click actual privacy consent. This test only checks its recovery UI.
  await call('automation_navigate',{action:'navigateBack'})
  const integrity=await evaluate(function(){const q=getApp().__speechPermissionQA;return {unchanged:JSON.stringify(q.store['stemistIeltsSpeaking:guest:general'])===q.original,media:q.media,socket:q.socket}})
  assert.deepEqual(integrity,{unchanged:true,media:0,socket:0})
  for(const module of ['writing','speaking']){
   await call('automation_navigate',{action:'navigateTo',url:'/pages/ielts/library?module='+module})
   await until(function(){const p=getCurrentPages().slice(-1)[0];return !p.data.loading},'source topic directory')
   if(module==='writing')await tap('[data-scope="topic"]')
   const directory=await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {module:p.data.module,topics:p.data.topics.map(t=>({key:t.key,count:t.count,icon:t.icon})),taskCount:p.__tasks.length}})
   assert.ok(directory.topics.length>0);assert.ok(directory.topics.every(t=>t.icon.startsWith('/design-system/topic-icons/')))
   if(module==='writing')assert.equal(directory.taskCount,144)
   await shot(module+'-topic-icons-phone')
   await tap('.native-topic-card')
   const selected=await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {count:p.data.items.length,topic:p.data.topic,idsValid:p.data.items.every(t=>p.__tasks.some(source=>source.id===t.id))}})
   assert.ok(selected.count>0);assert.ok(selected.topic);assert.equal(selected.idsValid,true)
   await call('automation_navigate',{action:'navigateBack'})
  }
  console.log(JSON.stringify({status:'pass',permissionUI:'mocked mini/system/privacy states',source:'existing published topic IDs',realStorageWrites:0,realMediaCalls:0,denied,restored}))
 }catch(error){
  console.log(JSON.stringify(await evaluate(function(){const p=getCurrentPages().slice(-1)[0],q=getApp().__speechPermissionQA;return {phase:'failure',route:p.route,status:p.data.status,error:p.data.error,action:p.data.permissionAction,turnCount:p.data.turnCount,connecting:p.data.connecting,fixturePresent:!!q,media:q?.media,socket:q?.socket,authorize:q?.authorize}})))
  throw error
 }finally{
  const p=await call('automation_runtime_info',{action:'currentPage'})
  if(['pages/ielts/speaking','pages/ielts/library'].includes(p.currentPage?.path))await call('automation_navigate',{action:'navigateBack'})
  await evaluate(function(){const q=getApp().__speechPermissionQA;if(q&&q.appAuthorizeOriginal)wx.getAppAuthorizeSetting=q.appAuthorizeOriginal;return true})
  for(const method of mocked.reverse())await call('automation_wx_api',{action:'restore',method})
  await evaluate(function(){delete getApp().__speechPermissionQA;return {mocksRemoved:true}})
 }
}
run().catch(e=>{console.error(e.message);process.exitCode=1})
