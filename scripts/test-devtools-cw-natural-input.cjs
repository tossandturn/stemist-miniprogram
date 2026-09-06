const assert=require('node:assert/strict')
const {execFileSync}=require('node:child_process')
const path=require('node:path')
const automator=require(process.env.WECHAT_AUTOMATOR_MODULE||'D:/CodexWork/qa-artifacts/stemist-devtools/node_modules/miniprogram-automator')
;(async()=>{
 const app=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'})
 let backedUp=false,p,steps=0,lastKey='',lastWait=''
 const exceptions=[];app.on('exception',e=>exceptions.push(String(e.message||e).slice(0,200)))
 const bounded=(promise,ms=10000)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('UI timeout after step '+steps)),ms)})]).finally(()=>clearTimeout(timer))}
 try{
  if((await app.currentPage())?.path!=='pages/index/index')await bounded(app.reLaunch('/pages/index/index'))
  await app.evaluate(()=>{const names=['stemistCalculatorState','stemistCalculatorHistory'],present=wx.getStorageInfoSync().keys;getApp().__cwNaturalBackup=names.map(key=>({key,exists:present.includes(key),value:wx.getStorageSync(key)}))});backedUp=true
  p=await bounded(app.reLaunch('/pages/calculator/index'))
  const viewport=await app.systemInfo()
  const until=async fn=>{const end=Date.now()+8000;while(Date.now()<end){if(await bounded(fn(),Math.max(1,end-Date.now())))return;await new Promise(r=>setTimeout(r,60))}throw new Error('UI condition not reached after '+steps+' steps')}
  const wait=(key,value)=>{lastWait=key+'='+String(value);return until(async()=>await p.data(key)===value)}
  const rect=async e=>{const o=await e.offset(),s=await e.size();return {left:Number(o.left),top:Number(o.top),width:Number(s.width),height:Number(s.height)}}
  const key=async id=>{
   lastKey=id
   let element;await until(async()=>{element=await p.$(`[data-key="${id}"]`);return element&&Number((await element.size()).height)>=44})
   const b=await rect(element);assert.ok(b.left>=-1&&b.top>=-1&&b.left+b.width<=viewport.windowWidth+1&&b.top+b.height<=viewport.windowHeight+1,id+' visible')
   await element.tap()
   assert.equal(await p.data('workbench'),'','no math form for '+id);assert.equal(await p.data('typing'),false,'no keyboard for '+id)
  }
  const seq=async(...ids)=>{for(const id of ids.flat())await key(id)}
  const clear=async()=>{await key('ac');await wait('expression','')}
  const result=async expected=>{await key('exe');await wait('hasResult',true);assert.ok(Math.abs(await p.data('answer')-expected)<1e-10)}
  const log=name=>{steps++;console.log(JSON.stringify({step:steps,pass:name}))}
  const screenshot=async name=>{
   if(!process.env.CW_NATURAL_SCREENSHOT_DIR)return
   await until(async()=>Boolean(await p.$('.cw-math-glyph')))
   const output=path.join(process.env.CW_NATURAL_SCREENSHOT_DIR,name+'.png')
   execFileSync('powershell.exe',['-NoProfile','-Command',"& 'D:\\微信web开发者工具\\wechatide.cmd' -c Codex simulator_screenshot --project 'D:\\CodexWork\\stemist-miniprogram' --path '"+output.replace(/'/g,"''")+"' --optimize false"],{windowsHide:true,timeout:20000,stdio:'pipe'})
   console.log(JSON.stringify({screenshot:output}))
  }
  await until(async()=>{const current=await app.currentPage();if(current?.path!=='pages/calculator/index')return false;p=current;return Boolean(await p.$('.cw-id-fraction'))})
  if(await p.data('workbench'))await p.callMethod('closeWorkbench')
  await key('on');await key('back');await clear()
  await seq('settings','ok','ok','settings','down','ok','ok')
  await wait('angleMode','DEG');await wait('calculationFormat','standard')
  await key('fraction');await wait('expression','frac(,)')
  await until(async()=>(await p.$$('.cw-math-slot')).length===2)
  assert.equal(await p.$('.cw-sheet'),null);assert.equal(await p.$('.expression-input'),null)
  const lcd=await p.$('.cw-expression-scroll');await lcd.tap();assert.equal(await p.data('typing'),false,'LCD touch must not open OS keyboard')
  await seq('1','down');await wait('cursor',7)
  await screenshot('fraction-inline-slot')
  await seq('2','right','plus','fraction','1','down','3');await wait('expression','frac(1,2)+frac(1,3)')
  await until(async()=>(await p.$$('.cw-math-rule')).length===2)
  await screenshot('two-fractions-editing');await result(5/6);await wait('display','5/6')
  await until(async()=>{const b=await rect(await p.$('.cw-expression-scroll')),glyphs=await p.$$('.cw-math-glyph');for(const glyph of glyphs){const r=await rect(glyph);if(r.top<b.top-1||r.top+r.height>b.top+b.height+1)return false}return true})
  const resultBox=await rect(await p.$('.cw-result-row')),displayBox=await rect(await p.$('.calculator-display'))
  assert.ok(resultBox.top+resultBox.height<=displayBox.top+displayBox.height-4,'fraction answer stays in LCD')
  await screenshot('fraction-standard-result');log('complete fraction input and answer remain visible after EXE')
  await clear();await seq('1','plus','7','fraction','6','left','left','shift','del','sqrt')
  await wait('expression','1+sqrt(frac(7,6))');await result(1+Math.sqrt(7/6));log('manual INS capture into square root')
  await clear();await seq('fraction','1','down','2','plus','fraction','3','down','4','up');await wait('cursor',15)
  const before=await p.data('cursor');await key('down');assert.ok(await p.data('cursor')>before)
  await screenshot('nested-fraction-editing');await result(4/11);log('nested fraction navigation and value')
  await clear();await seq('1','fraction','exe');await wait('hasResult',false);assert.ok(await p.data('error'));await seq('2');await result(.5);log('empty-slot EXE followed by correction')
  await clear();await seq('shift','fraction','2','right','1','down','3');await result(7/3);log('mixed fraction key sequence')
  await clear();await seq('open-paren','1','plus','1','close-paren','power','2','plus','2');await screenshot('exponent-editing');await result(16)
  await clear();await seq('sqrt','9','right','plus','1');await result(4)
  await clear();await seq('shift','sqrt','5','right','3','2');await result(2)
  await clear();await seq('log-base','2','right','3','2');await result(5);log('power, square root, nth root and logarithm')
  await clear();await seq('2','power','3','right','square');await result(64)
  await clear();await seq('1','fraction','3','shift','exe');await wait('hasResult',true);assert.equal((await p.data('formatted')).kind,'number')
  await key('exe');await wait('display','1/3');log('outside power grouping and temporary decimal EXE')
  await clear();await seq('shift','7','sin','3','0');await result(Math.PI/2)
  await clear();await seq('open-paren','minus','2','close-paren','square')
  for(let i=0;i<12;i++)await key('left')
  await seq('shift','del','sqrt');await result(2);log('symbol/function boundary and powered INS argument')
  await clear();await seq('fraction','1','down');const savedCursor=await p.data('cursor')
  await bounded(app.reLaunch('/pages/index/index'));p=await bounded(app.reLaunch('/pages/calculator/index'))
  await wait('expression','frac(1,)');assert.equal(await p.data('cursor'),savedCursor);await seq('2');await result(.5);log('empty denominator draft and caret restore')
  assert.equal(exceptions.length,0,exceptions.join('; '))
  console.log(JSON.stringify({summary:'pass',steps,runtimeExceptions:0,width:viewport.windowWidth,height:viewport.windowHeight,physicalKeysOnly:true}))
 }catch(error){const current=await app.currentPage();console.error(JSON.stringify({steps,lastKey,lastWait,phase:'natural-input',expectedPage:p?.path,currentPage:current?.path,message:error.message}));throw error}finally{
  if((await app.currentPage())?.path!=='pages/index/index')await bounded(app.reLaunch('/pages/index/index'))
  if(backedUp)await app.evaluate(()=>{for(const old of getApp().__cwNaturalBackup||[]){if(old.exists)wx.setStorageSync(old.key,old.value);else wx.removeStorageSync(old.key)}delete getApp().__cwNaturalBackup})
  app.disconnect()
 }
})().catch(e=>{console.error(e.message);process.exitCode=1})
