const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const output=path.resolve(process.argv[2]||'D:/CodexWork/qa-artifacts/cw-complex-runtime')
fs.mkdirSync(output,{recursive:true})
const tap=id=>call('automation_element_action',{action:'tap',selector:'[data-key="'+id+'"]','wait-for-selector':'[data-key="'+id+'"]'})
const menu=id=>call('automation_element_action',{action:'tap',selector:'[data-id="'+id+'"]','wait-for-selector':'[data-id="'+id+'"]'})
const value=(field,expected)=>until('function(){const p=getCurrentPages().slice(-1)[0];return p&&p.data['+JSON.stringify(field)+']==='+JSON.stringify(expected)+'}',field)
const shot=name=>call('simulator_screenshot',{path:path.join(output,name+'.png'),optimize:false})
const sequence=async ids=>{for(const id of ids)await tap(id)}
const mode=async app=>{await tap('home');await menu('app-'+app);await value('calculatorApp',app)}
const results=[]
function pass(check,details={}){const result={check,status:'pass',...details};results.push(result);console.log(JSON.stringify(result))}
async function run(){
 let backedUp=false
 try{
  await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'})
  await evaluate(function(){const app=getApp();if(app.__cwComplexQA)throw Error('Calculator QA is already running');const keys=['stemistCalculatorState','stemistCalculatorHistory'],existing=wx.getStorageInfoSync().keys;app.__cwComplexQA=keys.map(key=>({key,exists:existing.includes(key),value:wx.getStorageSync(key)}));for(const key of keys)wx.removeStorageSync(key);return {saved:true}})
  backedUp=true
  await call('automation_navigate',{action:'reLaunch',url:'/pages/calculator/index'})
  await value('expression','')
  await sequence(['1','2','plus','home']);await shot('complex-home')
  await menu('app-complex');await value('calculatorApp','complex')
  await sequence(['2','plus','3','shift','9','exe']);await value('display','2+3i');await value('shiftActive',false);await shot('complex-rectangular')
  pass('HOME Complex and physical SHIFT 9',{display:'2+3i'})
  await sequence(['ac','open-paren','1','plus','shift','9','close-paren','power','4','right','plus','open-paren','1','minus','shift','9','close-paren','square','exe'])
  await value('display','−4−2i');await shot('complex-official-example');pass('Official integer-power example',{display:'−4−2i'})
  await sequence(['ac','catalog']);await menu('catalog-complex');await shot('complex-catalog');await menu('insert-conjg(')
  await sequence(['2','plus','3','shift','9','exe']);await value('display','2−3i');pass('CATALOG Conjugate',{display:'2−3i'})
  await sequence(['ac','catalog']);await menu('catalog-complex');await menu('insert-arg(')
  await sequence(['1','plus','shift','9','exe']);await value('display','45');pass('CATALOG Argument in degrees',{display:'45'})
  await sequence(['ac','2','catalog']);await menu('catalog-complex');await menu('insert-∠');await sequence(['4','5','exe'])
  await tap('format');await menu('complex-format-polar');await value('display','2∠45');await shot('complex-polar');pass('Polar input and FORMAT',{display:'2∠45'})
  await tap('settings');await menu('angle-menu');await menu('angle-RAD')
  const radians=await evaluate(function(){return getCurrentPages().slice(-1)[0].data.display});assert.match(radians,/2∠0\.785398/);pass('Angle conversion updates the same value',{display:radians})
  await tap('settings');await menu('angle-menu');await menu('angle-DEG')
  await sequence(['ac','sqrt','shift','minus','4','exe']);await value('display','2i');pass('Natural square-root template',{display:'2i'})
  await tap('variable');await menu('variable-A');await menu('store-variable');await tap('back')
  await mode('calculate');await value('expression','12+');await sequence(['5','exe']);await value('display','17')
  await sequence(['ac','shift','4','plus','1','exe'])
  const error=await evaluate(function(){const d=getCurrentPages().slice(-1)[0].data;return {error:d.error,answer:d.answer}})
  assert.match(error.error,/Complex|复数/);assert.equal(error.answer,17);pass('Calculate rejects a stored complex variable without changing Ans')
  await mode('complex');await value('display','2i');await value('expression','sqrt(⁻4)')
  await sequence(['ac','shift','4','plus','1','exe']);await value('display','1+2i')
  await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'})
  await call('automation_navigate',{action:'reLaunch',url:'/pages/calculator/index'})
  await value('calculatorApp','complex');await value('display','1+2i');pass('Reopening restores Complex, its expression, result and variable')
  const geometry=await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return new Promise(resolve=>wx.createSelectorQuery().in(p).selectAll('.cw-key').boundingClientRect().select('.calculator-page').boundingClientRect().exec(rows=>resolve({keys:rows[0]?.map(r=>({width:r.width,height:r.height,left:r.left,right:r.right})),page:rows[1],window:wx.getWindowInfo()})))})
  assert.equal(geometry.keys.length,48);assert.ok(geometry.keys.every(k=>k.width>=44&&k.height>=44&&k.left>=0&&k.right<=geometry.window.windowWidth+1))
  const qr=await evaluate(function(){const d=getCurrentPages().slice(-1)[0].data;return d.scientificRows.flatMap(r=>r.keys).some(k=>k.shiftLabel==='QR'||k.shiftAction==='qr')});assert.equal(qr,false)
  pass('QR removed and all 48 key targets remain at least 44 pixels',{windowWidth:geometry.window.windowWidth,windowHeight:geometry.window.windowHeight})
  fs.writeFileSync(path.join(output,'acceptance.json'),JSON.stringify({status:'pass',surface:'official WeChat phone simulator',results},null,2)+'\n','utf8')
  console.log(JSON.stringify({status:'pass',checks:results.length,output}))
 }finally{
  if(backedUp){await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'});await evaluate(function(){const app=getApp();for(const item of app.__cwComplexQA||[]){if(item.exists)wx.setStorageSync(item.key,item.value);else wx.removeStorageSync(item.key)}delete app.__cwComplexQA;return {restored:true}})}
 }
}
run().catch(error=>{console.error(error.message);process.exitCode=1})
