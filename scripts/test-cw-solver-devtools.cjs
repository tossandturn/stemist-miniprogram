// Real WeChat UI actions. Only calculator state is temporarily isolated;
// existing calculations are held in app RAM and restored in finally.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const output=path.resolve(process.argv[2]||'D:/CodexWork/qa-artifacts/cw-solver-runtime')
if(!output.startsWith('D:\\CodexWork\\qa-artifacts\\')&&process.platform==='win32')throw Error('QA output must stay in the artifact directory')
fs.mkdirSync(output,{recursive:true})
const tap=selector=>call('automation_element_action',{action:'tap',selector,'wait-for-selector':selector})
const key=name=>tap('.cw-id-'+name)
const state=()=>evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {route:p.route,phase:p.data.solverPhase,equation:p.data.expression,target:p.data.solverTarget,initial:p.data.solverInitialText,result:p.data.solverResult,error:p.data.error,workbench:p.data.workbench}})
let backed=false
;(async()=>{
 try{
  // Compile via the compiler scene before this script. Re-refreshing here
  // can invalidate the automator's connection during the first evaluate.
  await call('automation_runtime_info',{action:'currentPage'})
  await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'})
  await evaluate(function(){const app=getApp();if(app.__solverQaBackup)throw Error('Another Solver QA is active');app.__solverQaBackup=['stemistCalculatorState','stemistCalculatorHistory'].map(key=>({key,value:wx.getStorageSync(key),exists:wx.getStorageInfoSync().keys.includes(key)}));wx.removeStorageSync('stemistCalculatorState');wx.removeStorageSync('stemistCalculatorHistory');return {isolated:true}});backed=true
  console.log(JSON.stringify({step:'isolated-calculator-state',status:'pass'}))
  await call('automation_navigate',{action:'navigateTo',url:'/pages/calculator/index'})
  await key('home');await tap('[data-id="app-equation"]');await tap('[data-id="work-solver"]')
  assert.equal((await state()).phase,'equation')
  await key('x');await key('square');await key('minus');await key('2')
  await key('catalog');await tap('[data-id="catalog-equation"]');await tap('[data-id="insert-="]');await key('0')
  await key('exe');assert.equal((await state()).phase,'target')
  await tap('[data-name="x"]');await key('1');await key('exe')
  await call('simulator_screenshot',{path:path.join(output,'initial.png')})
  await key('exe')
  const positive=await until(function(){const p=getCurrentPages().slice(-1)[0];return p.data.solverPhase==='running'?null:{phase:p.data.solverPhase,result:p.data.solverResult,error:p.data.error}},'positive root')
  assert.equal(positive.phase,'result',positive.error);assert.ok(Math.abs(positive.result.value-Math.sqrt(2))<1e-9)
  assert.ok(Math.abs(positive.result.residual)<1e-9)
  console.log(JSON.stringify({case:'positive-root',status:'pass',value:positive.result.value,residual:positive.result.residual,iterations:positive.result.iterations}))
  await call('simulator_screenshot',{path:path.join(output,'positive-root.png')})
  await tap('.solver-change-initial');await key('minus');await key('1');await key('exe');await key('exe')
  const negative=await state();assert.equal(negative.phase,'result',negative.error);assert.ok(negative.result.value<0)
  console.log(JSON.stringify({case:'different-initial',status:'pass',value:negative.result.value}))
  await call('simulator_screenshot',{path:path.join(output,'negative-root.png')})
  await key('exe');await key('ac');await key('x');await key('square');await key('plus');await key('1')
  await key('exe');await tap('[data-name="x"]');await key('0');await key('exe');await key('exe')
  const failed=await state();assert.equal(failed.phase,'failed');assert.equal(failed.result,null)
  console.log(JSON.stringify({case:'no-real-root',status:'pass',falseResult:false}))
  await call('simulator_screenshot',{path:path.join(output,'cannot-solve.png')})
  await tap('.cw-solver-error .cw-solver-key');assert.equal((await state()).phase,'initial')
  console.log(JSON.stringify({case:'retry-initial',status:'pass',screenshots:output}))
 }finally{
  if(backed){await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'}).catch(()=>{});await evaluate(function(){const app=getApp();for(const saved of app.__solverQaBackup||[]){if(saved.exists)wx.setStorageSync(saved.key,saved.value);else wx.removeStorageSync(saved.key)}delete app.__solverQaBackup;return {calculatorStateRestored:true}})}
 }
})().catch(error=>{console.error(error.message);process.exitCode=1})
