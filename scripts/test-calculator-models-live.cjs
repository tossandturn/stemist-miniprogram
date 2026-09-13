const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const output=process.argv[process.argv.indexOf('--output')+1]
if(!output)throw Error('Use --output <QA directory>')
const tap=selector=>call('automation_element_action',{action:'tap',selector,'wait-for-selector':selector})
async function main(){
 const page=await call('automation_runtime_info',{action:'currentPage'})
 const originalPage=page.currentPage?.path
 assert.ok(['pages/index/index','pages/calculator/index'].includes(originalPage),'Do not interrupt a learning session')
 fs.mkdirSync(output,{recursive:true})
 await evaluate(function(){const app=getApp();if(app.__calcModelQA)throw Error('Calculator QA already active');const p=getCurrentPages().slice(-1)[0];if(p?.route==='pages/calculator/index')p.flushState();const present=wx.getStorageInfoSync().keys;app.__calcModelQA=['stemistCalculatorState','stemistCalculatorHistory'].map(key=>({key,present:present.includes(key),value:wx.getStorageSync(key)}));return true})
 try{
  await call('automation_navigate',{action:'navigateTo',url:'/pages/calculator/index'})
  await tap('.calculator-model-option[data-model="cnx"]')
  await tap('[data-key="menu"]');await tap('[data-id="app-calculate"]')
  for(const key of ['ac','x-key','square','minus','2'])await tap('[data-key="'+key+'"]')
  await call('simulator_screenshot',{path:path.join(output,'cnx-keys.png'),optimize:false})
  for(const key of ['shift','calc','1'])await tap('[data-key="'+key+'"]')
  await call('automation_viewport_action',{action:'pageScrollTo','scroll-top':400})
  await tap('[data-key="equals"]')
  await tap('[data-key="equals"]')
  await call('automation_viewport_action',{action:'pageScrollTo','scroll-top':0})
  console.log(JSON.stringify(await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {phase:p.data.solverPhase,calcPhase:p.data.calcPhase,initial:p.data.solverInitialText,expression:p.data.expression,error:p.data.error,shift:p.data.shiftActive}})))
  await call('simulator_screenshot',{path:path.join(output,'cnx-solve-attempt.png'),optimize:false})
  const result=await until(function(){const p=getCurrentPages().slice(-1)[0];return p.data.solverPhase==='result'||p.data.error?{model:p.data.calculatorModel,phase:p.data.solverPhase,root:p.data.solverValueText,error:p.data.error}:null},'CNX SHIFT CALC solver')
  assert.equal(result.phase,'result')
  assert.equal(result.model,'cnx');assert.equal(result.error,'');assert.ok(Math.abs(Number(result.root)-Math.sqrt(2))<1e-8)
  await call('simulator_screenshot',{path:path.join(output,'cnx-solve.png'),optimize:false})
  await tap('.calculator-model-option[data-model="cw"]')
  assert.equal(await evaluate(function(){return getCurrentPages().slice(-1)[0].data.calculatorModel}),'cw')
  console.log(JSON.stringify({status:'pass',result,returnedToCw:true,scope:'native phone simulator taps; user calculator storage restored afterwards'}))
 }finally{
  await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'})
  await evaluate(function(){const app=getApp();for(const item of app.__calcModelQA||[]){if(item.present)wx.setStorageSync(item.key,item.value);else wx.removeStorageSync(item.key)}delete app.__calcModelQA;return true})
  if(originalPage==='pages/calculator/index')await call('automation_navigate',{action:'navigateTo',url:'/pages/calculator/index'})
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
