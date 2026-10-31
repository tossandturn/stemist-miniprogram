import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'

const makeDraw=(id='draw-one',kind='tarot')=>({id,kind,spread:'single',deckVersion:kind==='tarot'?'rws-text-78-v1':'zhouyi-64-v1',createdAt:Date.now()-1000,expiresAt:Date.now()+1800000,entertainmentOnly:true,cards:[{id:kind==='tarot'?'tarot-major-00-fool':'hexagram-01',name:kind==='tarot'?'愚者':'乾',position:'本次提示',...(kind==='tarot'?{orientation:'reversed'}:{})}]})
const rt=miniRuntime(),contract=rt.load('bundles/coach/tavernConversation'),draw=makeDraw()
const reply={id:'first-assistant',role:'assistant',content:'第一轮解读',sequence:2,status:'complete',draw:{...draw,privateOwner:'not-public',cards:draw.cards.map(c=>({...c,url:'https://unsafe.example/image'}))}}
const normalized=contract.displayTavernMessages([reply])[0]
assert.equal(normalized.draw?.id,draw.id,'canonical history must retain the draw attached to this reply, not only the latest page draw')
assert.equal(normalized.draw.privateOwner,undefined);assert.equal(normalized.draw.cards[0].url,undefined)
assert.equal(contract.displayTavernMessages([{...reply,draw:{...draw,expiresAt:Date.now()-1,createdAt:Date.now()-2000}}])[0].draw.id,draw.id,'expired draw remains display-only history')
assert.equal(contract.mergeTavernMessages([normalized],[{...reply,draw:undefined}])[0].draw.id,draw.id,'older server envelope cannot erase known safe metadata')
assert.throws(()=>contract.mergeTavernMessages([normalized],[{...reply,draw:makeDraw('other')}]),/冲突/)
assert.equal(contract.displayTavernMessages([{...reply,role:'user'}])[0].draw,undefined,'only assistant result bubbles carry artwork')
assert.equal(contract.displayTavernMessages([{...reply,draw:{...draw,kind:'unknown'}}])[0].draw,undefined,'invalid artwork must not break valid text history')

for(const persona of ['tarot-reader','eastern-oracle']){
 const rows=[],draws=[],gates=[];let revision=0,failNext=false
 const envelope=()=>({conversation:{id:'conv-'+persona,persona,revision,turnCount:rows.length/2},messages:rows.slice(-40),nextBefore:''})
 const runtime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,requestJson:async(url,body)=>{
  if(url.endsWith('/resume'))return envelope()
  if(url.endsWith('/draw')){const d=makeDraw('draw-'+(draws.length+1),persona==='tarot-reader'?'tarot':'hexagram');draws.push(d);return{draw:d}}
  if(url.includes('/messages?'))return{...envelope(),messages:rows.slice(0,2),nextBefore:''}
  if(failNext){failNext=false;throw Error('synthetic offline')}
  if(gates.length)await gates.shift().promise
  const start=rows.length,answer='回应 '+body.message,d=draws.find(x=>x.id===body.drawId),turns=[{id:'t'+(start+1),role:'user',content:body.message,sequence:start+1,status:'complete'},{id:'t'+(start+2),role:'assistant',content:answer,sequence:start+2,status:'complete',...(d?{draw:d}:{})}];rows.push(...turns);revision++
  return{mode:'ai',providerStatus:'connected',answer,clientTurnId:body.clientTurnId,conversation:envelope().conversation,turns,...(d?{draw:d}:{}),memory:{contextWindowTokens:100000,estimatedInputUpperBoundTokens:100,countingMethod:'fixture',historyTruncated:false,usedHistoryMessages:start,retrievedSegments:0}}
 }}}})
 runtime.storage.set('stemistUser',{id:'inline-fixture-owner'})
 const p=runtime.page('bundles/coach/tavern');p.onLoad();p.choosePersona({currentTarget:{dataset:{persona}}})
 p.onMessage({detail:{value:'先聊一句'}});await p.submit()
 const gate=deferred();gates.push(gate);p.onMessage({detail:{value:'抽一个灵感'}});const pending=p.drawFortune();await settle();await settle()
 assert.equal(p.data.pendingDraw?.id,draws[0].id,'new artwork appears after existing turns before slow interpretation finishes')
 assert.equal(p.data.turns.length,2);gate.resolve();await pending
 assert.equal(p.data.turns.at(-1).draw.id,draws[0].id);assert.equal(p.data.pendingDraw,null,'successful reply replaces the provisional image, not duplicates it')
 p.onMessage({detail:{value:'继续聊这个'}});await p.submit();assert.equal(p.data.turns.at(-1).draw,undefined);assert.equal(p.data.turns[3].draw.id,draws[0].id);assert.equal(p.data.pendingDraw,null)
 p.onMessage({detail:{value:'再来一个'}});failNext=true;await p.drawFortune();assert.equal(p.data.pendingDraw.id,draws[1].id);assert.equal(p.data.turns[3].draw.id,draws[0].id)
 await p.retryInterpretation();assert.equal(p.data.turns.at(-1).draw.id,draws[1].id);assert.equal(p.data.pendingDraw,null)
 const state=p.read(persona);state.nextBefore='older-page';await p.loadOlderHistory();assert.equal(p.data.historyBrowsing,true);assert.equal(p.data.pendingDraw,null,'latest result must not contaminate older pages')
 p.returnLatestHistory();assert.equal(p.data.turns[3].draw.id,draws[0].id);assert.equal(p.data.turns.at(-1).draw.id,draws[1].id)
 p.onUnload();const restored=runtime.page('bundles/coach/tavern');restored.onLoad();assert.equal(restored.data.turns[3].draw.id,draws[0].id);assert.equal(restored.data.pendingDraw,null)
 runtime.storage.set('stemistUser',{id:'different-owner'});restored.onShow();assert.equal(restored.data.pendingDraw,null);assert.equal(restored.data.turns.length,0);restored.onUnload()
}
const markup=fs.readFileSync(new URL('../bundles/coach/tavern.wxml',import.meta.url),'utf8')
assert.match(markup,/<tavern-draw-art[^>]*draw="{{item.draw}}"/)
assert.doesNotMatch(markup,/<tavern-draw-art[^>]*draw="{{draw}}"/,'no singleton drawing above message list')
assert.ok(markup.indexOf('draw="{{pendingDraw}}"')>markup.indexOf('wx:for="{{turns}}"'),'pending result belongs to the conversation tail')
console.log('Inline draw history, pending result, follow-up, retry, paging, restore and identity isolation PASS')
