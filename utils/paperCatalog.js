const { getJson } = require('./api')

const PAPER_SUBJECTS = [
  { code: '9702', label: 'A-Level Physics' },
  { code: '9709', label: 'A-Level Mathematics' },
  { code: '9231', label: 'A-Level Further Mathematics' },
  { code: '9708', label: 'A-Level Economics' },
  { code: '0625', label: 'IGCSE Physics' },
  { code: '0580', label: 'IGCSE Mathematics' },
  { code: '0606', label: 'IGCSE Additional Mathematics' },
  { code: '0610', label: 'IGCSE Biology' },
  { code: '9700', label: 'A-Level Biology' },
  { code: '9701', label: 'A-Level Chemistry' },
  { code: 'bpho', label: 'BPhO' },
  { code: 'amc12', label: 'AMC 12' },
  { code: 'esat', label: 'ESAT' },
  { code: 'tmua', label: 'TMUA' },
]

const IGCSE_SUBJECTS = new Set(['0580', '0606', '0610', '0625'])
const A_LEVEL_SUBJECTS = new Set(['9231', '9700', '9701', '9702', '9708', '9709'])
const COMPETITION_SUBJECTS = new Set(['amc12', 'bpho'])
const ADMISSIONS_SUBJECTS = new Set(['esat', 'tmua'])

// Catalog profiles use source-specific labels (for example `core`, `r1` or
// `prep`). The mini-program filter is intentionally product-level: students
// should see IGCSE / AS / A2 / Competition / Admissions consistently across
// all subjects. Keep the raw labels separately for diagnostics, but expose
// only canonical stage IDs to the UI.
function canonicalStages(subject, rawStages = []) {
  const code = String(subject || '').trim().toLowerCase()
  const raw = Array.isArray(rawStages) ? rawStages.map((stage) => String(stage || '').trim().toLowerCase()).filter(Boolean) : []
  const stages = new Set(raw.filter((stage) => ['igcse', 'as', 'a2', 'competition', 'admissions'].includes(stage)))
  if (IGCSE_SUBJECTS.has(code) && raw.some((stage) => ['core', 'extended', 'igcse'].includes(stage))) stages.add('igcse')
  if (A_LEVEL_SUBJECTS.has(code)) {
    if (raw.includes('as')) stages.add('as')
    if (raw.includes('a2')) stages.add('a2')
  }
  if (COMPETITION_SUBJECTS.has(code) && raw.length) stages.add('competition')
  if (ADMISSIONS_SUBJECTS.has(code) && raw.length) stages.add('admissions')
  return [...stages]
}

function normalizePaperItem(item = {}) {
  const profile = item.examProfile || {}
  const routes = Array.isArray(profile.courseRouteIds) ? profile.courseRouteIds : (Array.isArray(profile.routeIds) ? profile.routeIds : [])
  const subject = String(item.subject || '').trim().toLowerCase()
  const rawStages = Array.isArray(profile.stages) ? profile.stages.map((stage) => String(stage).toLowerCase()) : []
  return {
    id: String(item.id || ''),
    subject,
    year: Number.isFinite(Number(item.year)) ? Number(item.year) : null,
    season: String(item.season || ''),
    kind: String(item.kind || ''),
    file: String(item.file || ''),
    pairKey: item.pairKey ? String(item.pairKey) : '',
    markSchemeId: String(item.markSchemeId || ''),
    paperNumber: profile.code ? String(profile.code) : '',
    title: String(profile.title || ''),
    mode: String(profile.mode || ''),
    durationMinutes: Number.isFinite(Number(profile.durationMinutes))&&Number(profile.durationMinutes)>0?Number(profile.durationMinutes):null,
    maxMarks: Number.isFinite(Number(profile.maxMarks))&&Number(profile.maxMarks)>0?Number(profile.maxMarks):null,
    // A component-wide default is not the source paper's actual last number.
    // Never truncate a student's photo answers at that guessed total.
    questionCount: null,
    stages: canonicalStages(subject, rawStages),
    rawStages,
    routeIds: routes.map((route) => String(route)),
    localUrl: String(item.localUrl || ''),
    governanceState: String(item.governance?.state || '').toLowerCase(),
  }
}

