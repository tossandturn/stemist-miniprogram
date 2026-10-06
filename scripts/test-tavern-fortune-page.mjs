import assert from 'node:assert/strict'
import {deferred,miniRuntime,settle} from './helpers/mini-runtime.mjs'

const now=Date.now()
const easternDraw=(id='east-1')=>({draw:{id,kind:'hexagram',spread:'single',deckVersion:'zhouyi-64-v1',createdAt:now-1000,expiresAt:now+1_800_000,entertainmentOnly:true,cards:[{id:'hexagram-01',name:'乾',position:'本次卦签'}]}})
const tarotDraw=(id='tarot-1')=>({draw:{id,kind:'tarot',spread:'three',deckVersion:'rws-text-78-v1',createdAt:now-1000,expiresAt:now+1_800_000,entertainmentOnly:true,cards:[
 {id:'major-00',name:'愚者 The Fool',position:'过去主题',orientation:'upright'},
 {id:'cups-02',name:'圣杯二 Two of Cups',position:'当下主题',orientation:'reversed'},
 {id:'wands-03',name:'权杖三 Three of Wands',position:'可能的方向',orientation:'upright'},
]}})
const drawQueue=[],coachQueue=[],calls=[]
const take=async queue=>{const value=queue.shift();if(value instanceof Error)throw value;return await value}
const runtime=miniRuntime({modules:{'utils/api':{
 isAuthError:error=>error?.code==='auth_required',
 askCoach:async()=>({mode:'ai',providerStatus:'connected',answer:'ordinary'}),
 requestJson:async(path,body,options)=>{calls.push({path,body,options});return path==='/api/ai/tavern/draw'?take(drawQueue):take(coachQueue)},
 COACH_TEXT_TIMEOUT_MS:55_000,
}}})
runtime.storage.set('stemistUser',{id:'fortune-owner'})
const page=runtime.page('bundles/coach/tavern');page.onLoad()
assert.deepEqual(page.data.categories.map(item=>item.id),['all','companion','story','fortune'])
assert.equal(page.data.personas.length,8)
page.chooseCategory({currentTarget:{dataset:{category:'fortune'}}})
assert.deepEqual(Array.from(page.data.visiblePersonas,item=>item.id),['eastern-oracle','tarot-reader'])
assert.equal(calls.length,0,'category filtering never calls an API')
page.choosePersona({currentTarget:{dataset:{persona:'eastern-oracle'}}})
assert.equal(page.data.presetChosen,true)
assert.equal(page.data.selected.divinationKind,'hexagram')
assert.equal(calls.length,0,'fortune selection never draws or calls AI')
page.useStarter({currentTarget:{dataset:{text:page.data.starters[0]}}})
assert.equal(page.data.question,page.data.starters[0])
assert.equal(calls.length,0,'fortune starter only fills the optional question')

const firstCoach=deferred();drawQueue.push(easternDraw());coachQueue.push(firstCoach.promise)
const firstPending=page.drawFortune();await settle();await settle()
assert.equal(calls.filter(call=>call.path==='/api/ai/tavern/draw').length,1)
assert.equal(calls.filter(call=>call.path==='/api/ai/coach').length,1)
assert.equal(page.data.draw.id,'east-1','actual cards render before slow interpretation completes')
assert.equal(page.data.draw.cards[0].name,'乾')
assert.equal(page.data.interpretLoading,true)
assert.equal(page.data.turns.length,0)
firstCoach.resolve({mode:'ai',providerStatus:'connected',answer:'乾卦娱乐解读',draw:easternDraw().draw});await firstPending
assert.equal(page.data.interpretLoading,false)
assert.equal(page.data.turns.length,2)
assert.equal(page.data.turns[1].content,'乾卦娱乐解读')
assert.equal(runtime.storage.get(page.key()).draw.id,'east-1','role-owned state persists the safe receipt')
page.openSelector();page.choosePersona({currentTarget:{dataset:{persona:'tarot-reader'}}});page.openSelector();page.choosePersona({currentTarget:{dataset:{persona:'eastern-oracle'}}})
assert.equal(page.data.draw.id,'east-1','switching roles restores only that role owned draw')
assert.equal(page.data.turns[1].content,'乾卦娱乐解读')

