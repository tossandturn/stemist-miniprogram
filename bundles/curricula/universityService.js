const {getJson}=require('../../utils/api')

const UNIVERSITY_DIRECTORY_PATH='/data/university-directory.json'
const CACHE_KEY='stemistUniversityDirectory:v1'
const CACHE_SCHEMA=1
const CACHE_MAX_AGE_MS=7*24*60*60*1000
const EXAM_BOARD_CONTRACT=Object.freeze([
 {id:'ap',organization:'College Board',hostname:'apstudents.collegeboard.org'},
 {id:'ib',organization:'International Baccalaureate',hostname:'www.ibo.org'},
 {id:'alevel',organization:'Cambridge International',hostname:'www.cambridgeinternational.org'},
])
const EXAM_BOARD_IDS=Object.freeze(EXAM_BOARD_CONTRACT.map(item=>item.id))
const RANKING_CONTRACT=Object.freeze([
 {id:'qs-world',scope:'world',hostname:'www.topuniversities.com',label:/^QS\b/i},
 {id:'usnews-national',scope:'us-national',hostname:'www.usnews.com',label:/^U\.?S\.?\s*News\b/i},
])
const ID_PATTERN=/^[a-z0-9][a-z0-9._-]{0,99}$/
const DATE_PATTERN=/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2}))?$/

