// Public source API + isolated memory-only learning state. Camera permission and
// system capture are mocked; this never accesses the computer's real camera.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const output=process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:''
if(!output){console.error('Use --output <new QA directory>');process.exit(2)}
const tap=selector=>call('automation_element_action',{action:'tap',selector,'wait-for-selector':selector})
const shot=name=>call('simulator_screenshot',{path:path.resolve(output,name+'.png'),optimize:false})
const mocked=[]
async function visibleRecovery(){
 const rect=await evaluate(function(){
  const p=getCurrentPages().slice(-1)[0],selector=p.data.permissionAction?'.camera-settings':'.camera-system'
  return new Promise(resolve=>{
   const query=wx.createSelectorQuery();query.select(selector).boundingClientRect()
   query.exec(rows=>{const r=rows[0];resolve({top:r?.top,bottom:r?.bottom,height:r?.height,windowHeight:wx.getWindowInfo().windowHeight})})
  })
 })
 assert.ok(rect.top>=0&&rect.bottom<=rect.windowHeight-8&&rect.height>=44,'camera recovery must be visible in the first viewport')
}
async function mock(method,fn){await call('automation_wx_api',{action:'mock',method,'function-declaration':fn.toString()});mocked.push(method)}
async function scroll(selector){
 const position=await evaluate('function(){return new Promise(resolve=>wx.createSelectorQuery().select('+JSON.stringify(selector)+').boundingClientRect().selectViewport().scrollOffset().exec(r=>resolve({top:r[0]?.top,scrollTop:r[1]?.scrollTop||0})))}')
 assert.ok(Number.isFinite(position.top),'scroll target exists: '+selector)
 await call('automation_viewport_action',{action:'pageScrollTo','scroll-top':Math.max(0,position.top+position.scrollTop-90)})
}
async function run(){
 assert.equal((await call('automation_runtime_info',{action:'currentPage'})).currentPage?.path,'pages/index/index','Do not interrupt active user work')
 fs.mkdirSync(output,{recursive:true});console.log(JSON.stringify({output}))
 await evaluate(function(){
  if(getApp().__chapterCameraQA)throw Error('A chapter/camera QA run is already active')
  getApp().__chapterCameraQA={store:{stemistUser:{id:'qa-chapter-fixture'},stemistSessionToken:'expired-fixture',stemistSessionMeta:{kind:'password',owner:'qa-chapter-fixture',expiresAt:'2000-01-01T00:00:00Z'},'stemistDraft:writing':{text:'synthetic existing draft'}},cameraAllowed:false,contexts:0,systemCalls:0}
  return true
 })
 try{
  await mock('getStorageSync',function(key){return getApp().__chapterCameraQA.store[key]})
  await mock('setStorageSync',function(key,value){getApp().__chapterCameraQA.store[key]=JSON.parse(JSON.stringify(value))})
  await mock('removeStorageSync',function(key){delete getApp().__chapterCameraQA.store[key]})
  await mock('getStorageInfoSync',function(){return {keys:Object.keys(getApp().__chapterCameraQA.store)}})
  await mock('getPrivacySetting',function(){return {needAuthorization:false}})
  await mock('getSetting',function(){return {authSetting:{'scope.camera':getApp().__chapterCameraQA.cameraAllowed}}})
  await mock('createCameraContext',function(){getApp().__chapterCameraQA.contexts++;return null})
  await mock('chooseMedia',function(options){const q=getApp().__chapterCameraQA;q.systemCalls++;q.systemOptions={count:options.count,camera:options.camera,sourceType:options.sourceType};return {tempFiles:[]}})
  await evaluate(function(){const q=getApp().__chapterCameraQA;q.appAuthorizeOriginal=wx.getAppAuthorizeSetting;wx.getAppAuthorizeSetting=function(){return {cameraAuthorized:'authorized'}};return true})
  await call('automation_navigate',{action:'navigateTo',url:'/pages/stem/topics?routeId=cie-9702-as-physics'})
  const chapters=await until(function(){const p=getCurrentPages().slice(-1)[0];return !p.data.loading?{route:p.route,error:p.data.error,count:p.data.topics.length,components:p.data.componentOptions.length}:null},'public chapter response')
  assert.equal(chapters.error,'');assert.equal(chapters.count,11);assert.equal(chapters.components,2)
  console.log(JSON.stringify({phase:'chapters',...chapters}))
  await scroll('.topic-choice');await tap('[data-id="physics-9702-topic-01"]')
  const selection=await evaluate(function(){const d=getCurrentPages().slice(-1)[0].data;return {count:d.availableCount,canStart:d.canStart,questionCount:d.questionCount}})
  assert.equal(selection.canStart,true);assert.equal(selection.questionCount,10);assert.ok(selection.count>=12)
  console.log(JSON.stringify({phase:'selection',...selection}))
  await scroll('.start-native-practice');await shot('chapter-selection');await tap('.start-native-practice')
  const started=await until(function(){const p=getCurrentPages().slice(-1)[0];if(p.route==='pages/stem/practice')return {route:p.route,total:p.data.total,images:p.data.question?.images?.length,error:p.data.error};if(!p.data.busy&&p.data.error)return {error:p.data.error};return null},'real 10-question practice set')
  assert.equal(started.route,'pages/stem/practice');assert.equal(started.total,10);assert.ok(started.images>0);assert.equal(started.error,'')
  await scroll('.question-image')
  const image=await until(function(){const q=getCurrentPages().slice(-1)[0].data.question;return q?.images?.some(i=>i.loaded||i.failed)?{loaded:q.images.filter(i=>i.loaded).length,failed:q.images.filter(i=>i.failed).length}:null},'real original question image')
  assert.ok(image.loaded>0);assert.equal(image.failed,0);await shot('chapter-original-question')
  await scroll('.capture-answer');await tap('.capture-answer')
  const camera=await until(function(){const p=getCurrentPages().slice(-1)[0];return p.route==='pages/stem/camera'&&p.data.permissionAction?{ready:p.data.ready,mounted:p.data.cameraMounted,action:p.data.permissionAction,returnPage:p.data.returnPage,routeId:p.data.routeId}:null},'camera permission recovery')
  assert.deepEqual(camera,{ready:false,mounted:false,action:'mini',returnPage:'native-practice',routeId:'cie-9702-as-physics'})
  await visibleRecovery()
  await shot('mock-camera-denied')
  await evaluate(function(){const q=getApp().__chapterCameraQA;q.cameraAllowed=true;getCurrentPages().slice(-1)[0].cameraFailure({action:'retry',message:'相机未能启动，请重试或使用系统相机。'});return true})
  await visibleRecovery()
  await shot('mock-camera-start-failed');await scroll('.camera-system');await tap('.camera-system')
  const recovery=await until(function(){const q=getApp().__chapterCameraQA,p=getCurrentPages().slice(-1)[0];return q.systemCalls?{systemCalls:q.systemCalls,contexts:q.contexts,options:q.systemOptions,route:p.route,busy:p.data.busy,draftIntact:q.store['stemistDraft:writing']?.text==='synthetic existing draft',identityIntact:q.store.stemistUser?.id==='qa-chapter-fixture'}:null},'explicit system camera API')
  assert.equal(recovery.systemCalls,1);assert.equal(recovery.contexts,0);assert.deepEqual(recovery.options,{count:1,camera:'back',sourceType:['camera']});assert.equal(recovery.draftIntact,true);assert.equal(recovery.identityIntact,true)
  console.log(JSON.stringify({status:'pass',surface:'official WeChat phone simulator',chapters,selection,started,image,camera,recovery,realCameraCalls:0,realUserStorageWrites:0}))
 }catch(error){
  console.log(JSON.stringify(await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {phase:'failure',route:p.route,error:p.data.error,ready:p.data.ready,fixturePresent:!!getApp().__chapterCameraQA}})))
  await shot('diagnostic');throw error
 }finally{
  for(let i=0;i<4;i++){const p=await call('automation_runtime_info',{action:'currentPage'});if(!['pages/stem/topics','pages/stem/practice','pages/stem/camera'].includes(p.currentPage?.path))break;await call('automation_navigate',{action:'navigateBack'})}
  await evaluate(function(){const q=getApp().__chapterCameraQA;if(q?.appAuthorizeOriginal)wx.getAppAuthorizeSetting=q.appAuthorizeOriginal;return true})
  for(const method of mocked.reverse())await call('automation_wx_api',{action:'restore',method})
  await evaluate(function(){delete getApp().__chapterCameraQA;return {fixtureRemoved:true}})
 }
}
run().catch(e=>{console.error(e.message);process.exitCode=1})
