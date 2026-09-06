import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'

let count=0
const failures=[]
function test(name,fn){try{fn();count++;console.log('PASS '+name)}catch(error){failures.push(name);console.error('FAIL '+name+': '+error.message)}}
function setup(){const r=miniRuntime(),p=r.page('pages/calculator/index');p.onLoad();return {r,p}}
function keys(p,...sequence){for(const id of sequence.flat()){
  const key=[...p.data.controlKeys,...p.data.scientificRows.flatMap(r=>r.keys),...p.data.numberRows.flatMap(r=>r.keys)].find(k=>k.id===id)
  assert.ok(key,'known physical key: '+id)
  p.press({currentTarget:{dataset:key}})
  assert.equal(p.data.workbench,'','physical math keys must stay inside the LCD')
  assert.equal(p.data.typing,false,'physical math keys must not open a system keyboard')
}}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`)

test('official fraction-first and numerator-first sequences',()=>{
  for(const seq of [['fraction','7','down','3'],['7','fraction','3']]){
    const {p}=setup();keys(p,seq);assert.equal(p.data.expression,'frac(7,3)');keys(p,'exe');near(p.data.answer,7/3)
  }
})
test('two fractions use RIGHT to leave the denominator',()=>{
  const {p}=setup();keys(p,'fraction','1','down','2','right','plus','fraction','1','down','3','exe')
  near(p.data.answer,5/6);assert.equal(p.data.expression,'frac(1,2)+frac(1,3)');assert.equal(p.data.display,'5/6')
})
test('fraction wraps the previous argument, not the entire sum',()=>{
  const {p}=setup();keys(p,'1','plus','7','fraction','3','exe');near(p.data.answer,1+7/3)
})
test('nested fraction vertical navigation targets the innermost slots',()=>{
  const {p}=setup();keys(p,'fraction','1','down','2','plus','fraction','3','down','4')
  assert.equal(p.data.expression,'frac(1,2+frac(3,4))')
  const before=p.data.cursor;keys(p,'up');assert.equal(p.data.cursor,p.data.expression.indexOf('3')+1)
  keys(p,'down');assert.equal(p.data.cursor,before);keys(p,'exe');near(p.data.answer,4/11)
})
test('empty slots are not silently treated as zero and cannot enter history',()=>{
  const {p}=setup();keys(p,'1','fraction','exe');assert.equal(p.data.hasResult,false);assert.ok(p.data.error);assert.equal(p.data.history.length,0)
  keys(p,'2','exe');near(p.data.answer,.5)
})
test('mixed fraction follows integer RIGHT numerator DOWN denominator',()=>{
  const {p}=setup();keys(p,'shift','fraction','2','right','1','down','3','exe');near(p.data.answer,7/3)
})
test('square completes its exponent, while power retains an editable slot',()=>{
  const {p}=setup();keys(p,'5','square','plus','1','exe');near(p.data.answer,26)
  keys(p,'ac','open-paren','1','plus','1','close-paren','power','2','plus','2','exe');near(p.data.answer,16)
  keys(p,'ac','2','power','3','right','plus','1','exe');near(p.data.answer,9)
})
test('root, nth-root and log base enter and exit inline slots',()=>{
  const {p}=setup();keys(p,'sqrt','9','right','plus','1','exe');near(p.data.answer,4)
  keys(p,'ac','shift','sqrt','5','right','3','2','exe');near(p.data.answer,2)
  keys(p,'ac','log-base','2','right','3','2','exe');near(p.data.answer,5)
  keys(p,'ac','shift','square','2','shift','close-paren','1','6','exe');near(p.data.answer,4)
})
test('catalog combinatorics and DMS use the same inline key editor',()=>{
  const {p}=setup();keys(p,'1','0');p.runAction('ncr-input');keys(p,'3','exe');near(p.data.answer,120)
  keys(p,'ac','1','2','shift','plus','3','0','shift','plus','4','5','shift','plus','exe');near(p.data.answer,12+30/60+45/3600)
})
test('a function following pi or Ans keeps implicit multiplication boundaries',()=>{
  const {p}=setup();keys(p,'shift','7','sin','3','0','exe');near(p.data.answer,Math.PI/2)
  keys(p,'ac','3','exe','ans','sqrt','4','exe');near(p.data.answer,6)
})
test('INS includes a powered parenthesized argument in the root',()=>{
  const {p}=setup();keys(p,'open-paren','minus','2','close-paren','square')
  for(let i=0;i<20;i++)keys(p,'left')
  keys(p,'shift','del','sqrt','exe');near(p.data.answer,2)
})
test('scientific exponent and reciprocal are completed through physical keys',()=>{
  const {p}=setup();keys(p,'1','dot','2','3','exponent','3','exe');near(p.data.answer,1230)
  keys(p,'ac','1','0','shift','power','exe');near(p.data.answer,.1)
})
test('an exponent applied after leaving a power operates on the whole value',()=>{
  const {p}=setup();keys(p,'2','power','3','right','square','exe');near(p.data.answer,64)
})
test('SHIFT EXE decimal conversion is temporary, and FORMAT never rewrites the value',()=>{
  const {p}=setup();keys(p,'1','fraction','3','shift','exe');assert.equal(p.data.formatted.kind,'number');near(p.data.answer,1/3)
  keys(p,'exe');assert.equal(p.data.display,'1/3')
  keys(p,'format');p.executeMenu('format-decimal');assert.equal(p.data.formatted.kind,'number');near(p.data.answer,1/3)
  keys(p,'format');p.executeMenu('format-standard');assert.equal(p.data.display,'1/3')
})
test('SHIFT arrows leave the whole template and DEL never breaks its syntax',()=>{
  const {p}=setup();keys(p,'fraction','1','down','2','shift','right','plus','3','exe');near(p.data.answer,3.5)
  keys(p,'ac','fraction','down','del','del');assert.equal(p.data.expression,'')
})
test('SHIFT DEL then square root captures the expression to the right',()=>{
  const {p}=setup();keys(p,'1','plus','7','fraction','6','left','left','shift','del','sqrt','exe')
  near(p.data.answer,1+Math.sqrt(7/6));assert.equal(p.data.expression,'1+sqrt(frac(7,6))')
})
test('incomplete template and cursor survive leaving and reopening',()=>{
  const {r,p}=setup();keys(p,'fraction','1','down');const cursor=p.data.cursor;p.onUnload()
  const restored=r.page('pages/calculator/index');restored.onLoad();assert.equal(restored.data.expression,'frac(1,)');assert.equal(restored.data.cursor,cursor)
  keys(restored,'2','exe');near(restored.data.answer,.5)
})
test('cursor-only movement and deleting template boundaries never lose saved terms',()=>{
  const {p}=setup();keys(p,'fraction','1','2','down','3','4','right')
  const text=p.data.expression
  for(let i=0;i<20;i++)keys(p,'left')
  for(let i=0;i<20;i++)keys(p,'right')
  assert.equal(p.data.expression,text)
  keys(p,'del');assert.equal(p.data.expression,'frac(12,3)')
})
test('bounded large drafts lay out without invalid sizes or main-thread stalls',()=>{
  const {r}=setup(),editor=r.load('utils/cwEditor'),{layoutExpression}=r.load('utils/cwMathLayout')
  const text='1+'.repeat(200)+'1',before=performance.now()
  for(let i=0;i<20;i++){
    const cursor=editor.moveCursor(text,text.length-i,-1),layout=layoutExpression(text,cursor,true)
    assert.equal(layout.items.filter(i=>i.kind==='caret').length,1)
    assert.ok(layout.width<10000&&layout.height<200)
  }
  assert.ok(performance.now()-before<1000,'20 maximum-ish draft layout checks must be bounded')
})
test('rendered layout contains real slots, fraction bars, roots and exponent glyphs',()=>{
  const {r}=setup();const {layoutExpression}=r.load('utils/cwMathLayout')
  for(const text of ['frac(,)','frac(1,frac(2,3))','sqrt(9)','2^(3)','root(3,8)','logb(2,32)']){
    const layout=layoutExpression(text,text.length-1,true)
    assert.ok(layout.items.length);assert.ok(layout.width>0&&layout.height>0)
    for(const item of layout.items)for(const key of ['x','y','width','height'])assert.ok(Number.isFinite(item[key])&&item[key]>=0,`${text}: ${key}`)
    assert.ok(layout.items.some(item=>item.kind==='caret'),text)
  }
  assert.equal(layoutExpression('frac(,)',5,true).items.filter(i=>i.kind==='slot').length,2)
})
console.log(JSON.stringify({passed:count,failed:failures.length,failures}))
if(failures.length)process.exitCode=1
