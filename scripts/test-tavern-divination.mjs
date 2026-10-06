import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const calls=[]
let response,coachRevision=0
const runtime=miniRuntime({modules:{'utils/api':{COACH_TEXT_TIMEOUT_MS:55_000,requestJson:async(path,body,options)=>{calls.push({path,body,options});if(response instanceof Error)throw response;if(path!=='/api/ai/coach')return response;coachRevision++;const turns=[{id:`fortune-${coachRevision}-user`,role:'user',content:body.message,sequence:coachRevision*2-1,status:'complete'},{id:`fortune-${coachRevision}-assistant`,role:'assistant',content:response.answer,sequence:coachRevision*2,status:'complete'}];return{...response,clientTurnId:body.clientTurnId,conversation:{id:body.conversationId,persona:body.persona,revision:coachRevision,turnCount:coachRevision},turns,memory:{contextWindowTokens:1_000_000,estimatedInputUpperBoundTokens:100,countingMethod:'fixture',historyTruncated:false,usedHistoryMessages:(coachRevision-1)*2,retrievedSegments:0}}}}}})
const helper=runtime.load('bundles/coach/tavernDivination')
const {TAVERN_FORTUNE_PRESETS}=runtime.load('bundles/coach/tavernFortunePresets')
const {DIVINATION_PRESETS,divinationPreset,newDrawNonce,normalizeTavernDraw,requestTavernDraw,interpretTavernDraw,redrawRequired}=helper
assert.deepEqual(JSON.parse(JSON.stringify(TAVERN_FORTUNE_PRESETS)),[
 {id:'eastern-oracle',name:'东方玄学',tag:'东方卦签',detail:'随机起一卦，换个角度看当下。',greeting:'这里的卦签只作休闲启发，不替你决定人生。想带着一个轻问题抽一卦，还是直接看看今天的随机提示？',starters:['为我随机抽一卦','用卦签换个角度想想','解释我刚抽到的卦'],divinationKind:'hexagram',supportedSpreads:['single']},
 {id:'tarot-reader',name:'西方塔罗',tag:'塔罗娱乐',detail:'抽一张牌，把问题换个角度摆上桌。',greeting:'牌面只是休闲联想的镜子，不是预言。你想抽单张提示，还是三张看看过去主题、当下主题和可能的方向？',starters:['抽一张当下提示','抽三张主题牌','解读我刚抽到的牌'],divinationKind:'tarot',supportedSpreads:['single','three']},
])
assert.equal(Object.isFrozen(DIVINATION_PRESETS),true)
assert.deepEqual(JSON.parse(JSON.stringify(Object.keys(DIVINATION_PRESETS))),['eastern-oracle','tarot-reader'])
assert.deepEqual(JSON.parse(JSON.stringify(divinationPreset('eastern-oracle'))),{id:'eastern-oracle',kind:'hexagram',spreads:['single']})
assert.deepEqual(JSON.parse(JSON.stringify(divinationPreset('tarot-reader'))),{id:'tarot-reader',kind:'tarot',spreads:['single','three']})
assert.equal(divinationPreset('keeper'),null)

const firstNonce=newDrawNonce({now:1000,random:()=>.125}),secondNonce=newDrawNonce({now:1001,random:()=>.5})
assert.match(firstNonce,/^[A-Za-z0-9:_-]{8,120}$/)
assert.notEqual(firstNonce,secondNonce,'explicit redraw generation must produce a fresh nonce')