const failure=(message,code='invalid_university_directory')=>Object.assign(Error(message),{code})
function text(value,label,max,{optional=false}={}){
 if(typeof value!=='string')throw failure(`${label}格式无效。`)
 const normalized=value.trim()
 if((!normalized&&!optional)||normalized.length>max||/[\u0000-\u001f\u007f]/.test(normalized))throw failure(`${label}格式无效。`)
 return normalized
}
function id(value,label){const normalized=text(value,label,100);if(!ID_PATTERN.test(normalized))throw failure(`${label}标识无效。`);return normalized}
function isoDate(value,label){
 const normalized=text(value,label,40)
 const parseable=normalized.replace(/(\.\d{3})\d+(?=Z|[+-]\d{2}:\d{2}$)/,'$1')
 if(!DATE_PATTERN.test(normalized)||!Number.isFinite(Date.parse(parseable)))throw failure(`${label}日期格式无效。`)
 if(normalized.length===10&&new Date(normalized+'T00:00:00Z').toISOString().slice(0,10)!==normalized)throw failure(`${label}日期格式无效。`)
 return normalized
}
function safeHttpsUrl(value){
 if(typeof value!=='string'||value!==value.trim()||value.length>1000||/[\s\\?#]/.test(value))return''
 const match=/^https:\/\/([^/]+)(\/[^?#]*)?$/.exec(value)
 if(!match)return''
 const authority=match[1],host=authority.toLowerCase(),path=match[2]||''
 if(authority!==host||authority.includes('@')||authority.includes(':')||host.length>253)return''
 const labels=host.split('.')
 if(labels.length<2||!/[a-z]/.test(labels.at(-1))||labels.some(part=>!/[a-z0-9]/.test(part)||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)))return''
 if(['localhost','local','internal','invalid','test','example','onion'].includes(labels.at(-1))||host==='example.com'||host.endsWith('.example.com'))return''
 if(path&&(!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(path)||path.includes('//')||/%2e/i.test(path)||path.split('/').some(part=>part==='.'||part==='..')||/%(?![0-9a-f]{2})/i.test(path)))return''
 return value
}
function hostnameFromUrl(value){const safe=safeHttpsUrl(value);return safe?safe.slice(8).split('/')[0]:''}
function canonicalUrl(value,label){const normalized=safeHttpsUrl(value);if(!normalized)throw failure(`${label}网址无效。`);return normalized}

function normalizeExamBoards(values){
 if(!Array.isArray(values)||values.length!==EXAM_BOARD_IDS.length)throw failure('课程官网数据不完整。')
 const byId=new Map()
 for(const value of values){
  if(!value||typeof value!=='object')throw failure('课程官网数据格式无效。')
  const boardId=id(value.id,'课程官网')
  if(byId.has(boardId))throw failure('课程官网标识重复。')
  const url=canonicalUrl(value.url,'课程官网'),contract=EXAM_BOARD_CONTRACT.find(item=>item.id===boardId),organization=text(value.organization,'课程机构',120)
  if(!contract||organization!==contract.organization||hostnameFromUrl(url)!==contract.hostname)throw failure('课程官网不是已核验的官方地址。')
  byId.set(boardId,{id:boardId,label:text(value.label,'课程名称',60),organization,url,hostname:contract.hostname})
 }
 if(EXAM_BOARD_IDS.some(boardId=>!byId.has(boardId))||[...byId.keys()].some(boardId=>!EXAM_BOARD_IDS.includes(boardId)))throw failure('课程官网数据不完整。')
 return EXAM_BOARD_IDS.map(boardId=>byId.get(boardId))
}

function normalizeRanking(value,contract){
 if(!value||typeof value!=='object')throw failure('大学排名数据格式无效。')
 const rankingId=id(value.id,'大学排名')
 if(rankingId!==contract.id||value.scope!==contract.scope)throw failure('大学排名范围不匹配。')
 if(value.complete!==true||value.requestedRankLimit!==100)throw failure('大学排名数据不完整。')
 if(!Number.isSafeInteger(value.editionYear)||value.editionYear<2000||value.editionYear>2100)throw failure('大学排名版本无效。')
 if(!Array.isArray(value.items)||value.items.length<100||value.items.length>150)throw failure('大学排名数据数量不完整。')
 const label=text(value.label,'大学排名名称',140)
 const sourceUrl=canonicalUrl(value.sourceUrl,'大学排名来源')
 const methodologyUrl=canonicalUrl(value.methodologyUrl,'大学排名方法')
 if(!contract.label.test(label)||hostnameFromUrl(sourceUrl)!==contract.hostname||hostnameFromUrl(methodologyUrl)!==contract.hostname)throw failure('大学排名不是已核验的官方来源。')
 const seen=new Set()
 let priorRank=0
 const items=value.items.map(item=>{
  if(!item||typeof item!=='object')throw failure('大学排名条目格式无效。')
  const itemId=id(item.id,'大学排名条目')
  if(seen.has(itemId))throw failure('大学排名条目标识重复。')
  seen.add(itemId)
  if(!Number.isSafeInteger(item.rank)||item.rank<1||item.rank>100||item.rank<priorRank)throw failure('大学排名名次无效。')
  priorRank=item.rank
  const website=canonicalUrl(item.website,'大学官网')
  return{id:itemId,rank:item.rank,rankLabel:text(item.rankLabel,'大学排名标签',12),nameEn:text(item.nameEn,'大学英文名称',180),nameZh:text(item.nameZh,'大学中文名称',180),country:text(item.country,'大学国家或地区',100),website,hostname:hostnameFromUrl(website)}
 })
 if(items[0].rank!==1||items[items.length-1].rank<95)throw failure('大学排名覆盖范围不完整。')
 const frequencies=new Map()
 items.forEach(item=>frequencies.set(item.rank,(frequencies.get(item.rank)||0)+1))
 for(const item of items){const expected=frequencies.get(item.rank)>1?'='+item.rank:String(item.rank);if(item.rankLabel!==expected)throw failure('大学排名标签与并列名次不匹配。')}
 return{id:rankingId,label,editionYear:value.editionYear,verifiedAt:isoDate(value.verifiedAt,'大学排名核验'),sourceUrl,sourceHostname:contract.hostname,methodologyUrl,methodologyHostname:contract.hostname,scope:contract.scope,requestedRankLimit:100,complete:true,items}
}

function normalizeDirectory(payload){
 if(!payload||typeof payload!=='object'||payload.schemaVersion!=='stemist-university-directory-v1')throw failure('大学目录格式暂不兼容。')
 if(!Array.isArray(payload.rankings)||payload.rankings.length!==RANKING_CONTRACT.length)throw failure('大学排名数据不完整。')
 const rankingById=new Map()
 for(const value of payload.rankings){const rankingId=id(value?.id,'大学排名');if(rankingById.has(rankingId))throw failure('大学排名标识重复。');rankingById.set(rankingId,value)}
 if(RANKING_CONTRACT.some(contract=>!rankingById.has(contract.id))||[...rankingById.keys()].some(rankingId=>!RANKING_CONTRACT.some(contract=>contract.id===rankingId)))throw failure('大学排名数据范围不完整。')
 return{schemaVersion:'stemist-university-directory-v1',updatedAt:isoDate(payload.updatedAt,'大学目录更新'),examBoards:normalizeExamBoards(payload.examBoards),rankings:RANKING_CONTRACT.map(contract=>normalizeRanking(rankingById.get(contract.id),contract))}
}

function readCache(now){
 try{
  const saved=wx.getStorageSync(CACHE_KEY)
  const cachedAt=Number(saved?.cachedAt)
  if(saved?.schemaVersion!==CACHE_SCHEMA||!Number.isFinite(cachedAt)||cachedAt<0||now<cachedAt||now-cachedAt>CACHE_MAX_AGE_MS)throw failure('缓存已过期。','cache_expired')
  return{directory:normalizeDirectory(saved.payload),source:'cache',cachedAt}
 }catch{
  try{wx.removeStorageSync(CACHE_KEY)}catch{}
  return null
 }
}
function writeCache(directory,cachedAt){try{wx.setStorageSync(CACHE_KEY,{schemaVersion:CACHE_SCHEMA,cachedAt,payload:directory})}catch{}}

async function fetchUniversityDirectory({now=Date.now()}={}){
 const requestedAt=Number.isFinite(Number(now))?Number(now):Date.now()
 try{
  const payload=await getJson(UNIVERSITY_DIRECTORY_PATH,{timeout:12000,stemAuth:false})
  const directory=normalizeDirectory(payload)
  writeCache(directory,requestedAt)
  return{directory,source:'network',cachedAt:requestedAt}
 }catch{
  const cached=readCache(requestedAt)
  if(cached)return cached
  throw failure('暂时无法加载大学目录，请稍后重试。','university_directory_unavailable')
 }
}

module.exports={CACHE_KEY,CACHE_MAX_AGE_MS,EXAM_BOARD_IDS,RANKING_CONTRACT,UNIVERSITY_DIRECTORY_PATH,fetchUniversityDirectory,hostnameFromUrl,normalizeDirectory,safeHttpsUrl}
