const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const output=path.resolve(process.argv[2]||'D:/CodexWork/qa-artifacts/cw-shift-runtime')
fs.mkdirSync(output,{recursive:true})
const tap=id=>call('automation_element_action',{action:'tap',selector:'[data-key="'+id+'"]','wait-for-selector':'[data-key="'+id+'"]'})
const value=(field,expected)=>until('function(){const p=getCurrentPages().slice(-1)[0];return p&&p.data['+JSON.stringify(field)+']==='+JSON.stringify(expected)+'}',field)
const shot=name=>call('simulator_screenshot',{path:path.join(output,name+'.png'),optimize:false})
const results=[]
async function run(){
 let backedUp=false
 try{
  await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'})
  await evaluate(function(){const app=getApp();if(app.__cwShiftQA)throw Error('Calculator QA is already running');const keys=['stemistCalculatorState','stemistCalculatorHistory'],existing=wx.getStorageInfoSync().keys;app.__cwShiftQA=keys.map(key=>({key,exists:existing.includes(key),value:wx.getStorageSync(key)}));for(const key of keys)wx.removeStorageSync(key);return {saved:true}})
  backedUp=true
  await call('automation_navigate',{action:'reLaunch',url:'/pages/calculator/index'})
  await value('expression','')
  const geometry=await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return new Promise(resolve=>wx.createSelectorQuery().in(p).selectAll('.cw-key').boundingClientRect().select('.calculator-page').boundingClientRect().exec(rows=>resolve({keys:rows[0]?.map(r=>({width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom})),page:rows[1],window:wx.getWindowInfo()})))})
  assert.equal(geometry.keys.length,48);assert.ok(geometry.keys.every(k=>k.width>=44&&k.height>=44&&k.left>=0&&k.right<=geometry.window.windowWidth+1))
  results.push({check:'48 key targets',status:'pass',width:geometry.window.windowWidth,height:geometry.window.windowHeight})
  await shot('keypad-normal')
  await tap('shift');await value('shiftActive',true)
  const state=await call('automation_element_action',{action:'attribute',selector:'[data-key="shift"]',name:'aria-pressed'})
  assert.ok(JSON.stringify(state).includes('true'))
  await shot('keypad-shift')
  if(process.argv.includes('--visual-only')){console.log(JSON.stringify({status:'pass',checks:results,output,scope:'key geometry and normal/SHIFT screenshots'}));return}
  await tap('sin');await value('expression','asin()');await value('shiftActive',false)
  for(const key of ['dot','5','exe'])await tap(key)
  const inverse=await evaluate(function(){return getCurrentPages().slice(-1)[0].data.answer})
  assert.ok(Math.abs(inverse-30)<1e-10);results.push({check:'SHIFT sin(.5)',answer:inverse,status:'pass'})
  await tap('home')
  // Actual LCD menu choices, not a private controller shortcut.
  await call('automation_element_action',{action:'tap',selector:'[data-id="app-equation"]','wait-for-selector':'[data-id="app-equation"]'})
  // Move the native menu through its own directional keys to Solver.
  await tap('down');await tap('down');await tap('ok');await value('solverPhase','equation')
  for(const key of ['x','square','shift','open-paren','2','exe','exe','1','exe','exe'])await tap(key)
  await value('solverPhase','result')
  const solved=await evaluate(function(){const d=getCurrentPages().slice(-1)[0].data;return {equation:d.solverEquation,value:d.solverResult?.value,residual:d.solverResult?.residual}})
  assert.equal(solved.equation,'x^(2)=2');assert.ok(Math.abs(solved.value-Math.sqrt(2))<1e-9)
  results.push({check:'SHIFT equals in Solver',status:'pass',...solved});await shot('solver-result')
  await tap('shift');await value('shiftActive',true);await tap('ac');await value('powerOff',true);await shot('solver-off')
  await tap('on');await value('powerOff',false);results.push({check:'SHIFT OFF from Solver result',status:'pass'})
  await tap('home');await call('automation_element_action',{action:'tap',selector:'[data-id="app-calculate"]','wait-for-selector':'[data-id="app-calculate"]'});await tap('ac')
  for(const key of ['2','shift','plus','2','0','shift','plus','3','0','shift','plus','plus','0','shift','plus','9','shift','plus','3','0','shift','plus','exe'])await tap(key)
  await value('display','2°30′0″');results.push({check:'official degree/minute/second sequence',display:'2°30′0″',status:'pass'});await shot('sexagesimal-result')
  fs.writeFileSync(path.join(output,'acceptance.json'),JSON.stringify({status:'pass',surface:'official WeChat phone simulator',results},null,2)+'\n','utf8')
  console.log(JSON.stringify({status:'pass',checks:results,output}))
 }finally{
  if(backedUp){await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'});await evaluate(function(){const app=getApp();for(const item of app.__cwShiftQA||[]){if(item.exists)wx.setStorageSync(item.key,item.value);else wx.removeStorageSync(item.key)}delete app.__cwShiftQA;return {restored:true}})}
 }
}
run().catch(error=>{console.error(error.message);process.exitCode=1})
