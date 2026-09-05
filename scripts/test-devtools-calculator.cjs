const assert=require('node:assert/strict')
const automator=require(process.env.WECHAT_AUTOMATOR_MODULE||'D:/CodexWork/qa-artifacts/stemist-devtools/node_modules/miniprogram-automator')
;(async()=>{
 const app=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'})
 const faults=[];app.on('exception',()=>faults.push('runtime exception'))
 let backedUp=false
 try{
  await app.reLaunch('/pages/index/index')
  await app.evaluate(()=>{const keys=['stemistCalculatorHistory','stemistCalculatorState'];const existing=wx.getStorageInfoSync().keys;getApp().__qaCalcBackup=keys.map(key=>({key,exists:existing.includes(key),value:wx.getStorageSync(key)}))})
  backedUp=true
  const page=await app.reLaunch('/pages/calculator/index')
  await page.waitFor(async()=>{const el=await page.$('.calc-equals');return el&&Number((await el.size()).width)>0})
  const tap=async(selector)=>{await page.waitFor(async()=>{const item=await page.$(selector);return item&&Number((await item.size()).width)>0});const el=await page.$(selector);assert.ok(el,selector);await el.tap()}
  const type=async(value)=>{await(await page.$('.expression-input')).input(value)}
  const check=(name,detail)=>console.log(JSON.stringify({name,status:'pass',...detail}))
  const info=await app.systemInfo(),eq=await page.$('.calc-equals'),box=await eq.size(),offset=await eq.offset()
  assert.ok(box.width>=44&&box.height>=44);assert.ok(offset.top+box.height<info.windowHeight)
  const keys=await page.$$('.calculator-keypad .calc-key')
  for(const key of keys){const size=await key.size();assert.ok(size.width>=44&&size.height>=44)}
  check('basic keypad visible without scrolling',{keyCount:keys.length,equalsBottom:offset.top+box.height,windowHeight:info.windowHeight})
  await tap('[data-action="clear"]');await type('1/3');await tap('.calc-equals');await page.waitFor(async()=>await page.data('hasResult'));await tap('[data-value="*"]');await page.waitFor(async()=>await page.data('expression')==='ans*');await tap('[data-value="3"]');await page.waitFor(async()=>await page.data('expression')==='ans*3');await tap('.calc-equals');await page.waitFor(async()=>await page.data('hasResult'));assert.equal(await page.data('answer'),1);check('precise answer continuation',{})
  await tap('[data-action="clear"]');await type('12+34');for(const target of [4,3,2]){await tap('[data-action="left"]');await page.waitFor(async()=>await page.data('cursor')===target)}await tap('[data-value="0"]');await page.waitFor(async()=>await page.data('expression')==='120+34');await tap('[data-action="delete"]');await page.waitFor(async()=>await page.data('expression')==='12+34');check('real cursor navigation and insertion',{})
  await tap('[data-action="clear"]');await tap('[data-action="shift"]');await page.waitFor(async()=>await page.data('shiftActive'));await tap('[data-value="sin("]');await page.waitFor(async()=>await page.data('expression')==='asin(');assert.equal(await page.data('shiftActive'),false);check('visible shifted scientific key',{})
  await tap('[data-action="clear"]');await type('2+3');await page.callMethod('toggleMemory');await tap('[data-action="memoryClear"]');await tap('[data-action="memoryAdd"]');await page.waitFor(async()=>await page.data('memory')===5);check('memory evaluates current input',{})
  await tap('[data-action="clear"]');await type('1/0');await tap('.calc-equals');await page.waitFor(async()=>await page.data('error'));assert.equal(await page.data('hasResult'),false);check('invalid calculation does not claim a result',{})
  assert.equal(faults.length,0)
  console.log(JSON.stringify({summary:'pass',steps:6,runtimeExceptions:0}))
 }finally{
  await app.reLaunch('/pages/index/index')
  if(backedUp)await app.evaluate(()=>{for(const item of getApp().__qaCalcBackup||[]){if(item.exists)wx.setStorageSync(item.key,item.value);else wx.removeStorageSync(item.key)}delete getApp().__qaCalcBackup})
  app.disconnect()
 }
})().catch(error=>{console.error(String(error.message).slice(0,350));process.exitCode=1})
