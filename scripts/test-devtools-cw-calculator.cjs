const assert = require('node:assert/strict')
const automator = require(process.env.WECHAT_AUTOMATOR_MODULE || 'D:/CodexWork/qa-artifacts/stemist-devtools/node_modules/miniprogram-automator')
;(async () => {
  const app = await automator.connect({ wsEndpoint:'ws://127.0.0.1:9420' })
  const faults=[];app.on('exception', e=>faults.push(String(e.message||e).slice(0,200)))
  let backup=false, steps=0
  try {
    await app.reLaunch('/pages/index/index')
    await app.evaluate(()=>{const keys=['stemistCalculatorHistory','stemistCalculatorState'], present=wx.getStorageInfoSync().keys;getApp().__cwQaBackup=keys.map(key=>({key,exists:present.includes(key),value:wx.getStorageSync(key)}))})
    backup=true
    const p=await app.reLaunch('/pages/calculator/index')
    const tap=async selector=>{await p.waitFor(async()=>{const e=await p.$(selector);return e&&Number((await e.size()).height)>=44});await(await p.$(selector)).tap()}
    const key=id=>tap(`[data-key="${id}"]`)
    const menu=id=>tap(`[data-id="${id}"]`)
    const state=async (field,value)=>p.waitFor(async()=>await p.data(field)===value)
    const clear=async()=>{await key('ac');await state('expression','')}
    const type=async value=>{await tap('.cw-expression-scroll');await p.waitFor('.expression-input');await(await p.$('.expression-input')).input(value);await state('expression',value)}
    const field=async(id,value)=>{await(await p.$(`.cw-field-input[data-id="${id}"]`)).input(String(value));await p.waitFor(async()=>(await p.data('workFields')).find(f=>f.id===id)?.value===String(value))}
    const log=(name,details={})=>{steps++;console.log(JSON.stringify({name,status:'pass',...details}))}
    await p.waitFor(async()=>{const e=await p.$('.calc-equals');return e&&Number((await e.size()).height)>0})
    const info=await app.systemInfo(), keys=await p.$$('.cw-key')
    assert.equal(keys.length,48)
    for(const button of keys) { const s=await button.size();assert.ok(s.width>=44&&s.height>=44,`key ${await button.attribute('data-key')} is ${s.width}x${s.height}`) }
    const science=await p.$$('.cw-six-grid');assert.equal(science.length,2)
    const numeric=await p.$$('.cw-number-grid');assert.equal(numeric.length,4)
    const exe=await p.$('.calc-equals'), exeb=await exe.offset(), exes=await exe.size()
    assert.ok(exeb.top+exes.height<=info.windowHeight,`EXE bottom ${exeb.top+exes.height} > window ${info.windowHeight}`)
    log('48 native keys, six/five columns, EXE visible',{width:info.windowWidth,height:info.windowHeight,exeBottom:exeb.top+exes.height})
    await key('settings');await state('menu','settings');await menu('angle-menu');await state('menu','angle');await menu('angle-DEG');await state('angleMode','DEG')
    await clear();await key('shift');await state('shiftActive',true);await key('sin');await state('expression','asin(');await key('dot');await state('expression','asin(.');await key('5');await state('expression','asin(.5');await key('exe');await state('hasResult',true)
    assert.ok(Math.abs(await p.data('answer')-30)<1e-10);assert.equal(await p.data('shiftActive'),false);log('SHIFT inverse trig and EXE auto-closing')
    await clear();await key('fraction');await state('workbench','fraction');await field('numerator',1);await field('denominator',3);await tap('.cw-work-submit');await state('workbench','');await key('exe');await state('hasResult',true);await key('format');await state('menu','format');await menu('format-fraction');await state('display','1/3')
    assert.equal((await p.data('formatted')).kind,'fraction');await key('multiply');await state('expression','ans*');await key('3');await state('expression','ans*3');await key('exe');await state('answer',1);log('fraction template, FORMAT and precise Ans continuation')
    await clear();await type('7');await key('exe');await state('answer',7);await key('variable');await state('menu','variables');await menu('variable-A');await state('menu','variable-actions');await menu('store-variable');await p.waitFor(async()=>(await p.data('variables')).A===7);await key('back');await clear();await key('shift');await state('shiftActive',true);await key('4');await state('expression','A');await key('multiply');await state('expression','A*');await key('2');await state('expression','A*2');await key('exe');await state('answer',14);log('VARIABLE store and SHIFT recall')
    await key('home');await state('menu','home');await menu('app-equation');await state('menu','equation');await menu('work-quadratic');await state('workbench','quadratic');await tap('.cw-work-submit');await p.waitFor(async()=>(await p.data('workResults')).length===2);assert.deepEqual((await p.data('workResults')).map(r=>r.value),['2','3']);await tap('.cw-sheet-close');log('HOME Equation with real roots')
    await key('home');await state('menu','home');await menu('app-table');await state('workbench','table');await field('start',0);await field('end',2);await tap('.cw-work-submit');await p.waitFor(async()=>(await p.data('workResults')).length===3);assert.deepEqual((await p.data('workResults')).map(r=>r.value),['0','1','4']);await tap('.cw-sheet-close');log('HOME Table evaluates x for every row')
    await key('home');await state('menu','home');await menu('app-statistics');await state('workbench','statistics');await field('values','1,2,3');await tap('.cw-work-submit');await p.waitFor(async()=>(await p.data('workResults')).length===7);assert.equal((await p.data('workResults')).find(r=>r.label==='x̄').value,'2');await tap('.cw-sheet-close');log('Statistics mean and standard deviations')
    await key('home');await state('menu','home');await menu('app-base');await state('workbench','base');await field('value','-1');await field('from',10);await field('to',16);await tap('.cw-work-submit');await p.waitFor(async()=>(await p.data('workResults')).length===1);assert.equal((await p.data('workResults'))[0].value,'FFFFFFFF');await tap('.cw-sheet-close');log('Base-N negative 32-bit two-complement')
    await clear();await key('function');await state('menu','functions');await menu('define-f');await state('workbench','define-f');await field('expression','x^2+1');await tap('.cw-work-submit');await state('workbench','');await key('function');await state('menu','functions');await menu('insert-f(');await state('expression','f(');await key('3');await state('expression','f(3');await key('exe');await state('answer',10);log('FUNCTION registration and evaluation')
    await clear();await type('12+34');for(const cursor of [4,3,2]){await key('left');await state('cursor',cursor)}await key('0');await state('expression','120+34');await key('del');await state('expression','12+34');log('physical cursor keys edit the original expression')
    await clear();await type('1/0');await key('exe');await p.waitFor(async()=>Boolean(await p.data('error')));assert.equal(await p.data('hasResult'),false);await key('shift');await state('shiftActive',true);await key('ac');await state('powerOff',true);await key('on');await state('powerOff',false);await clear();log('math error, SHIFT OFF and ON')
    assert.equal(faults.length,0,faults.join(';'))
    if(process.env.CW_SCREENSHOT_PATH) {
      await key('fraction');await state('workbench','fraction');await field('numerator',1);await field('denominator',2);await tap('.cw-work-submit');await state('workbench','');await key('plus');await key('fraction');await state('workbench','fraction');await field('numerator',1);await field('denominator',3);await tap('.cw-work-submit');await state('workbench','');await key('exe');await state('hasResult',true);await key('format');await state('menu','format');await menu('format-fraction');await state('display','5/6')
      const {execFileSync}=require('node:child_process')
      execFileSync('powershell.exe',['-NoProfile','-Command',"& 'D:\\微信web开发者工具\\wechatide.cmd' -c Codex simulator_screenshot --project 'D:\\CodexWork\\stemist-miniprogram' --path '"+process.env.CW_SCREENSHOT_PATH.replace(/'/g,"''")+"' --optimize false"],{windowsHide:true,timeout:20000,stdio:'pipe'})
    }
    console.log(JSON.stringify({summary:'pass',steps,runtimeExceptions:0,calculationEngine:'local'}))
  }finally{
    await app.reLaunch('/pages/index/index')
    if(backup)await app.evaluate(()=>{for(const old of getApp().__cwQaBackup||[]){if(old.exists)wx.setStorageSync(old.key,old.value);else wx.removeStorageSync(old.key)}delete getApp().__cwQaBackup})
    app.disconnect()
  }
})().catch(error=>{console.error(error.message);process.exitCode=1})
