// Native simulator layout evidence only. No account mutation, native chooser
// automation, or claim that tablet-class overrides change the viewport.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const output=process.argv[process.argv.indexOf('--output')+1]
if(!output)throw Error('Supply --output <QA directory>')
async function main(){
 fs.mkdirSync(output,{recursive:true})
 const current=await call('automation_runtime_info',{action:'currentPage'})
 assert.ok(['pages/index/index','bundles/account/profile'].includes(current.currentPage?.path),'Do not interrupt a learning session')
 if(current.currentPage.path!=='bundles/account/profile')await evaluate(function(){wx.navigateTo({url:'/bundles/account/profile'});return true})
 await until(function(){const p=getCurrentPages().slice(-1)[0];return p?.route==='bundles/account/profile'&&typeof p.loadProfile==='function'&&!p.data.loading},'profile runtime',18000)
 await evaluate(function(){const p=getCurrentPages().slice(-1)[0];if(p.data.loading)throw Error('Wait for the read-only load to settle');p.__profileLayoutBackup={...p.data};return true})
 try{
  await call('automation_page_action',{action:'setData',patch:JSON.stringify({loaded:true,loading:false,displayName:'微信昵称示例',avatarDataUrl:'',error:'',deviceClass:'device-phone',isTablet:false,orientation:'portrait'})})
  await call('simulator_screenshot',{path:path.join(output,'profile-phone.png'),optimize:false,'wait-for-selector':'.profile-input'})
  const input=await call('automation_element_action',{action:'size',selector:'.profile-input'})
  const button=await call('automation_element_action',{action:'size',selector:'button[form-type="submit"]'})
  await call('automation_page_action',{action:'setData',patch:JSON.stringify({deviceClass:'device-tablet',isTablet:true})})
  await call('simulator_screenshot',{path:path.join(output,'profile-tablet-class.png'),optimize:false})
  const viewport=await evaluate(function(){const s=wx.getWindowInfo();return {width:s.windowWidth,height:s.windowHeight}})
  console.log(JSON.stringify({status:'rendered',input,button,viewport,tabletScope:'tablet-class at actual simulator width; not a physical iPad',nativeChooserVerified:false,serverWrites:0}))
 }finally{
  await evaluate(function(){const p=getCurrentPages().slice(-1)[0];if(p.__profileLayoutBackup){p.setData(p.__profileLayoutBackup);delete p.__profileLayoutBackup}return true})
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
