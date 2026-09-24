const {getJson}=require('../../utils/api')
const {DEFAULT_API_BASE,safeApiBase}=require('../../utils/apiOrigin')

const KNOWN_BOARDS=Object.freeze({ap:'AP',ib:'IB'})
const FILTER_KEYS=['course','level','year','session','paper']
const clean=(value,max=160)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max)
const integer=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0
const failure=(message,code='invalid_catalog')=>Object.assign(Error(message),{code})
const uniqueList=(values,max=100)=>Array.isArray(values)?[...new Set(values.map(value=>clean(value,80)).filter(Boolean))].slice(0,max):[]
const apiOrigin=()=>{try{return safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE}catch{return DEFAULT_API_BASE}}

function safeSourceUrl(value){
 const url=clean(value,1000)
 if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[^\s]*)?$/i.test(url))return''
 const authority=url.slice('https://'.length).split('/')[0]
 return authority.includes('@')?'':url
}

function safeDownloadUrl(value){
 const raw=clean(value,1000),origin=apiOrigin()
 if(!raw||/[?#]|\.\.|%2e|%2f|%5c/i.test(raw))return''
 const absolute=raw.startsWith('/')?origin+raw:raw
 if(!absolute.startsWith(origin+'/'))return''
 const path=absolute.slice(origin.length)
 return /^\/(?:api\/stem\/curriculum-papers\/|local-pdf\/)[A-Za-z0-9_./%~-]+$/i.test(path)?absolute:''
}

function normalizeFile(value){
 if(!value||typeof value!=='object')throw failure('试卷文件信息不完整。')
 const availability=['source-only','downloadable'].includes(value.availability)?value.availability:'source-only'
 const name=clean(value.name,160)
 if(!name||!/\.pdf$/i.test(name)||/[\\/]/.test(name))throw failure('试卷文件名称无效。')
 return{id:clean(value.id,160),name,bytes:integer(value.bytes),pages:integer(value.pages),sha256:/^[a-f0-9]{64}$/i.test(String(value.sha256||''))?String(value.sha256).toLowerCase():'',downloadUrl:safeDownloadUrl(value.downloadUrl),sourceUrl:safeSourceUrl(value.sourceUrl),availability}
}

function normalizeResponse(payload,expectedBoard){
 if(!KNOWN_BOARDS[expectedBoard])throw failure('课程体系参数无效。','invalid_board')
 if(!payload||payload.schemaVersion!=='curriculum-papers-v1')throw failure('真题目录格式暂不兼容。')
 if(payload.board!==expectedBoard)throw failure('返回的课程体系不匹配。')
 if(!Array.isArray(payload.items)||!payload.filters||typeof payload.filters!=='object'||!payload.summary||typeof payload.summary!=='object')throw failure('真题目录信息不完整。')
 const courses=(Array.isArray(payload.courses)?payload.courses:[]).map(course=>({id:clean(course?.id,100),label:clean(course?.label,120),subject:clean(course?.subject,120)})).filter(course=>course.id&&course.label)
 const items=payload.items.map(value=>{
  if(!value||value.board!==expectedBoard)throw failure('试卷课程体系不匹配。')
  if(value.practiceReady!==false)throw failure('试卷练习状态未通过校验。')
  const availability=['source-only','downloadable'].includes(value.availability)?value.availability:'source-only'
  const pairStatus=['verified','candidate','missing'].includes(value.pairStatus)?value.pairStatus:'missing'
  return{id:clean(value.id,160),board:expectedBoard,course:clean(value.course,100),courseLabel:clean(value.courseLabel,140),subject:clean(value.subject,120),level:clean(value.level,80),year:clean(value.year,20),session:clean(value.session,80),paper:clean(value.paper,80),variant:clean(value.variant,80),title:clean(value.title,220),section:clean(value.section,120),fullExam:value.fullExam===true,practiceReady:false,availability,questionPaper:normalizeFile(value.questionPaper),markScheme:value.markScheme?normalizeFile(value.markScheme):null,pairStatus,notice:clean(value.notice,300)}
 })
 const page=Math.max(1,integer(payload.page)||1),pageSize=Math.max(1,Math.min(100,integer(payload.pageSize)||20)),pages=Math.max(0,integer(payload.pages)),total=integer(payload.total)
 return{schemaVersion:'curriculum-papers-v1',board:expectedBoard,courses,filters:Object.fromEntries(FILTER_KEYS.slice(1).map(key=>[key+'s',uniqueList(payload.filters[key+'s'])])),total,page,pageSize,pages,items,summary:{papers:integer(payload.summary.papers),downloadable:integer(payload.summary.downloadable),sourceOnly:integer(payload.summary.sourceOnly)}}
}

async function fetchCurriculumPapers(filters={}){
 const board=clean(filters.board,10).toLowerCase()
 if(!KNOWN_BOARDS[board])throw failure('课程体系参数无效，请从首页重新进入。','invalid_board')
 const values={board,...Object.fromEntries(FILTER_KEYS.map(key=>[key,clean(filters[key],key==='query'?120:100)])),query:clean(filters.query,120),page:Math.max(1,integer(filters.page)||1),pageSize:20}
 const query=['board','course','level','year','session','paper','query','page','pageSize'].map(key=>encodeURIComponent(key)+'='+encodeURIComponent(values[key])).join('&')
 const payload=await getJson('/api/stem/curriculum-papers?'+query,{timeout:12000,stemAuth:false})
 return normalizeResponse(payload,board)
}

module.exports={KNOWN_BOARDS,fetchCurriculumPapers,normalizeResponse,safeDownloadUrl,safeSourceUrl}
