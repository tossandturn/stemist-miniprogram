// Display-only snapshots: expiry never grants permission to reinterpret a draw.
const id=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(value)
const text=(value,max)=>typeof value==='string'&&value.trim()&&value.length<=max
const time=value=>typeof value==='number'?value:Date.parse(value)
function historyDraw(value,persona=''){
 if(!value||typeof value!=='object'||Array.isArray(value)||!id(value.id)||!['tarot','hexagram'].includes(value.kind)||!text(value.deckVersion,80)||value.entertainmentOnly!==true)return null
 if(persona&&persona!==(value.kind==='tarot'?'tarot-reader':'eastern-oracle'))return null
 if(!['single','three'].includes(value.spread)||value.kind==='hexagram'&&value.spread!=='single')return null
 const createdAt=time(value.createdAt),expiresAt=time(value.expiresAt),cards=value.cards
 if(!Number.isFinite(createdAt)||createdAt<0||!Number.isFinite(expiresAt)||expiresAt<=createdAt||!Array.isArray(cards)||cards.length!==(value.spread==='three'?3:1))return null
 const seen=new Set(),clean=[]
 for(const card of cards){if(!card||!id(card.id)||seen.has(card.id)||!text(card.name,120)||!text(card.position,80)||value.kind==='tarot'&&!['upright','reversed'].includes(card.orientation))return null;seen.add(card.id);clean.push({id:card.id,name:card.name,position:card.position,...(value.kind==='tarot'?{orientation:card.orientation}:{})})}
 return{id:value.id,kind:value.kind,spread:value.spread,deckVersion:value.deckVersion,createdAt,expiresAt,entertainmentOnly:true,cards:clean}
}
function pendingHistoryDraw(state,draw,persona){const safe=historyDraw(draw,persona);return safe&&(state.pendingDrawId===safe.id||state.pendingTurn?.drawId===safe.id)&&!state.turns.some(turn=>turn.draw?.id===safe.id)?safe:null}
module.exports={historyDraw,pendingHistoryDraw}
