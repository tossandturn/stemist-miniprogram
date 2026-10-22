const {getJson}=require('../../utils/api')
const {DEFAULT_API_BASE,safeApiBase}=require('../../utils/apiOrigin')
const PREFIX='/api/ai/tavern/draw-art/v1/',DRAW_ART_CATALOG_PATH=PREFIX+'catalog.json',KEY='stemistDrawArtCatalogV1',DAY=86400000
const versions={tarot:'rws-text-78-v1',hexagram:'zhouyi-64-v1'}
const text=(v,n)=>typeof v==='string'&&v.trim()&&v.length<=n&&!/[\u0000-\u001f<>]/.test(v)?v.trim():''
const link=v=>typeof v==='string'&&/^https:\/\/[a-z0-9.-]+\/[a-zA-Z0-9_./%#-]*$/.test(v)&&v.length<300
const base=()=>safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE
let pending=null
function normalizeDrawArtCatalog(value){
 const bad=()=>{throw Error('牌面目录暂不可用，请重试。')}
 if(value?.schemaVersion!=='tavern-draw-art.v1'||!text(value.revision,80)||!Array.isArray(value.items)||value.items.length!==142||!Array.isArray(value.credits)||value.credits.length!==2)bad()
 const credits=value.credits.map(c=>{if(!['tarot','hexagram'].includes(c?.kind)||!text(c.title,120)||!text(c.author,120)||!text(c.license,80)||c.sourceUrl&&!link(c.sourceUrl)||c.licenseUrl&&!link(c.licenseUrl)||c.kind==='tarot'&&(!c.sourceUrl||!c.licenseUrl))bad();return{kind:c.kind,title:c.title,author:c.author,license:c.license,sourceUrl:c.sourceUrl||'',licenseUrl:c.licenseUrl||''}})
 if(new Set(credits.map(c=>c.kind)).size!==2)bad()
 const ids=new Set(),counts={tarot:0,hexagram:0}
 const items=value.items.map(x=>{
  if(!x||typeof x.id!=='string'||!/^(?:tarot-(?:major-(?:0\d|1\d|2[01])-[a-z-]+|(?:wands|cups|swords|pentacles)-(?:ace|two|three|four|five|six|seven|eight|nine|ten|page|knight|queen|king))|hexagram-(?:0[1-9]|[1-5]\d|6[0-4]))$/.test(x.id)||ids.has(x.id)||x.kind!==(x.id.startsWith('tarot-')?'tarot':'hexagram')||x.deckVersion!==versions[x.kind]||!/^[a-f0-9]{64}$/.test(x.sha256||'')||!['jpg','png'].some(ext=>x.src===PREFIX+x.id+'-'+x.sha256.slice(0,16)+'.'+ext)||!Number.isInteger(x.bytes)||x.bytes<1||x.bytes>614400||!Number.isInteger(x.width)||x.width<1||x.width>2048||!Number.isInteger(x.height)||x.height<1||x.height>3072||!text(x.alt,160))bad()
  ids.add(x.id);counts[x.kind]++;return{id:x.id,kind:x.kind,deckVersion:x.deckVersion,src:x.src,width:x.width,height:x.height,sha256:x.sha256,bytes:x.bytes,alt:x.alt}
 })
 if(counts.tarot!==78||counts.hexagram!==64)bad()
 return{schemaVersion:value.schemaVersion,revision:value.revision,credits,items}
}
function cachedCatalog(now){try{const record=wx.getStorageSync(KEY),age=now-Number(record?.at);if(record?.base!==base()||!Number.isFinite(age)||age< -60000||age>30*DAY)return null;return{catalog:normalizeDrawArtCatalog(record.catalog),at:record.at}}catch{return null}}
async function fetchDrawArtCatalog({force=false,now=Date.now()}={}){
 const cached=cachedCatalog(now);if(!force&&cached&&now-cached.at<300000)return{catalog:cached.catalog,source:'cache'}
 const origin=base();if(pending?.base===origin)return pending.promise
 let timer
 const promise=(async()=>{
  try{const raw=await Promise.race([getJson(DRAW_ART_CATALOG_PATH,{stemAuth:false,timeout:8000}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('牌面加载超时')),8000)})]),catalog=normalizeDrawArtCatalog(raw);try{wx.setStorageSync(KEY,{base:origin,at:now,catalog})}catch{}return{catalog,source:'network'}}
  catch{if(cached)return{catalog:cached.catalog,source:'cache'};throw Error('暂时无法加载牌面，请重试。')}
  finally{clearTimeout(timer)}
 })().finally(()=>{if(pending?.promise===promise)pending=null})
 pending={base:origin,promise};return promise
}
function artForDraw(draw,catalog){
 if(!draw||!draw.entertainmentOnly)return[]
 const value=draw.cards,keys=value&&typeof value==='object'?Object.keys(value):[],cards=Array.isArray(value)?value:keys.length>0&&keys.length<=3&&keys.every((key,index)=>key===String(index))?keys.map(key=>value[key]):[]
 if(cards.length>3||cards.some(c=>!c||typeof c.id!=='string'||typeof c.name!=='string'||typeof c.position!=='string'))return[]
 return cards.map(card=>{
  const art=catalog?.items.find(x=>x.id===card.id&&x.kind===draw.kind&&x.deckVersion===draw.deckVersion),credit=catalog?.credits.find(x=>x.kind===draw.kind)||null,angle=draw.kind==='tarot'&&card.orientation==='reversed'?180:0
  return{id:String(card.id||''),name:String(card.name||''),shortName:String(card.name||'').split(' · ')[0],position:String(card.position||''),orientationLabel:draw.kind==='tarot'?(angle?'逆位':'正位'):'',angle,key:String(draw.id||'')+'|'+String(card.id||'')+'|'+(art?.sha256.slice(0,16)||''),url:art?base()+art.src:'',credit}
 })
}
module.exports={DRAW_ART_CATALOG_PATH,normalizeDrawArtCatalog,fetchDrawArtCatalog,artForDraw}
