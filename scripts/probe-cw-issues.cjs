// Readable live reproduction. Fixtures are confined to calculator state and
// are restored; no account, practice, photo or network configuration is read.
const automator=require(process.env.WECHAT_AUTOMATOR_MODULE||'D:/CodexWork/qa-artifacts/stemist-devtools/node_modules/miniprogram-automator')
;(async()=>{
 const app=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});let backup=false
 try {
  await app.reLaunch('/pages/index/index')
  await app.evaluate(()=>{const all=wx.getStorageInfoSync().keys;getApp().__cwProbeBackup=['stemistCalculatorState','stemistCalculatorHistory'].map(key=>({key,exists:all.includes(key),value:wx.getStorageSync(key)}))});backup=true
  const p=await app.reLaunch('/pages/calculator/index')
  const key=async id=>{await p.waitFor(async()=>{const e=await p.$(`[data-key="${id}"]`);return e&&(await e.size()).height>=44});await(await p.$(`[data-key="${id}"]`)).tap()}
  const state=(name,value)=>p.waitFor(async()=>await p.data(name)===value)
  await key('ac');await state('expression','');await p.setData({variables:{A:0,B:0,C:0,D:0,E:5,F:0,x:0,y:0,z:0}})
  await key('2');await state('expression','2');await key('shift');await state('shiftActive',true);await key('2');await p.waitFor(async()=>!(await p.data('shiftActive')));await key('3');await key('exe');await state('hasResult',true)
  console.log(JSON.stringify({case:'physical E key between digits',fixtureE:5,expression:await p.data('expression'),actual:await p.data('answer'),expected:30}))
  await key('ac');await state('expression','');await p.callMethod('onInput',{detail:{value:'12+34',cursor:5}})
  for(const cursor of [4,3,2]){await key('left');await state('cursor',cursor)}
  const caret=await p.$('.cw-caret'),screen=await p.$('.cw-expression')
  console.log(JSON.stringify({case:'visible caret versus insertion',cursor:await p.data('cursor'),caretLeft:caret?(await caret.offset()).left:null,expressionLeft:(await screen.offset()).left,parts:await p.data('expressionParts')}))
  await key('home');await state('menu','home');await(await p.$('[data-id="app-table"]')).tap();await state('workbench','table')
  const scroll=await p.$('.cw-sheet-scroll')
  console.log(JSON.stringify({case:'long form viewport',scrollSize:await scroll.size(),scrollOffset:await scroll.offset(),fields:(await p.data('workFields')).length}))
 }finally{
  await app.reLaunch('/pages/index/index')
  if(backup)await app.evaluate(()=>{for(const x of getApp().__cwProbeBackup||[]){if(x.exists)wx.setStorageSync(x.key,x.value);else wx.removeStorageSync(x.key)}delete getApp().__cwProbeBackup})
  app.disconnect()
 }
})().catch(e=>{console.error(e.message);process.exitCode=1})
