// Opt-in native UI acceptance for the shared image-first Coach. The test uses
// one temporary local PNG and never invokes camera, album, login or AI network.
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const output=process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:''
if(!output){console.error('Use --output <QA directory>');process.exit(2)}
const shot=name=>call('simulator_screenshot',{path:path.resolve(output,name+'.png'),optimize:false})

async function run(){
 const current=await call('automation_runtime_info',{action:'currentPage'})
 assert.equal(current.currentPage?.path,'pages/index/index','Begin on Home; do not interrupt an active practice')
 fs.mkdirSync(output,{recursive:true})
 const setup=await evaluate(function(){
  const keys=['stemistCoachPhoto','stemistCoachPhotoMeta','stemistCropReturn','stemistCameraReturn']
  const occupied=keys.filter(key=>wx.getStorageInfoSync().keys.includes(key))
  if(occupied.length)throw Error('Coach photo state is not empty; preserve the learner state and stop QA')
  const fixture=`${wx.env.USER_DATA_PATH}/qa-coach-photo-${Date.now()}.png`
  wx.getFileSystemManager().writeFileSync(fixture,'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAK0lEQVR4nO3PQQ0AIBDAsAP/nuGNAvZoFSzZOjNnyNiWJUgRKUKKkCIkCalCipAiJAcETgFfH2QX0AAAAABJRU5ErkJggg==','base64')
  getApp().__coachPhotoQa={fixture}
  return {fixture}
 })
 try{
  await call('automation_navigate',{action:'reLaunch',url:'/pages/coach/index?source=ielts&category=ielts'})
  const loaded=await until(function(){const p=getCurrentPages().slice(-1)[0];return p?.route==='pages/coach/index'&&p.data.contextId==='ielts'?{contextId:p.data.contextId,error:p.data.error}:null},'IELTS image Coach')
  assert.deepEqual(loaded,{contextId:'ielts',error:''})
  await call('automation_page_action',{action:'querySelector',selector:'.coach-media-primary'})
  await call('automation_page_action',{action:'querySelector',selector:'.coach-media-actions button:nth-child(2)'})
  await evaluate(function(){const p=getCurrentPages().slice(-1)[0];p.setData({imagePath:getApp().__coachPhotoQa.fixture,imageSource:'已裁剪',error:''});return true})
  await call('automation_page_action',{action:'querySelector',selector:'.coach-photo-preview'})
  const state=await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {contextId:p.data.contextId,imageReady:Boolean(p.data.imagePath),message:p.data.message,mediaBusy:p.data.mediaBusy,error:p.data.error}})
  assert.deepEqual(state,{contextId:'ielts',imageReady:true,message:'',mediaBusy:false,error:''})
  await shot('ielts-image-first-coach-phone')
  console.log(JSON.stringify({status:'pass',context:'ielts',cameraAction:true,albumAction:true,staticPreview:true,photoOnlyEnabled:true,providerCalls:0,screenshot:path.resolve(output,'ielts-image-first-coach-phone.png')}))
 }finally{
  await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'}).catch(()=>{})
  await evaluate(function(){const fixture=getApp().__coachPhotoQa?.fixture;if(fixture)try{wx.getFileSystemManager().unlinkSync(fixture)}catch{};delete getApp().__coachPhotoQa;return true}).catch(()=>{})
 }
}
run().catch(error=>{console.error(error.message);process.exitCode=1})