function isQuestionPaper(item) {
  return item.kind === 'qp' && item.governanceState === 'active' && Boolean(item.file)
}

const pageCache=new Map(),pagePending=new Map(),detailCache=new Map(),versions=new Map()
function pageScope(options={}){
 const subject=String(options.subject||'').toLowerCase(),stage=String(options.stage||'all').toLowerCase(),routeId=String(options.routeId||''),query=String(options.query||'').trim().toLowerCase().slice(0,120),page=Number(options.page||1)
 const rawYear=String(options.year??'all'),year=['','all'].includes(rawYear)?null:Number(rawYear),season=String(options.season||'all').toLowerCase()
 const component=String(options.component??'all').trim().toLowerCase()
 if(component!=='all'&&!/^[1-9]$/.test(component))throw new Error('卷型筛选无效。')
 if(!PAPER_SUBJECTS.some(s=>s.code===subject)||!['all','igcse','as','a2','competition','admissions'].includes(stage)||!Number.isInteger(page)||page<1)throw new Error('试卷范围无效。')
 if(year!==null&&(!/^\d{4}$/.test(rawYear)||year<=1800)||!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(season))throw new Error('年份或考试季无效。')
 return {subject,stage,routeId,year,season,component,query,page,pageSize:30}
}
function compactPaper(item,subject,sourceVersion=''){
 if(!item||item.subject!==subject||!item.id||item.kind!=='qp'||!Array.isArray(item.stages)||!Array.isArray(item.routeIds))throw new Error('试卷目录返回不完整。')
 const ms=item.markScheme
 if(ms&&(!ms.id||ms.kind!=='ms'))throw new Error('参考答案关联无效。')
 return {id:String(item.id),subject,kind:'qp',file:String(item.file||''),year:item.year,season:String(item.season||''),seasonKey:String(item.seasonKey||''),seasonLabel:String(item.seasonLabel||item.season||''),title:String(item.title||''),paperNumber:String(item.paperNumber||''),paperComponent:Number.isInteger(item.paperComponent)&&item.paperComponent>=1&&item.paperComponent<=9?item.paperComponent:null,stages:item.stages,routeIds:item.routeIds,localUrl:String(item.localUrl||''),durationMinutes:item.durationMinutes,maxMarks:item.maxMarks,questionCount:null,sourceVersion:String(sourceVersion||''),markScheme:ms?{id:String(ms.id),kind:'ms',file:String(ms.file||''),localUrl:String(ms.localUrl||'')}:null}
}
function filterFacets(payload,scope){
 const componentSupported=payload.componentFilterVersion==='native-paper-components-v1'
 if((scope.component!=='all'||componentSupported)&&(!componentSupported||payload.component!==scope.component))throw new Error('题库服务未正确应用卷型筛选，请更新后重试。')
 const components=componentSupported?payload.facets?.paperComponents:[]
 if(componentSupported&&(!Array.isArray(components)||components.length>9||components.some(c=>!c||!/^[1-9]$/.test(c.value)||c.label!=='P'+c.value)||new Set(components.map(c=>c.value)).size!==components.length))throw new Error('卷型目录不完整，请重试。')
 const supported=payload.filterVersion==='native-paper-filters-v1',active=scope.year!==null||scope.season!=='all'
 if(active&&(!supported||payload.year!==scope.year||payload.season!==scope.season))throw new Error('题库服务未正确应用筛选，请更新后重试。')
 if(!supported)return null
 const facets=payload.facets
 if(!Array.isArray(facets?.years)||facets.years.length>200||!facets.years.every(y=>Number.isInteger(y)&&y>1800)||!Array.isArray(facets?.seasons)||facets.seasons.length>40||!facets.seasons.every(s=>/^[a-z0-9][a-z0-9_-]{0,39}$/.test(s.value)&&typeof s.label==='string'&&s.label.length<=100))throw new Error('题库筛选目录不完整，请重试。')
 return {...facets,paperComponents:components}
}
function rememberVersion(subject,version){
 if(versions.has(subject)&&versions.get(subject)!==version){for(const [key,value] of pageCache)if(value.payload.subject===subject)pageCache.delete(key);for(const [key,value] of detailCache)if(value.paper.subject===subject)detailCache.delete(key)}
 versions.set(subject,version)
}
function rememberDetail(paper){detailCache.delete(paper.id);detailCache.set(paper.id,{paper,at:Date.now()});while(detailCache.size>60)detailCache.delete(detailCache.keys().next().value)}
async function fetchPaperPage(options={}){
 const scope=pageScope(options),key=JSON.stringify(scope),cached=pageCache.get(key)
 if(cached&&Date.now()-cached.at<60000){pageCache.delete(key);pageCache.set(key,cached);return cached.payload}
 if(pagePending.has(key))return pagePending.get(key)
 const query=Object.entries(scope).filter(([,value])=>value!==null).map(([key,value])=>encodeURIComponent(key)+'='+encodeURIComponent(value)).join('&')
 const pending=getJson('/api/stem/paper-catalog?'+query,{timeout:12000,stemAuth:false}).then(payload=>{
  if(payload?.schemaVersion!=='native-paper-catalog-v1'||payload.subject!==scope.subject||payload.stage!==scope.stage||payload.routeId!==scope.routeId||payload.query!==scope.query||!Array.isArray(payload.items)||payload.items.length>30||!Number.isInteger(payload.total)||payload.total<0||!Number.isInteger(payload.page)||payload.page<1||!Number.isInteger(payload.pageCount)||payload.pageCount<0||typeof payload.version!=='string')throw new Error('真题分页返回不完整，请重试。')
  const sourceVersion=/^[^\s?#&]{1,160}$/.test(String(payload.version||''))?String(payload.version):''
  const items=payload.items.map(item=>compactPaper(item,scope.subject,sourceVersion));if(new Set(items.map(item=>item.id)).size!==items.length)throw new Error('试卷目录有重复项，请重试。')
  const facets=filterFacets(payload,scope)
  if(items.some(item=>scope.year!==null&&item.year!==scope.year||scope.season!=='all'&&item.seasonKey!==scope.season||scope.component!=='all'&&String(item.paperComponent)!==scope.component))throw new Error('返回试卷与当前筛选不匹配，请重试。')
  rememberVersion(scope.subject,payload.version);items.forEach(rememberDetail)
  const result={...payload,items,facets};pageCache.delete(key);pageCache.set(key,{payload:result,at:Date.now()});while(pageCache.size>6)pageCache.delete(pageCache.keys().next().value)
  return result
 }).finally(()=>pagePending.delete(key))
 pagePending.set(key,pending);return pending
}
async function fetchPaperDetail(subject,id){
 const scope=pageScope({subject}),key=String(id||'');if(!/^[A-Za-z0-9_-]{1,200}$/.test(key))throw new Error('试卷标识无效。')
 const cached=detailCache.get(key);if(cached&&cached.paper.subject===scope.subject&&Date.now()-cached.at<60000)return cached.paper
 const payload=await getJson('/api/stem/paper-catalog?subject='+encodeURIComponent(scope.subject)+'&id='+encodeURIComponent(key),{timeout:12000,stemAuth:false})
 if(payload?.schemaVersion!=='native-paper-detail-v1'||payload.subject!==scope.subject||payload.paper?.id!==key)throw new Error('试卷资料返回不完整。')
 const sourceVersion=/^[^\s?#&]{1,160}$/.test(String(payload.version||''))?String(payload.version):''
 const paper=compactPaper(payload.paper,scope.subject,sourceVersion);rememberVersion(scope.subject,payload.version);rememberDetail(paper);return paper
}
module.exports = { A_LEVEL_SUBJECTS, ADMISSIONS_SUBJECTS, COMPETITION_SUBJECTS, IGCSE_SUBJECTS, PAPER_SUBJECTS, canonicalStages, fetchPaperPage,fetchPaperDetail,isQuestionPaper, normalizePaperItem }
