import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'
const failures=[]
let cases=0
async function test(name, fn){cases++;try{await fn();console.log('PASS '+name)}catch(e){failures.push(name);console.error('FAIL '+name+': '+e.message)}}
const setup=()=>{const r=miniRuntime(),p=r.page('pages/calculator/index');p.onLoad();return{r,p}}
const type=(p,value,cursor=value.length)=>p.onInput({detail:{value,cursor}})
const field=(p,id,value)=>p.onFieldInput({currentTarget:{dataset:{id}},detail:{value}})

await test('E key between digits remains a variable, not an exponent',()=>{
  const {p}=setup();p.setData({variables:{...p.data.variables,E:5}})
  for(const key of ['2','E','3'])p.append(key)
  p.calculate();assert.equal(p.data.answer,30)
})
await test('e constant plus a following digit does not become scientific notation',()=>{
  const {p}=setup();for(const key of ['2','e','+','3'])p.append(key)
  p.calculate();assert.ok(Math.abs(p.data.answer-(2*Math.E+3))<1e-12)
})
await test('Ans and pi have unambiguous boundaries next to digits',()=>{
  const {p}=setup();p.setData({answer:4});p.append('ans');p.append('2');p.calculate();assert.equal(p.data.answer,8)
  p.runAction('clear');p.append('pi');p.append('2');p.calculate();assert.ok(Math.abs(p.data.answer-2*Math.PI)<1e-12)
})
await test('literal scientific notation remains available in keyboard input',()=>{
  const {p}=setup();type(p,'2E3');p.calculate();assert.equal(p.data.answer,2000)
})
await test('omitted multiplication keeps Casio denominator grouping',()=>{
  const {r,p}=setup();const e=r.load('utils/calculator')
  assert.equal(e.evaluateExpression('6/2(1+2)'),1)
  assert.ok(Math.abs(e.evaluateExpression('6/2pi')-6/(2*Math.PI))<1e-12)
  assert.equal(e.evaluateExpression('6/2*3'),9)
  p.setData({variables:{...p.data.variables,E:5}})
  for(const key of ['6','/','2','E'])p.append(key)
  p.calculate();assert.equal(p.data.answer,.6)
})
await test('visible cursor is between the same characters as the edit position',()=>{
  const {p}=setup();type(p,'12+34',2);p.runAction('left')
  const text=p.data.expressionParts.map(part=>part.kind==='caret'?'|':part.text||'').join('')
  assert.equal(text,'1|2+34')
})
await test('arrow navigation never stops inside a named function token',()=>{
  const {p}=setup();type(p,'sin(30)',4);p.runAction('left');assert.equal(p.data.cursor,0)
  p.runAction('right');assert.equal(p.data.cursor,4)
})
await test('editing recalled history uses the current variable environment',()=>{
  const {p}=setup();p.setData({variables:{...p.data.variables,A:2}});type(p,'A+1');p.calculate()
  p.setData({variables:{...p.data.variables,A:5}});p.restoreHistory({currentTarget:{dataset:{index:0}}})
  type(p,'A+2');p.calculate();assert.equal(p.data.answer,7)
})
await test('redefining f cannot leave an old hidden history definition active',()=>{
  const {p}=setup();p.setData({functions:{f:'x^2'}});type(p,'f(3)');p.calculate();p.restoreHistory({currentTarget:{dataset:{index:0}}})
  p.openWorkbench('define-f');field(p,'expression','x+1');p.submitWorkbench();p.calculate();assert.equal(p.data.answer,4)
})
await test('drawer height remains bounded when the keyboard is large',()=>{
  const {p}=setup();p.setData({windowHeight:520});p.openWorkbench('table');p.onWorkbenchKeyboard({detail:{height:330}})
  assert.ok(Number.isFinite(p.data.workScrollHeight)&&p.data.workScrollHeight>=96)
  assert.ok(p.data.workSheetHeight+p.data.keyboardHeight<=520)
})
await test('closing a field dialog does not discard entered values on reopen',()=>{
  const {p}=setup();p.openWorkbench('table');field(p,'expression','sin(x)');field(p,'start','20');p.closeWorkbench();p.openWorkbench('table')
  assert.equal(p.data.workFields.find(f=>f.id==='expression').value,'sin(x)')
  assert.equal(p.data.workFields.find(f=>f.id==='start').value,'20')
})
await test('typing is persisted in a burst and flushed when the page is hidden',async()=>{
  let writes=0;const values=new Map()
  const r=miniRuntime({wx:{setStorageSync:(k,v)=>{if(k==='stemistCalculatorState')writes++;values.set(k,v)},getStorageSync:k=>values.get(k)}})
  const p=r.page('pages/calculator/index');p.onLoad()
  for(const key of '12345678901234567890')p.append(key)
  assert.ok(writes<=1,`received ${writes} synchronous writes for a key burst`)
  p.onHide();assert.equal(values.get('stemistCalculatorState').expression,'12345678901234567890')
})
await test('fraction up/down edits the fraction instead of replacing it with history',()=>{
  const {p}=setup();type(p,'8+1');p.calculate();type(p,'frac(1,2)',8)
  p.runAction('up');assert.equal(p.data.expression,'frac(1,2)');assert.equal(p.data.cursor,6)
  p.runAction('down');assert.equal(p.data.cursor,8)
})
await test('DOWN restores the unfinished input after browsing history',()=>{
  const {p}=setup();type(p,'8+1');p.calculate();type(p,'17+4')
  p.runAction('up');assert.equal(p.data.expression,'8+1')
  p.runAction('down');assert.equal(p.data.expression,'17+4')
})
await test('unfinished input survives a page restart while history is open',()=>{
  const {r,p}=setup();type(p,'8+1');p.calculate();type(p,'17+4');p.runAction('up');p.onUnload()
  const restored=r.page('pages/calculator/index');restored.onLoad();restored.runAction('down');assert.equal(restored.data.expression,'17+4')
})
await test('late native blur does not overwrite a physical key cursor move',()=>{
  const {p}=setup();p.enableTyping();const generation=p.data.editorGeneration;type(p,'12+34');p.runAction('left')
  p.onEditorBlur({currentTarget:{dataset:{editorGeneration:generation}},detail:{cursor:5}})
  assert.equal(p.data.typing,false);assert.equal(p.data.cursor,4)
  p.enableTyping();p.onEditorBlur({currentTarget:{dataset:{editorGeneration:p.data.editorGeneration}},detail:{cursor:2}})
  assert.equal(p.data.cursor,2)
})
await test('late editor events cannot rewrite storage after unload',async()=>{
  const {r,p}=setup();p.enableTyping();type(p,'1+2');p.onUnload()
  r.storage.set('stemistCalculatorState',{expression:'restored-user-value'})
  p.onEditorBlur({detail:{cursor:3}});p.onInput({detail:{value:'3+4',cursor:3}})
  await new Promise(resolve=>setTimeout(resolve,220))
  assert.equal(r.storage.get('stemistCalculatorState').expression,'restored-user-value')
})
await test('late keypad events cannot append history after the page is gone',()=>{
  const {r,p}=setup();type(p,'3+4');p.onUnload()
  r.storage.set('stemistCalculatorHistory',[{expression:'original-history'}])
  p.press({currentTarget:{dataset:{action:'equals'}}})
  assert.equal(r.storage.get('stemistCalculatorHistory')[0].expression,'original-history')
})
await test('phone and tablet keyboard budgets retain an accessible field region',()=>{
  for(const [width,height,keyboard] of [[320,568,216],[375,667,300],[390,753,330],[768,1024,330],[1024,768,352],[540,720,280]]){
    const r=miniRuntime({wx:{getSystemInfoSync:()=>({windowWidth:width,windowHeight:height,screenHeight:height,safeArea:{bottom:height-24},deviceType:width>=540?'tablet':'phone'})}})
    const p=r.page('pages/calculator/index');p.onLoad();p.openWorkbench('table');p.onWorkbenchKeyboard({detail:{height:keyboard}})
    assert.ok(p.data.workScrollHeight>=44);assert.ok(p.data.workSheetHeight+keyboard<=height,`${width}x${height}`)
  }
})
await test('keyboard opening cannot turn portrait iPad into a landscape layout',()=>{
  const info={windowWidth:768,windowHeight:1024,deviceType:'tablet',model:'iPad'}
  const r=miniRuntime({wx:{getSystemInfoSync:()=>({...info})}}),p=r.page('pages/calculator/index');p.onLoad();p.onShow();p.openWorkbench('table');p.onWorkbenchKeyboard({detail:{height:400}})
  info.windowHeight=624;p.onResize({size:{windowWidth:768,windowHeight:624}})
  assert.equal(p.data.orientation,'portrait');assert.equal(p.data.windowHeight,1024)
  info.windowWidth=1024;info.windowHeight=768;p.onResize({size:{windowWidth:1024,windowHeight:768}});assert.equal(p.data.orientation,'landscape')
})
await test('late keyboard/input events from a closed form do not alter the next form',()=>{
  const {p}=setup();p.openWorkbench('table');const generation=p.data.workGeneration;p.closeWorkbench();p.openWorkbench('define-f')
  const currentTarget={dataset:{id:'expression',workGeneration:generation}}
  p.onWorkbenchKeyboard({currentTarget,detail:{height:330}});p.onFieldInput({currentTarget,detail:{value:'late-old-value'}})
  assert.equal(p.data.keyboardHeight,0);assert.equal(p.data.workFields[0].value,'')
})
console.log(JSON.stringify({cases,failed:failures.length,failures}))
if(failures.length)process.exitCode=1
