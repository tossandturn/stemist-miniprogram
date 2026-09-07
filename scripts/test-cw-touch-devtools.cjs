// Opt-in WeChat UI test with memory-only calculator records; no user storage
// clear/backup/restore, no real account, network or media operation.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const output=process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:''
if(!output){console.error('Use --output <QA directory>');process.exit(2)}
const tap=selector=>call('automation_element_action',{action:'tap',selector,'wait-for-selector':selector})
const shot=name=>call('simulator_screenshot',{path:path.resolve(output,name+'.png'),optimize:false})
const mocked=[]
async function mock(method,fn){await call('automation_wx_api',{action:'mock',method,'function-declaration':fn.toString()});mocked.push(method)}
async function sample(glyph,occurrence=0,fraction=.85){
 return evaluate('function(){const p=getCurrentPages().slice(-1)[0],g=p.data.expressionLayout.items.filter(i=>i.kind==="text"&&i.text==='+JSON.stringify(glyph)+')['+occurrence+'];if(!g)throw Error("Fixture glyph missing");return new Promise(resolve=>wx.createSelectorQuery().select("#cw-math-"+g.id).boundingClientRect().selectViewport().scrollOffset().exec(r=>resolve({selector:"#cw-math-"+g.id,x:r[0].left+r[0].width*'+fraction+'+(r[1]?.scrollLeft||0),y:r[0].top+r[0].height/2+(r[1]?.scrollTop||0),cursor:p.data.cursor,expression:p.data.expression}))) }')
}
async function preciseTap(glyph,expected,occurrence=0){const point=await sample(glyph,occurrence);await call('automation_element_action',{action:'trigger',selector:'.cw-expression-scroll',type:'tap',detail:{x:point.x,y:point.y}});await until('function(){return getCurrentPages().slice(-1)[0].data.cursor==='+expected+'}','touch cursor '+expected)}
async function input(value){await evaluate('function(){const p=getCurrentPages().slice(-1)[0];p.onInput({detail:{value:'+JSON.stringify(value)+',cursor:'+value.length+'}});return true}');await until(function(){const p=getCurrentPages().slice(-1)[0];return p.data.expressionLayout.items.some(i=>i.kind==='text')},'expression painted')}
async function run(){
 assert.equal((await call('automation_runtime_info',{action:'currentPage'})).currentPage?.path,'pages/index/index','Start on Home; leave active user work alone')
 fs.mkdirSync(output,{recursive:true})
 await evaluate(function(){if(getApp().__cwTouchQA)throw Error('A cursor QA run is active');getApp().__cwTouchQA={store:{stemistCalculatorState:{expression:'frac(12,34)',cursor:11},stemistCalculatorHistory:[]},writes:0};return true})
 try{
  await mock('getStorageSync',function(key){return getApp().__cwTouchQA.store[key]})
  await mock('setStorageSync',function(key,value){const q=getApp().__cwTouchQA;q.store[key]=JSON.parse(JSON.stringify(value));q.writes++})
  await mock('removeStorageSync',function(key){delete getApp().__cwTouchQA.store[key]})
  await mock('getStorageInfoSync',function(){return {keys:Object.keys(getApp().__cwTouchQA.store)}})
  await call('automation_navigate',{action:'navigateTo',url:'/pages/calculator/index'})
  await evaluate(function(){const p=getCurrentPages().slice(-1)[0],qa=getApp().__cwTouchQA;qa.events=[];for(const name of ['onExpressionTouchStart','onExpressionTouchMove','onExpressionTouchEnd','onExpressionTap','onExpressionScroll']){const original=p[name];p[name]=function(e){qa.events.push({name,x:e.detail?.x,y:e.detail?.y,targetId:e.target?.id,currentId:e.currentTarget?.id,changed:(e.changedTouches||[]).map(t=>({clientX:t.clientX,clientY:t.clientY,pageX:t.pageX,pageY:t.pageY})),touches:e.touches?.length,cancelled:p.__expressionGesture?.cancelled});return original.call(this,e)}}return true})
  const initial=await sample('1')
  await tap(initial.selector)
  const actual=await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {cursor:p.data.cursor,typing:p.data.typing,expression:p.data.expression}})
  assert.ok(actual.cursor===5||actual.cursor===6,'real element tap must enter the numerator');assert.equal(actual.typing,false);assert.equal(actual.expression,'frac(12,34)')
  await preciseTap('1',6)
  await tap('.cw-id-5')
  assert.equal(await evaluate(function(){return getCurrentPages().slice(-1)[0].data.expression}),'frac(152,34)')
  await preciseTap('3',10)
  await shot('touch-fraction-cursor')
  await input('frac(1,frac(23,45))');await preciseTap('4',16);await tap('.cw-id-6')
  assert.equal(await evaluate(function(){return getCurrentPages().slice(-1)[0].data.expression}),'frac(1,frac(23,465))')
  await input('sqrt(91)+2^(34)');await preciseTap('3',13);await shot('touch-power-cursor');await preciseTap('9',6)
  const before=await evaluate(function(){return getCurrentPages().slice(-1)[0].data.cursor})
  const t={identifier:1,clientX:80,clientY:260,pageX:80,pageY:260}
  await call('automation_element_action',{action:'touchstart',selector:'.cw-expression-scroll',touches:[t],'changed-touches':[t]})
  const moved={...t,clientX:120,pageX:120}
  await call('automation_element_action',{action:'touchmove',selector:'.cw-expression-scroll',touches:[moved],'changed-touches':[moved]})
  await call('automation_element_action',{action:'touchend',selector:'.cw-expression-scroll',touches:[],'changed-touches':[moved]})
  await call('automation_element_action',{action:'trigger',selector:'.cw-expression-scroll',type:'tap',detail:{x:120,y:260}})
  assert.equal(await evaluate(function(){return getCurrentPages().slice(-1)[0].data.cursor}),before,'a swipe must not move the cursor')
  await input('12+34');await evaluate(function(){getCurrentPages().slice(-1)[0].calculate();return true});await preciseTap('2',2);await tap('.cw-id-5')
  assert.equal(await evaluate(function(){return getCurrentPages().slice(-1)[0].data.expression}),'125+34')
  await call('automation_navigate',{action:'navigateBack'});await call('automation_navigate',{action:'navigateTo',url:'/pages/calculator/index'})
  const restored=await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {cursor:p.data.cursor,expression:p.data.expression,history:p.data.history.length}})
  assert.deepEqual(restored,{cursor:3,expression:'125+34',history:1})
  await shot('touch-cursor-restored')
  console.log(JSON.stringify({status:'pass',surface:'official WeChat phone simulator',realElementTap:true,preciseCoordinateEvents:true,nestedSlots:true,swipeIgnored:true,restored,realStorageWrites:0}))
 }catch(error){
  console.log(JSON.stringify(await evaluate(function(){const p=getCurrentPages().slice(-1)[0],qa=getApp().__cwTouchQA;return {phase:'failure',route:p.route,cursor:p.data.cursor,fixturePresent:!!qa,touchEnabled:typeof p.onExpressionTap==='function',error:p.data.error,events:qa?.events,request:p.__cursorTapRequest,revision:p.__expressionRenderVersion}})))
  await shot('touch-diagnostic')
  throw error
 }finally{
  if((await call('automation_runtime_info',{action:'currentPage'})).currentPage?.path==='pages/calculator/index')await call('automation_navigate',{action:'navigateBack'})
  for(const method of mocked.reverse())await call('automation_wx_api',{action:'restore',method})
  await evaluate(function(){delete getApp().__cwTouchQA;return {fixtureRemoved:true}})
 }
}
run().catch(e=>{console.error(e.message);process.exitCode=1})