page.openSelector();page.choosePersona({currentTarget:{dataset:{persona:'tarot-reader'}}});page.chooseSpread({currentTarget:{dataset:{spread:'three'}}});page.onFortuneQuestion({detail:{value:'这周怎样安排休息？'}})
const providerError=Object.assign(new Error('provider unavailable'),{statusCode:503,code:'provider_unavailable'})
drawQueue.push(tarotDraw());coachQueue.push(providerError)
await page.drawFortune()
assert.equal(page.data.draw.id,'tarot-1')
assert.equal(page.data.draw.cards.length,3)
assert.equal(page.data.question,'这周怎样安排休息？')
assert.equal(page.data.canRetry,true)
assert.match(page.data.error,/保留|重试/)
const drawCallsBeforeRetry=calls.filter(call=>call.path==='/api/ai/tavern/draw').length,coachCallsBeforeRetry=calls.filter(call=>call.path==='/api/ai/coach').length
coachQueue.push({mode:'ai',providerStatus:'connected',answer:'三张牌娱乐解读',draw:tarotDraw().draw})
await page.retryInterpretation()
assert.equal(calls.filter(call=>call.path==='/api/ai/tavern/draw').length,drawCallsBeforeRetry,'retry interpretation never redraws')
assert.equal(calls.filter(call=>call.path==='/api/ai/coach').length,coachCallsBeforeRetry+1)
assert.equal(calls.at(-1).body.drawId,'tarot-1')

const previousNonce=calls.findLast(call=>call.path==='/api/ai/tavern/draw').body.drawNonce
drawQueue.push(tarotDraw('tarot-2'));coachQueue.push({mode:'ai',providerStatus:'connected',answer:'新牌解读',draw:tarotDraw('tarot-2').draw})
await page.redrawFortune()
const latestDrawCall=calls.findLast(call=>call.path==='/api/ai/tavern/draw')
assert.notEqual(latestDrawCall.body.drawNonce,previousNonce,'explicit redraw uses a fresh nonce')
assert.equal(page.data.draw.id,'tarot-2')
const share=page.onShareAppMessage.call({...page,route:'bundles/coach/tavern'})
assert.doesNotMatch(JSON.stringify(share),/tarot-2|这周怎样安排休息|drawNonce|fortune-owner/,'sharing never leaks draw, question, nonce or owner state')

const expired=Object.assign(new Error('expired'),{statusCode:409,code:'coach_tavern_draw_expired'})
coachQueue.push(expired);const callsBeforeExpiry=calls.length;await page.retryInterpretation()
assert.equal(page.data.draw.id,'tarot-2','expired interpretation keeps the visible cards for honest recovery')
assert.equal(page.data.drawNeedsRedraw,true)
assert.match(page.data.error,/重新抽取/)
assert.equal(calls.filter(call=>call.path==='/api/ai/tavern/draw').length,3,'expiry never silently redraws')
await page.retry();assert.equal(calls.length,callsBeforeExpiry+1,'generic retry cannot bypass a redraw-required state')

page.clear()
assert.equal(page.data.draw,null)
assert.equal(page.data.question,'')
assert.equal(runtime.storage.get(page.key())?.draw??null,null)

const lateDraw=deferred(),lateCalls=[]
const lateRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,askCoach:async()=>({}),COACH_TEXT_TIMEOUT_MS:55_000,requestJson:async(path,body)=>{lateCalls.push({path,body});return lateDraw.promise}}}})
lateRuntime.storage.set('stemistUser',{id:'late-fortune-owner'})
const latePage=lateRuntime.page('bundles/coach/tavern');latePage.onLoad();latePage.chooseCategory({currentTarget:{dataset:{category:'fortune'}}});latePage.choosePersona({currentTarget:{dataset:{persona:'eastern-oracle'}}})
const latePending=latePage.drawFortune();await settle();lateRuntime.storage.set('stemistUser',{id:'next-owner'});latePage.onShow();lateDraw.resolve(easternDraw('late-draw'));await latePending
assert.equal(latePage.data.draw,null,'late draw cannot cross an owner boundary')
assert.equal(lateRuntime.storage.has('stemistTavern:next-owner:0:eastern-oracle'),false)

const epochDraw=deferred(),epochRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,askCoach:async()=>({}),COACH_TEXT_TIMEOUT_MS:55_000,requestJson:()=>epochDraw.promise}}})
epochRuntime.storage.set('stemistUser',{id:'late-epoch-owner'})
const epochPage=epochRuntime.page('bundles/coach/tavern');epochPage.onLoad();epochPage.chooseCategory({currentTarget:{dataset:{category:'fortune'}}});epochPage.choosePersona({currentTarget:{dataset:{persona:'eastern-oracle'}}})
const epochPending=epochPage.drawFortune();await settle();epochRuntime.storage.set('stemistPrivacyEpoch',1);epochPage.onShow();epochDraw.resolve(easternDraw('late-epoch-draw'));await epochPending
assert.equal(epochPage.data.draw,null,'late draw cannot cross a privacy epoch')
assert.equal(epochRuntime.storage.has('stemistTavern:late-epoch-owner:1:eastern-oracle'),false)

const staleRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,askCoach:async()=>({}),COACH_TEXT_TIMEOUT_MS:55_000,requestJson:async()=>{throw new Error('must not call')}}}})
staleRuntime.storage.set('stemistUser',{id:'stale-owner'});staleRuntime.storage.set('stemistTavern:stale-owner:0:selected','eastern-oracle')
staleRuntime.storage.set('stemistTavern:stale-owner:0:eastern-oracle',{owner:'stale-owner',epoch:0,persona:'eastern-oracle',question:'expired question',spread:'single',draw:{...easternDraw('expired-local').draw,expiresAt:now-1},turns:[]})
const stalePage=staleRuntime.page('bundles/coach/tavern');stalePage.onLoad()
assert.equal(stalePage.data.draw.id,'expired-local')
assert.equal(stalePage.data.drawNeedsRedraw,true)
assert.match(stalePage.data.error,/过期|重新抽取/)

let authGuestRuntime
authGuestRuntime=miniRuntime({modules:{'utils/api':{isAuthError:error=>error?.code==='auth_required',COACH_TEXT_TIMEOUT_MS:55_000,requestJson:async()=>{authGuestRuntime.storage.delete('stemistUser');const error=new Error('登录已过期');error.code='auth_required';error.statusCode=401;throw error}}}})
authGuestRuntime.storage.set('stemistUser',{id:'fortune-auth-owner'})
const authGuestPage=authGuestRuntime.page('bundles/coach/tavern');authGuestPage.onLoad();authGuestPage.chooseCategory({currentTarget:{dataset:{category:'fortune'}}});authGuestPage.choosePersona({currentTarget:{dataset:{persona:'eastern-oracle'}}});authGuestPage.onFortuneQuestion({detail:{value:'登录恢复后继续'}});await authGuestPage.drawFortune()
assert.equal(authGuestPage.data.loading,false)
assert.equal(authGuestPage.data.drawLoading,false)
assert.equal(authGuestPage.data.authRequired,true)
assert.equal(authGuestPage.data.question,'','actual 401 identity loss hides private question text')
assert.equal(authGuestPage.data.draw,null)
assert.equal(authGuestPage.data.turns.length,0)
assert.match(authGuestPage.data.error,/登录/)
authGuestPage.openAccount();authGuestRuntime.storage.set('stemistUser',{id:'fortune-auth-owner'});authGuestRuntime.storage.set('stemistSessionToken','restored');authGuestPage.onShow()
assert.equal(authGuestPage.data.question,'登录恢复后继续','same-owner login restores the role-owned question')

const authSameRuntime=miniRuntime({modules:{'utils/api':{isAuthError:error=>error?.code==='auth_required',COACH_TEXT_TIMEOUT_MS:55_000,requestJson:async()=>{const error=new Error('请登录');error.code='auth_required';error.statusCode=401;throw error}}}})
authSameRuntime.storage.set('stemistUser',{id:'same-owner'})
const authSamePage=authSameRuntime.page('bundles/coach/tavern');authSamePage.onLoad();authSamePage.chooseCategory({currentTarget:{dataset:{category:'fortune'}}});authSamePage.choosePersona({currentTarget:{dataset:{persona:'tarot-reader'}}});authSamePage.onFortuneQuestion({detail:{value:'保留这个问题'}});await authSamePage.drawFortune()
assert.equal(authSamePage.data.authRequired,true)
assert.equal(authSamePage.data.question,'保留这个问题','auth failure without an identity change preserves current evidence')
assert.equal(authSamePage.data.loading,false)

const redrawGate=deferred(),redrawCalls=[]
const redrawRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,COACH_TEXT_TIMEOUT_MS:55_000,requestJson:async(path,body)=>{redrawCalls.push({path,body});if(path==='/api/ai/tavern/draw')return redrawCalls.filter(call=>call.path===path).length===1?tarotDraw('redraw-old'):redrawGate.promise;return{mode:'ai',providerStatus:'connected',answer:'old interpretation'}}}}})
redrawRuntime.storage.set('stemistUser',{id:'redraw-owner'})
const redrawPage=redrawRuntime.page('bundles/coach/tavern');redrawPage.onLoad();redrawPage.chooseCategory({currentTarget:{dataset:{category:'fortune'}}});redrawPage.choosePersona({currentTarget:{dataset:{persona:'tarot-reader'}}});redrawPage.chooseSpread({currentTarget:{dataset:{spread:'three'}}});await redrawPage.drawFortune()
assert.equal(redrawPage.data.answer,'old interpretation')
const pendingRedraw=redrawPage.redrawFortune();await settle()
assert.equal(redrawPage.data.answer,'','a new explicit draw clears the current answer while retaining labelled history')
assert.equal(redrawPage.data.turns.length,2)
redrawGate.resolve(tarotDraw('redraw-new'));await settle();redrawPage.onUnload();await pendingRedraw

console.log('Tavern fortune page: explicit draw, immediate cards, retry/redraw, expiry and owner guards passed.')
