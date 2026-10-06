const {requestJson,COACH_TEXT_TIMEOUT_MS}=require('../../utils/api')
const {boundedTavernHistory}=require('./tavernHistory')

const DIVINATION_PRESETS=Object.freeze({
 'eastern-oracle':Object.freeze({id:'eastern-oracle',kind:'hexagram',spreads:Object.freeze(['single'])}),
 'tarot-reader':Object.freeze({id:'tarot-reader',kind:'tarot',spreads:Object.freeze(['single','three'])}),
})
const DEFAULT_INTERPRETATION=Object.freeze({'eastern-oracle':'请根据这次实际抽到的卦签做一段简洁的娱乐解读。','tarot-reader':'请根据这次实际抽到的牌面做一段简洁的娱乐解读。'})
const REDRAW_STATUS=Object.freeze({coach_tavern_draw_not_found:404,coach_tavern_draw_expired:409,coach_tavern_draw_binding_mismatch:409,coach_tavern_draw_nonce_conflict:409,coach_tavern_draw_unavailable:409,coach_tavern_draw_id_invalid:400})
const divinationPreset=value=>DIVINATION_PRESETS[String(value||'')]||null
const fail=message=>{const error=Error(message);error.code='invalid_tavern_draw';throw error}
function text(value,label,max=160){if(typeof value!=='string')fail(`${label}无效`);const clean=value.trim();if(!clean||clean.length>max)fail(`${label}无效`);return clean}
function optionalId(value,label){if(value===undefined||value===null||value==='')return'';const clean=text(value,label,160);if(!/^[A-Za-z0-9:_-]+$/.test(clean))fail(`${label}无效`);return clean}
function requiredId(value,label){const clean=optionalId(value,label);if(!clean)fail(`${label}无效`);return clean}
function timestamp(value,label){const number=typeof value==='number'?value:Date.parse(value);if(!Number.isFinite(number)||number<0)fail(`${label}无效`);return number}
function currentTime(value){const number=Number(value);if(!Number.isFinite(number)||number<0)fail('当前时间 now 无效');return number}
function spreadFor(persona,spread){const preset=divinationPreset(persona),value=String(spread||'');if(!preset)fail('占卜预设无效');if(!preset.spreads.includes(value))fail('抽取方式 spread 无效');return{preset,spread:value}}
function newDrawNonce({now=Date.now(),random=Math.random}={}){const time=Number(now),value=Number(random());if(!Number.isFinite(time)||!Number.isFinite(value)||value<0||value>=1)fail('抽取标识 nonce 无效');return`draw:${Math.trunc(time).toString(36)}:${Math.floor(value*Number.MAX_SAFE_INTEGER).toString(36)}`}
function normalizeTavernDraw(payload,{persona,spread,now=Date.now()}={}){
 const contract=spreadFor(persona,spread),draw=payload&&typeof payload.draw==='object'&&!Array.isArray(payload.draw)?payload.draw:null
 if(!draw)fail('抽取结果缺失')
 const id=requiredId(draw.id,'drawId'),kind=text(draw.kind,'kind',32),actualSpread=text(draw.spread,'spread',16),deckVersion=text(draw.deckVersion,'deckVersion',80),createdAt=timestamp(draw.createdAt,'createdAt'),expiresAt=timestamp(draw.expiresAt,'expiresAt'),clock=currentTime(now)
 if(kind!==contract.preset.kind||actualSpread!==contract.spread)fail('抽取结果与预设不匹配')
 if(draw.entertainmentOnly!==true)fail('抽取结果缺少娱乐说明')
 if(expiresAt<=createdAt||expiresAt<=clock)fail('抽取结果已过期')
 const expected=actualSpread==='three'?3:1,cards=Array.isArray(draw.cards)?draw.cards:[]
 if(cards.length!==expected)fail('卡牌数量与抽取方式不匹配')
 const seen=new Set(),cleanCards=cards.map(card=>{
  if(!card||typeof card!=='object'||Array.isArray(card))fail('卡牌数据无效')
  const clean={id:requiredId(card.id,'cardId'),name:text(card.name,'name',120),position:text(card.position,'position',80)}
  if(seen.has(clean.id))fail('卡牌不能重复');seen.add(clean.id)
  if(kind==='tarot'){const orientation=String(card.orientation||'');if(!['upright','reversed'].includes(orientation))fail('塔罗方向无效');clean.orientation=orientation}
  return Object.freeze(clean)
 })
 return Object.freeze({id,kind,spread:actualSpread,deckVersion,createdAt,expiresAt,entertainmentOnly:true,cards:Object.freeze(cleanCards)})
}
async function requestTavernDraw({persona,spread,drawNonce,attemptId='',now=Date.now()}={}){
 spreadFor(persona,spread);currentTime(now);const nonce=optionalId(drawNonce,'抽取标识 nonce');if(nonce.length<8||nonce.length>120)fail('抽取标识 nonce 无效');const attempt=optionalId(attemptId,'attemptId')
 let result;try{result=await requestJson('/api/ai/tavern/draw',{feature:'tavern',persona,drawNonce:nonce,spread,...(attempt?{attemptId:attempt}:{})},{method:'POST'})}catch(error){throw classifyDrawError(error)}
 return normalizeTavernDraw(result,{persona,spread,now})
}
async function interpretTavernDraw({persona,drawId,question='',attemptId='',history=[]}={}){
 if(!divinationPreset(persona))fail('占卜预设无效');const id=requiredId(drawId,'drawId'),attempt=optionalId(attemptId,'attemptId'),questionText=String(question||'').trim();if(Array.from(questionText).length>600)fail('娱乐问题过长');const message=questionText||DEFAULT_INTERPRETATION[persona]
 try{return await requestJson('/api/ai/coach',{message,feature:'tavern',persona,drawId:id,...(attempt?{attemptId:attempt}:{}),context:{product:'STEM Studio',skill:'tavern',stage:'practice',source:'stemist-miniprogram'},imageDataUrls:[],history:boundedTavernHistory(history)},{method:'POST',timeout:COACH_TEXT_TIMEOUT_MS||55_000})}catch(error){throw classifyDrawError(error)}
}
function classifyDrawError(error){const code=String(error?.code||''),status=Number(error?.statusCode);if(REDRAW_STATUS[code]===status&&!error.action)error.action='draw_required';return error}
function redrawRequired(error){const code=String(error?.code||'');return REDRAW_STATUS[code]===Number(error?.statusCode)&&error?.action==='draw_required'}

module.exports={DIVINATION_PRESETS,divinationPreset,newDrawNonce,normalizeTavernDraw,requestTavernDraw,interpretTavernDraw,redrawRequired}
