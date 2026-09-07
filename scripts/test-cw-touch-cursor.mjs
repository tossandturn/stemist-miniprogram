import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const r=miniRuntime(),{layoutExpression,hitTestExpression}=r.load('utils/cwMathLayout')
assert.equal(typeof hitTestExpression,'function','natural math needs a source-bound touch hit test')
function glyphCursor(text,glyph,expected,{fraction=.85,occurrence=0,result=false}={}){
 const layout=layoutExpression(text,text.length,!result),item=layout.items.filter(i=>i.kind==='text'&&i.text===glyph)[occurrence]
 assert.ok(item,`${text}: glyph ${glyph}`)
 assert.equal(hitTestExpression(layout,item.x+item.width*fraction,item.y+item.height/2),expected,text)
}
glyphCursor('123+45','2',2)
glyphCursor('123+45','2',1,{fraction:.1})
glyphCursor('frac(12,34)','1',6)
glyphCursor('frac(12,34)','3',9)
glyphCursor('frac(1,frac(23,45))','4',16)
glyphCursor('sqrt(91)+2','9',6)
glyphCursor('2^(34)+5','3',4)
glyphCursor('root(3,81)','3',6)
glyphCursor('root(3,81)','8',8)
glyphCursor('logb(2,32)','2',6)
glyphCursor('conjg(1+2i)','i',10)
glyphCursor('123+45','2',2,{result:true})
glyphCursor('ans+pi','Ans',3)
glyphCursor('ans+pi','π',6)
for(const text of ['frac(,)','sqrt()','2^()','frac(1,sqrt())']){
 const layout=layoutExpression(text,0,true)
 for(const slot of layout.items.filter(i=>i.kind==='slot'))assert.ok(layout.hitMap.carets.some(c=>c.index===hitTestExpression(layout,slot.x+slot.width/2,slot.y+slot.height/2)&&c.depth>0),`empty slot is touch reachable: ${text}`)
}
assert.equal(hitTestExpression(layoutExpression('',0,true),20,15),0)
assert.equal(hitTestExpression(layoutExpression('123',3,true),-40,20),0)
assert.equal(hitTestExpression(layoutExpression('123',3,true),1000,20),3)
assert.equal(hitTestExpression(layoutExpression('123',3,true),NaN,20),null)

const callbacks=[]
const runtime=miniRuntime({wx:{createSelectorQuery(){const q={in(){return q},select(){return q},selectViewport(){return q},boundingClientRect(){return q},scrollOffset(){return q},exec(cb){callbacks.push(cb)}};return q}}})
const page=runtime.page('pages/calculator/index');page.onLoad();page.onShow()
page.onInput({detail:{value:'frac(12,34)',cursor:11}})
const firstGlyph=page.data.expressionLayout.items.find(i=>i.text==='1'),revision=page.data.expressionRevision
page.onExpressionTap({target:{id:'cw-math-'+firstGlyph.id},currentTarget:{dataset:{expressionRevision:revision}}});assert.ok([5,6].includes(page.data.cursor),'coordinate-free glyph activation has a valid numerator caret')
const currentCursor=page.data.cursor;page.onExpressionTap({target:{id:'cw-math-'+firstGlyph.id},currentTarget:{dataset:{expressionRevision:revision}}});assert.equal(page.data.cursor,currentCursor,'old render event is ignored')
const rect={left:-80,top:150,width:310,height:88},viewport={scrollLeft:0,scrollTop:620}
function tapGlyph(glyph,offset=.85){const item=page.data.expressionLayout.items.find(i=>i.kind==='text'&&i.text===glyph);assert.ok(item);const point={clientX:rect.left+item.x+item.width*offset,clientY:rect.top+item.y+item.height/2};page.onExpressionTap({changedTouches:[point]});return callbacks.pop()}
let complete=tapGlyph('1');complete([rect,viewport]);assert.equal(page.data.cursor,6);assert.equal(page.data.typing,false);assert.equal(page.data.expression,'frac(12,34)')
page.append('5');assert.equal(page.data.expression,'frac(152,34)');page.runAction('left');assert.equal(page.data.cursor,6)
assert.equal(page.data.expressionLayout.hitMap,undefined,'hit data stays in logic memory, not the rendering bridge')
page.flushState();page.onUnload();const restored=runtime.page('pages/calculator/index');restored.onLoad();assert.equal(restored.data.cursor,6);assert.equal(restored.data.expression,'frac(152,34)');restored.onUnload()

