const assert=require('node:assert/strict')
const automator=require(process.env.WECHAT_AUTOMATOR_MODULE||'D:/CodexWork/qa-artifacts/stemist-devtools/node_modules/miniprogram-automator')
;(async()=>{
 const app=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});let backedUp=false,p,steps=0
 const faults=[];app.on('exception',e=>faults.push(String(e.message||e).slice(0,200)))
 try {
  if((await app.currentPage())?.path!=='pages/index/index')await app.reLaunch('/pages/index/index')
  await app.evaluate(()=>{const keys=['stemistCalculatorState','stemistCalculatorHistory'];for(const x of getApp().__cwAdversarialBackup||[]){if(!keys.includes(x.key))continue;if(x.exists)wx.setStorageSync(x.key,x.value);else wx.removeStorageSync(x.key)}const all=wx.getStorageInfoSync().keys;getApp().__cwAdversarialBackup=keys.map(key=>({key,exists:all.includes(key),value:wx.getStorageSync(key)}))});backedUp=true
  p=await app.reLaunch('/pages/calculator/index')
  const viewport=await app.systemInfo()
  const bounded=(promise,ms)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('UI response timed out after step '+steps)),ms)})]).finally(()=>clearTimeout(timer))}
  const until=async condition=>{
   const end=Date.now()+10000
   while(Date.now()<end){const result=await bounded(Promise.resolve().then(()=>typeof condition==='string'?p.$(condition).then(Boolean):condition()),Math.max(1,end-Date.now()));if(result)return;await new Promise(resolve=>setTimeout(resolve,60))}
   throw new Error('Visible UI condition not reached after step '+steps)
  }
  const wait=(k,v)=>until(async()=>await p.data(k)===v)
  const rect=async e=>({...await e.offset(),...await e.size()})
  async function tap(selector,within='') {
   await until(async()=>{const e=await p.$(selector);return e&&Number((await e.size()).height)>0})
   let e=await p.$(selector)
   if(within){
    const box=await p.$(within), b=await rect(box), r=await rect(e)
    if(r.top<b.top||r.top+Number(r.height)>b.top+Number(b.height)){
     const previous=Number(await box.property('scrollTop'))||0
     await box.scrollTo(0,Math.max(0,previous+r.top-b.top))
     await until(async()=>{e=await p.$(selector);const z=await rect(e),v=await rect(box);return z.top>=v.top-1&&z.top+Number(z.height)<=v.top+Number(v.height)+1})
    }
   }
   const b=await rect(e)
   assert.ok(b.left>=-1&&b.top>=-1&&b.left+Number(b.width)<=viewport.windowWidth+1&&b.top+Number(b.height)<=viewport.windowHeight+1,`not actually visible: ${selector}`)
   await e.tap()
  }
  const key=id=>tap(`[data-key="${id}"]`)
  const menu=id=>tap(`[data-id="${id}"]`,'.cw-menu-scroll')
  const clear=async()=>{await key('ac');await wait('expression','')}
  const type=async value=>{await tap('.cw-expression-scroll');await until('.expression-input');await(await p.$('.expression-input')).input(value);await wait('expression',value)}
  const field=async(id,value)=>{const selector=`.cw-field-input[data-id="${id}"]`;await tap(selector,'.cw-sheet-scroll');await(await p.$(selector)).input(String(value));await until(async()=>(await p.data('workFields')).find(f=>f.id===id)?.value===String(value))}
  const log=(name,details={})=>{steps++;console.log(JSON.stringify({name,status:'pass',...details}))}
  const screenshot=name=>{
   if(!process.env.CW_RETEST_SCREENSHOT_DIR)return
   const {execFileSync}=require('node:child_process'),path=require('node:path')
   const output=path.join(process.env.CW_RETEST_SCREENSHOT_DIR,name+'.png')
   execFileSync('powershell.exe',['-NoProfile','-Command',"& 'D:\\微信web开发者工具\\wechatide.cmd' -c Codex simulator_screenshot --project 'D:\\CodexWork\\stemist-miniprogram' --path '"+output.replace(/'/g,"''")+"' --optimize false"],{windowsHide:true,timeout:20000,stdio:'pipe'})
  }
  console.log(JSON.stringify({stage:'starting live adversarial key sequences'}))
  await clear();await p.setData({variables:{A:0,B:0,C:0,D:0,E:5,F:0,x:0,y:0,z:0}})
  await key('2');await wait('expression','2');await key('shift');await wait('shiftActive',true);await key('2');await wait('shiftActive',false);await key('3');await key('exe');await wait('hasResult',true);assert.equal(await p.data('answer'),30)
  log('real E key sequence does not produce exponent 2000')
  screenshot('variable-E-correct')
  await clear();await key('6');await wait('expression','6');await key('divide');await key('2');await key('shift');await wait('shiftActive',true);await key('7');await wait('shiftActive',false);await key('exe');await wait('hasResult',true);assert.ok(Math.abs(await p.data('answer')-6/(2*Math.PI))<1e-12)
  log('Casio omitted-multiplication denominator priority')
  await clear();await type('12+34');for(const pos of [4,3,2]){await key('left');await wait('cursor',pos)}
  await until(async()=>{const c=await p.$('.cw-caret'),t=(await p.$$('.cw-expression text'))[0];return c&&t&&await t.text()==='12'})
  const caret=await rect(await p.$('.cw-caret')), prefix=await rect((await p.$$('.cw-expression text'))[0])
  assert.ok(Math.abs(caret.left-prefix.left-Number(prefix.width))<1)
  await key('0');await wait('expression','120+34');await key('del');await wait('expression','12+34')
  log('visible caret matches the actual insertion coordinate',{caretLeft:caret.left})
  screenshot('visible-cursor')
  await clear();await key('fraction');await wait('workbench','fraction');await field('numerator',1);await field('denominator',2);await p.callMethod('onWorkbenchConfirm');await tap('.cw-work-submit');await wait('workbench','');await key('left');await wait('cursor',8);await key('up');await wait('cursor',6)
  const c=await rect(await p.$('.cw-caret')), n=await rect(await p.$('.cw-fraction-numerator'))
  assert.ok(c.top>=n.top-2&&c.top<=n.top+Number(n.height))
  await key('down');await wait('cursor',8);await key('3');await wait('expression','frac(1,23)');await key('del');await wait('expression','frac(1,2)')
  log('fraction vertical navigation and denominator editing')
  await clear();await key('catalog');await wait('menu','catalog');await menu('catalog-numeric');await wait('menu','catalog-numeric');await menu('insert-pi');await wait('menu','');assert.equal(await p.data('expression'),'pi')
  log('CATALOG entries are scrolled into the LCD before tapping')
  await clear();await type('8+1');await key('exe');await wait('answer',9);await type('17+4');await key('up');await wait('expression','8+1');await key('down');await wait('expression','17+4')
  log('history browsing restores unfinished input')
  await key('home');await wait('menu','home');await menu('app-equation');await wait('menu','equation');await menu('work-linear');await wait('workbench','linear');await field('row1','2,1,5');await field('row2','1,-1,1');await p.callMethod('onWorkbenchConfirm');await tap('.cw-work-submit');await until(async()=>(await p.data('workResults')).length===2);assert.deepEqual((await p.data('workResults')).map(r=>r.value),['2','1']);await tap('.cw-sheet-close')
  log('previously untested simultaneous-equation form')
  await key('home');await wait('menu','home');await menu('app-table');await wait('workbench','table');await field('expression','x^2');await field('start',0);await field('end',44);await field('step',1);await p.callMethod('onWorkbenchConfirm');await tap('.cw-work-submit');await until(async()=>(await p.data('workResults')).length===45)
  const scroll=await p.$('.cw-sheet-scroll');assert.ok(Number(await scroll.scrollHeight())>Number((await scroll.size()).height));await scroll.scrollTo(0,100000)
  await until(async()=>{const rows=await p.$$('.cw-work-results view'),last=await rect(rows.at(-1)),b=await rect(scroll);return last.top+Number(last.height)<=b.top+Number(b.height)+1})
  const rows=await p.$$('.cw-work-results view');assert.match(await rows.at(-1).text(),/1936/)
  log('45-row table reaches its final rendered result through real scrolling')
  screenshot('table-last-row')
  await tap('.cw-sheet-close');await key('home');await wait('menu','home');await menu('app-table');await wait('workbench','table');assert.equal((await p.data('workFields')).find(f=>f.id==='end').value,'44')
  await p.callMethod('onWorkbenchKeyboard',{detail:{height:330}})
  await until(async()=>await p.data('workCompact')===true)
  const info=await app.systemInfo(),sheet=await rect(await p.$('.cw-sheet'))
  assert.ok(sheet.top>=0&&sheet.top+Number(sheet.height)<=info.windowHeight-330+1)
  assert.equal(await p.$('.cw-work-submit'),null)
  await p.callMethod('onWorkbenchConfirm');await until(async()=>await p.data('workCompact')===false)
  await tap('.cw-sheet-close')
  log('saved form parameters and keyboard-height layout fixture',{keyboardHeightFixture:330,physicalKeyboard:false})
  await clear();await type('123+456');await app.reLaunch('/pages/index/index');p=await app.reLaunch('/pages/calculator/index');await wait('expression','123+456')
  log('leaving before debounce finishes still restores the expression')
  assert.equal(faults.length,0,faults.join('; '))
  console.log(JSON.stringify({summary:'pass',steps,runtimeExceptions:0,viewport:'phone DevTools; keyboard is an event fixture'}))
 }finally{
  if((await app.currentPage())?.path!=='pages/index/index')await app.reLaunch('/pages/index/index')
  if(backedUp)await app.evaluate(()=>{for(const x of getApp().__cwAdversarialBackup||[]){if(x.exists)wx.setStorageSync(x.key,x.value);else wx.removeStorageSync(x.key)}delete getApp().__cwAdversarialBackup})
  app.disconnect()
 }
})().catch(e=>{console.error(e.message);process.exitCode=1})