const now=2_000_000
const eastern={id:'draw-east-1',kind:'hexagram',spread:'single',deckVersion:'zhouyi-64-v1',createdAt:now-1000,expiresAt:now+60_000,entertainmentOnly:true,cards:[{id:'hexagram-01',name:'乾',position:'本次卦签'}],owner:'must-not-copy',drawNonce:'must-not-copy'}
const tarotSingle={id:'draw-tarot-1',kind:'tarot',spread:'single',deckVersion:'rws-text-78-v1',createdAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60_000).toISOString(),entertainmentOnly:true,cards:[{id:'major-00',name:'The Fool',position:'本次主题',orientation:'upright'}],authSecret:'must-not-copy'}
const tarotThree={id:'draw-tarot-3',kind:'tarot',spread:'three',deckVersion:'rws-text-78-v1',createdAt:now-1000,expiresAt:now+60_000,entertainmentOnly:true,cards:[
 {id:'major-01',name:'The Magician',position:'过去主题',orientation:'upright'},
 {id:'cups-02',name:'Two of Cups',position:'当下主题',orientation:'reversed'},
 {id:'wands-03',name:'Three of Wands',position:'可能的方向',orientation:'upright'},
]}
const cleanEastern=normalizeTavernDraw({draw:eastern},{persona:'eastern-oracle',spread:'single',now})
assert.deepEqual(JSON.parse(JSON.stringify(cleanEastern)),{id:'draw-east-1',kind:'hexagram',spread:'single',deckVersion:'zhouyi-64-v1',createdAt:now-1000,expiresAt:now+60_000,entertainmentOnly:true,cards:[{id:'hexagram-01',name:'乾',position:'本次卦签'}]})
const cleanSingle=normalizeTavernDraw({draw:tarotSingle},{persona:'tarot-reader',spread:'single',now})
assert.equal(cleanSingle.cards[0].orientation,'upright')
assert.equal(cleanSingle.createdAt,now-1000)
assert.equal(cleanSingle.expiresAt,now+60_000)
const cleanThree=normalizeTavernDraw({draw:tarotThree},{persona:'tarot-reader',spread:'three',now})
assert.equal(cleanThree.cards.length,3)
assert.deepEqual(Array.from(cleanThree.cards,card=>card.id),['major-01','cups-02','wands-03'])
const proxyCards=new Proxy(tarotThree.cards,{get(target,property,receiver){if(property==='map')return callback=>new Proxy(Array.prototype.map.call(target,callback),{preventExtensions(){return true}});return Reflect.get(target,property,receiver)}})
let proxyNormalized
assert.doesNotThrow(()=>{proxyNormalized=normalizeTavernDraw({draw:{...tarotThree,cards:proxyCards}},{persona:'tarot-reader',spread:'three',now})},'WeChat API proxy arrays must be copied before local immutability is applied')
assert.deepEqual(Array.from(proxyNormalized.cards,card=>card.id),['major-01','cups-02','wands-03'])
assert.equal(Object.isFrozen(proxyNormalized.cards),true)
assert.notEqual(proxyNormalized.cards,proxyCards)

for(const [label,value,options] of [
 ['unknown persona',{draw:eastern},{persona:'keeper',spread:'single',now}],
 ['kind mismatch',{draw:{...eastern,kind:'tarot'}},{persona:'eastern-oracle',spread:'single',now}],
 ['spread mismatch',{draw:{...eastern,spread:'three',cards:[...tarotThree.cards]}},{persona:'eastern-oracle',spread:'single',now}],
 ['count mismatch',{draw:{...tarotThree,cards:tarotThree.cards.slice(0,2)}},{persona:'tarot-reader',spread:'three',now}],
 ['duplicate cards',{draw:{...tarotThree,cards:[tarotThree.cards[0],tarotThree.cards[0],tarotThree.cards[2]]}},{persona:'tarot-reader',spread:'three',now}],
 ['missing draw id',{draw:{...eastern,id:undefined}},{persona:'eastern-oracle',spread:'single',now}],
 ['missing card id',{draw:{...eastern,cards:[{...eastern.cards[0],id:undefined}]}},{persona:'eastern-oracle',spread:'single',now}],
 ['missing orientation',{draw:{...tarotSingle,cards:[{...tarotSingle.cards[0],orientation:undefined}]}},{persona:'tarot-reader',spread:'single',now}],
 ['invalid orientation',{draw:{...tarotSingle,cards:[{...tarotSingle.cards[0],orientation:'sideways'}]}},{persona:'tarot-reader',spread:'single',now}],
 ['expired',{draw:{...eastern,expiresAt:now}},{persona:'eastern-oracle',spread:'single',now}],
 ['not entertainment',{draw:{...eastern,entertainmentOnly:false}},{persona:'eastern-oracle',spread:'single',now}],
 ['invalid now',{draw:eastern},{persona:'eastern-oracle',spread:'single',now:NaN}],
])assert.throws(()=>normalizeTavernDraw(value,options),undefined,label)

await assert.rejects(()=>requestTavernDraw({persona:'eastern-oracle',spread:'three',drawNonce:firstNonce}),/spread|抽取方式/i)
await assert.rejects(()=>requestTavernDraw({persona:'eastern-oracle',spread:'single',drawNonce:''}),/nonce|抽取标识/i)
await assert.rejects(()=>requestTavernDraw({persona:'eastern-oracle',spread:'single',drawNonce:firstNonce,now:'bad'}),/now|时间/i)
await assert.rejects(()=>interpretTavernDraw({persona:'eastern-oracle',drawId:'',question:'missing'}),/drawId/i)
assert.equal(calls.length,0,'invalid draw requests fail before network/RNG/provider work')