const p=runtime.page('pages/calculator/index');p.onLoad();p.onShow();p.onInput({detail:{value:'123',cursor:3}})
function tap(p,x=25,y=20){p.onExpressionTap({changedTouches:[{clientX:rect.left+x,clientY:rect.top+y}]});return callbacks.pop()}
let stale=tap(p);p.append('4');stale([rect,viewport]);assert.equal(p.data.cursor,4,'a delayed measurement cannot overwrite a later key press')
stale=tap(p);p.openMenu('home');stale([rect,viewport]);assert.equal(p.data.cursor,4);p.closeMenu()
const first=tap(p,4),second=tap(p,30);second([rect,viewport]);const latest=p.data.cursor;first([rect,viewport]);assert.equal(p.data.cursor,latest,'last tap wins when measurements arrive out of order')
stale=tap(p);p.onHide();stale([rect,viewport]);assert.equal(p.data.cursor,latest,'leaving ignores delayed touches');p.onShow()
p.onExpressionTouchStart({touches:[{clientX:20,clientY:20}],timeStamp:0});p.onExpressionTouchMove({touches:[{clientX:45,clientY:20}]});p.onExpressionTouchEnd({changedTouches:[{clientX:45,clientY:20}],timeStamp:100});p.onExpressionTap({changedTouches:[{clientX:45,clientY:20}]});assert.equal(callbacks.length,0,'dragging scrolls without moving the cursor')
p.onExpressionTouchStart({touches:[{clientX:20,clientY:20},{clientX:50,clientY:20}],timeStamp:0});p.onExpressionTap({changedTouches:[{clientX:20,clientY:20}]});assert.equal(callbacks.length,0,'multi-touch does not relocate the cursor')
p.cancelExpressionTouch();p.onExpressionTap({changedTouches:[{clientX:20,clientY:20}]});assert.equal(callbacks.length,0,'cancelled gestures do not relocate the cursor')
p.onUnload()

const q=runtime.page('pages/calculator/index');q.onLoad();q.onShow();q.onInput({detail:{value:'12+34',cursor:5}});q.calculate();const historyBefore=JSON.stringify(runtime.storage.get('stemistCalculatorHistory'))
let glyph=q.data.expressionLayout.items.find(i=>i.kind==='text'&&i.text==='2')
q.onExpressionTap({detail:{x:rect.left+glyph.x+glyph.width*.85+viewport.scrollLeft,y:rect.top+glyph.y+glyph.height/2+viewport.scrollTop}})
callbacks.pop()([rect,viewport]);assert.equal(q.data.cursor,2);assert.equal(q.data.hasResult,false);assert.equal(q.data.answer,46)
q.append('5');assert.equal(q.data.expression,'125+34','touch after EXE edits the original expression, not a new calculation');assert.equal(JSON.stringify(runtime.storage.get('stemistCalculatorHistory')),historyBefore)
q.switchCalculatorApp('complex');q.__expressionGesture=null;q.onInput({detail:{value:'1+2i',cursor:4}});glyph=q.data.expressionLayout.items.find(i=>i.text==='2');q.onExpressionTap({changedTouches:[{clientX:rect.left+glyph.x+glyph.width*.85,clientY:rect.top+glyph.y+glyph.height/2}]});callbacks.pop()([rect,viewport]);q.append('3');assert.equal(q.data.expression,'1+23i')
q.switchCalculatorApp('calculate');q.openSolver();q.__expressionGesture=null;q.onInput({detail:{value:'x^(2)=9',cursor:7}});glyph=q.data.expressionLayout.items.find(i=>i.text==='2');q.onExpressionTap({changedTouches:[{clientX:rect.left+glyph.x+glyph.width*.85,clientY:rect.top+glyph.y+glyph.height/2}]});callbacks.pop()([rect,viewport]);assert.equal(q.data.cursor,4);q.append('3');assert.equal(q.data.expression,'x^(23)=9')
q.setData({solverPhase:'running'});q.onExpressionTap({detail:{x:10,y:10}});assert.equal(callbacks.length,0);q.onUnload()

const large='1+'.repeat(240)+'1',started=performance.now()
for(let i=0;i<40;i++){const layout=layoutExpression(large,i,true);hitTestExpression(layout,i*3,18);assert.ok(layout.hitMap.carets.length<large.length*2+2)}
assert.ok(performance.now()-started<1200,'layout and hit testing must remain bounded without re-layout for every possible caret')
console.log('CW touch cursor: natural slots, glyph halves, symbols, result editing, scrolling coordinates, stale replies, gesture cancellation, persistence and bounded cost passed.')
