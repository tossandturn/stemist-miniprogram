import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'

for(const persona of ['eastern-oracle','tarot-reader']){
 const calls=[],rows=[],draws=[];let revision=0,failNext=false
 const envelope=()=>({conversation:{id:'conv-'+persona,persona,revision,turnCount:rows.length/2},messages:rows.slice(-40),nextBefore:''})
 const rt=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,requestJson:async(url,body,options)=>{
  calls.push({url,body,options});if(url.endsWith('/resume'))return envelope()
  if(url.endsWith('/draw')){const kind=persona==='tarot-reader'?'tarot':'hexagram',draw={id:'40000000-0000-4000-8000-'+String(draws.length+1).padStart(12,'0'),kind,spread:body.spread,deckVersion:kind==='tarot'?'rws-text-78-v1':'zhouyi-64-v1',createdAt:Date.now()-1000,expiresAt:Date.now()+1800000,entertainmentOnly:true,cards:[{id:kind==='tarot'?'tarot-major-00-fool':'hexagram-01',name:kind==='tarot'?'愚者 The Fool':'乾',position:'本次提示',...(kind==='tarot'?{orientation:'upright'}:{})}]};draws.push(draw);return{draw}}
  if(failNext){failNext=false;throw Error('synthetic offline')}
  const start=rows.length,answer='回复：'+body.message,turns=[{id:'t'+(start+1),role:'user',content:body.message,sequence:start+1,status:'complete'},{id:'t'+(start+2),role:'assistant',content:answer,sequence:start+2,status:'complete'}];rows.push(...turns);revision++
  return{mode:'ai',providerStatus:'connected',answer,clientTurnId:body.clientTurnId,conversation:envelope().conversation,turns,memory:{contextWindowTokens:100000,estimatedInputUpperBoundTokens:100,countingMethod:'fixture',historyTruncated:false,usedHistoryMessages:start,retrievedSegments:0}}
 }}}})
 rt.storage.set('stemistUser',{id:'synthetic-persona-owner'})
 const p=rt.page('bundles/coach/tavern');p.onLoad();p.choosePersona({currentTarget:{dataset:{persona}}})
 p.onMessage({detail:{value:'先不抽，陪我聊聊今天的电影。'}})
 assert.equal(p.data.message,'先不抽，陪我聊聊今天的电影。','oracle personas must accept ordinary text before any draw')
 await p.submit();assert.equal(draws.length,0);assert.equal(rows.length,2);assert.equal(calls.at(-1).body.drawId,undefined);assert.equal(p.data.message,'')
 p.onMessage({detail:{value:'给我一个周末的灵感'}});await p.drawFortune();assert.equal(draws.length,1);assert.equal(rows.length,4);assert.equal(calls.at(-1).body.drawId,draws[0].id);assert.equal(p.data.message,'')
 p.onMessage({detail:{value:'你刚才说的换个角度，具体怎么做？'}});await p.onComposerConfirm({detail:{value:p.data.message}})
 assert.equal(rows.length,6);assert.equal(draws.length,1,'follow-up must never redraw');assert.equal(calls.at(-1).body.drawId,undefined,'normal follow-up uses server-owned conversation context, not an expiring client receipt');assert.equal(calls.at(-1).body.conversationId,'conv-'+persona)
 failNext=true;p.onMessage({detail:{value:'那聊聊别的也行'}});await p.submit();const failed=calls.at(-1).body;assert.equal(p.data.canRetry,true);await p.retry();assert.equal(calls.at(-1).body.clientTurnId,failed.clientTurnId);assert.equal(calls.at(-1).body.drawId,undefined);assert.equal(draws.length,1)
 p.setData({drawNeedsRedraw:true,draw:{...p.data.draw,expiresAt:Date.now()-1}});p.onMessage({detail:{value:'以前那张牌还可以继续聊吗'}});await p.submit();assert.equal(p.data.error,'');assert.equal(draws.length,1,'expired historical receipt cannot block ordinary chat')
 if(persona==='tarot-reader'){const prior=p.data.draw;p.chooseSpread({currentTarget:{dataset:{spread:'three'}}});assert.equal(p.data.draw.id,prior.id,'next-spread choice must preserve previous result')}
 p.setData({spread:'single'});const apply=p.applyCompletion;p.applyCompletion=()=>false
 await p.drawFortune();assert.equal(p.data.loading,false,'a rejected stale interpretation must release the composer');assert.equal(p.data.interpretLoading,false);p.applyCompletion=apply
 p.onMessage({detail:{value:'还没发送的草稿'}});p.choosePersona({currentTarget:{dataset:{persona:'keeper'}}});p.choosePersona({currentTarget:{dataset:{persona}}});assert.equal(p.data.message,'还没发送的草稿');p.onUnload()
 const restored=rt.page('bundles/coach/tavern');restored.onLoad();assert.equal(restored.data.message,'还没发送的草稿');assert.equal(restored.data.persona,persona);restored.onUnload();await settle()
}
const template=fs.readFileSync(new URL('../bundles/coach/tavern.wxml',import.meta.url),'utf8')
assert.doesNotMatch(template,/<textarea[^>]*wx:if="{{!selected.divinationKind}}"/)
assert.match(template,/id="fortune-draw"[^>]*bindtap="drawFortune"/)
assert.match(template,/id="tavern-send"[^>]*bindtap="submit"/)
console.log('Oracle personas: chat/draw/follow-up, expired result, idempotent chat retry and private draft continuity PASS')