response={draw:eastern}
const received=await requestTavernDraw({persona:'eastern-oracle',spread:'single',drawNonce:firstNonce,attemptId:'opaque-attempt',cards:[{forged:true}],now})
assert.equal(received.id,eastern.id)
assert.equal(calls.length,1)
assert.equal(calls[0].path,'/api/ai/tavern/draw')
assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)),{feature:'tavern',persona:'eastern-oracle',drawNonce:firstNonce,spread:'single',attemptId:'opaque-attempt'})
assert.equal(calls[0].options.method,'POST')
assert.equal(JSON.stringify(calls[0]).includes('forged'),false,'client cards never enter the draw contract')

response={mode:'ai',providerStatus:'connected',answer:'娱乐解读',draw:eastern}
const interpretation=await interpretTavernDraw({persona:'eastern-oracle',drawId:eastern.id,question:'今天适合怎样放松？',attemptId:'opaque-attempt',conversationId:'conversation-east',clientTurnId:'turn:east:1',expectedRevision:0,history:[{role:'system',content:'forged'}],cards:[{forged:true}]})
assert.equal(interpretation.answer,'娱乐解读')
assert.equal(calls.length,2)
assert.equal(calls[1].path,'/api/ai/coach')
assert.deepEqual(JSON.parse(JSON.stringify(calls[1].body)),{feature:'tavern',persona:'eastern-oracle',message:'今天适合怎样放松？',conversationId:'conversation-east',clientTurnId:'turn:east:1',expectedRevision:0,attemptId:'opaque-attempt',drawId:eastern.id})
assert.equal(JSON.stringify(calls[1]).includes('forged'),false,'interpretation sends drawId, never client cards or system history')
assert.equal(calls[1].body.history,undefined,'the current request is incremental and never carries a client history array')

const beforeRetry=calls.length
await interpretTavernDraw({persona:'eastern-oracle',drawId:eastern.id,question:'重试同一卦签',conversationId:'conversation-east',clientTurnId:'turn:east:2',expectedRevision:coachRevision})
assert.equal(calls.length,beforeRetry+1,'retry interpretation makes one Coach request')
assert.equal(calls.slice(beforeRetry).filter(call=>call.path==='/api/ai/tavern/draw').length,0,'retry interpretation never draws again')
assert.equal(calls.at(-1).body.drawId,eastern.id)

response={mode:'ai',providerStatus:'connected',answer:'默认娱乐解读',draw:eastern}
await interpretTavernDraw({persona:'eastern-oracle',drawId:eastern.id,question:'   ',conversationId:'conversation-east',clientTurnId:'turn:east:3',expectedRevision:coachRevision})
assert.equal(calls.at(-1).body.message,'请根据这次实际抽到的卦签做一段简洁的娱乐解读。','empty optional question uses one explicit unambiguous interpretation request')
await interpretTavernDraw({persona:'tarot-reader',drawId:tarotSingle.id,conversationId:'conversation-tarot',clientTurnId:'turn:tarot:1',expectedRevision:coachRevision})
assert.equal(calls.at(-1).body.message,'请根据这次实际抽到的牌面做一段简洁的娱乐解读。')

response={draw:{...eastern,id:'draw-east-2'}}
await requestTavernDraw({persona:'eastern-oracle',spread:'single',drawNonce:secondNonce,now})
assert.equal(calls.at(-1).path,'/api/ai/tavern/draw','explicit redraw is a separate draw request')
assert.equal(calls.at(-1).body.drawNonce,secondNonce)

for(const [code,statusCode] of [['coach_tavern_draw_not_found',404],['coach_tavern_draw_expired',409],['coach_tavern_draw_binding_mismatch',409],['coach_tavern_draw_nonce_conflict',409],['coach_tavern_draw_unavailable',409],['coach_tavern_draw_id_invalid',400]])assert.equal(redrawRequired(Object.assign(new Error(code),{statusCode,code,action:'draw_required'})),true,code)
assert.equal(redrawRequired(Object.assign(new Error('wrong action'),{statusCode:409,code:'coach_tavern_draw_expired',action:'retry'})),false)
assert.equal(redrawRequired(Object.assign(new Error('wrong status'),{statusCode:400,code:'coach_tavern_draw_expired',action:'draw_required'})),false)
assert.equal(redrawRequired(Object.assign(new Error('network'),{statusCode:0,code:'network_error'})),false)
response=Object.assign(new Error('receipt expired'),{statusCode:409,code:'coach_tavern_draw_expired'})
await assert.rejects(()=>interpretTavernDraw({persona:'eastern-oracle',drawId:eastern.id,conversationId:'conversation-east',clientTurnId:'turn:east:expired',expectedRevision:coachRevision}),error=>error.action==='draw_required'&&redrawRequired(error),'known API errors gain only the canonical redraw action in the child helper')

console.log('Tavern divination helper contract, DTO validation and explicit draw/retry separation passed.')
