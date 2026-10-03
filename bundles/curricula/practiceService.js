const {getJson,requestJson}=require('../../utils/api')
const {DEFAULT_API_BASE,safeApiBase}=require('../../utils/apiOrigin')

const ROOT='/api/stem/curriculum-practice',DRAFT_SCHEMA='stemist-curriculum-practice-draft-v1'
const ROUTES=Object.freeze({'ap-physics-1-mcq-study':{course:'physics-1'},'ap-physics-c-em-mcq-study':{course:'physics-c-em'}})
const DRAFT_PREFIX='stemistDraft:curriculum-practice:',RECENT_PREFIX=DRAFT_PREFIX+'recent:'
const clean=(value,max=180)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):''
const exact=(value,keys)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|'))
const identifier=(value,max=180)=>{const text=clean(value,max);return text&&/^[A-Za-z0-9._:-]+$/.test(text)?text:''}
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max?value:null
const sha=value=>/^[a-f0-9]{64}$/.test(String(value||''))?String(value):''
const clone=value=>JSON.parse(JSON.stringify(value))
const fail=(message,code='curriculum_practice_invalid')=>Object.assign(Error(message),{code})
const iso=value=>{const text=clean(value,40);return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(text)&&Number.isFinite(Date.parse(text))?text:''}
const origin=()=>{try{return safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE}catch{return DEFAULT_API_BASE}}
const sortedOptions=value=>Array.isArray(value)&&value.length&&value.length<=5&&value.every(option=>/^[A-E]$/.test(option))&&new Set(value).size===value.length&&value.join('')===[...value].sort().join('')?value.slice():null
const scope=()=>({owner:String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch:Number(wx.getStorageSync('stemistPrivacyEpoch'))||0})
const current=value=>Boolean(value&&value.owner!=='guest'&&value.owner===String(wx.getStorageSync('stemistUser')?.id||'guest')&&value.epoch===(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)&&wx.getStorageSync('stemistSessionToken'))
const guard=value=>{if(!current(value))throw fail(value?.owner==='guest'?'请登录后开始选择题练习。':'账号已变化，请重新打开选择题练习。','practice_scope_changed')}

function normalizeCatalog(payload,expected={}){
 if(!exact(payload,['schemaVersion','releaseId','routes'])||payload.schemaVersion!=='curriculum-practice-catalog.v1'||!identifier(payload.releaseId)||!Array.isArray(payload.routes))throw fail('选择题练习目录不完整。')
 const routeSeen=new Set(),routes=payload.routes.map(route=>{
  if(!exact(route,['id','board','course','label','authority','formalProgressEligible','questionCount','topics']))throw fail('选择题练习路线不完整。')
  const id=identifier(route.id),known=ROUTES[id],questionCount=integer(route.questionCount,0,1000)
  if(!known||routeSeen.has(id)||route.board!=='ap'||route.course!==known.course||!clean(route.label,160)||route.authority!=='ai-provisional'||route.formalProgressEligible!==false||questionCount===null||!Array.isArray(route.topics))throw fail('选择题练习路线无效。')
  routeSeen.add(id);const topicSeen=new Set(),topics=route.topics.map(topic=>{
   if(!exact(topic,['id','label','sourceId','dimension','routeId','questionCount']))throw fail('选择题练习章节不完整。')
   const topicId=identifier(topic.id),count=integer(topic.questionCount,0,1000)
   if(!topicId||topicSeen.has(topicId)||topic.routeId!==id||!clean(topic.label,180)||!clean(topic.sourceId,160)||!['official-topic','official-essential-knowledge'].includes(topic.dimension)||count===null)throw fail('选择题练习章节无效。')
   topicSeen.add(topicId);return{id:topicId,label:clean(topic.label,180),sourceId:clean(topic.sourceId,160),dimension:topic.dimension,routeId:id,questionCount:count}
  })
  return{id,board:'ap',course:route.course,label:clean(route.label,160),authority:'ai-provisional',formalProgressEligible:false,questionCount,topics}
 })
 if(expected.routeId&&(routes.length!==1||routes[0].id!==expected.routeId))throw fail('选择题练习路线与当前选择不匹配。')
 if(expected.topicId&&(routes.length!==1||routes[0].topics.length!==1||routes[0].topics[0].id!==expected.topicId))throw fail('选择题练习章节与当前选择不匹配。')
 return{schemaVersion:payload.schemaVersion,releaseId:payload.releaseId,routes}
}

function normalizeQuestion(payload,expectedId=''){
 if(!exact(payload,['question'])||!exact(payload.question,['id','paperId','questionNumber','routeId','topicIds','answerMode','options','source','quality']))throw fail('选择题题目信息不完整。')
 const q=payload.question,id=identifier(q.id),paperId=identifier(q.paperId),number=integer(q.questionNumber,1,1000),known=ROUTES[q.routeId],topics=Array.isArray(q.topicIds)?q.topicIds.map(value=>identifier(value)).filter(Boolean):[],options=sortedOptions(q.options)
 if(!id||expectedId&&id!==expectedId||!paperId||number===null||!known||!topics.length||new Set(topics).size!==topics.length||!['single','multiple'].includes(q.answerMode)||!options||options.length<2)throw fail('选择题题目绑定无效。')
 if(!exact(q.source,['questionPdfSha256','pages','regions'])||!sha(q.source.questionPdfSha256)||!Array.isArray(q.source.pages)||!Array.isArray(q.source.regions)||!q.source.regions.length||q.source.regions.length>20)throw fail('选择题原图来源不完整。')
 const pages=q.source.pages.map(value=>integer(value,1,1000));if(pages.some(value=>value===null)||new Set(pages).size!==pages.length||pages.join('|')!==[...pages].sort((a,b)=>a-b).join('|'))throw fail('选择题原图页码无效。')
 const assets=new Set(),regions=q.source.regions.map(region=>{
  if(!exact(region,['assetId','url','sha256','bytes','width','height','page','region']))throw fail('选择题原图信息不完整。')
  const assetId=identifier(region.assetId),digest=sha(region.sha256),page=integer(region.page,1,1000),bytes=integer(region.bytes,1,10*1024*1024),width=integer(region.width,1,20000),height=integer(region.height,1,20000),xyxy=region.region
  const url=`${ROOT}/source/${encodeURIComponent(id)}/${encodeURIComponent(assetId)}/${digest}.png`
  if(!assetId||!digest||assets.has(assetId)||region.url!==url||bytes===null||width===null||height===null||page===null||!pages.includes(page)||!Array.isArray(xyxy)||xyxy.length!==4||xyxy.some(value=>typeof value!=='number'||!Number.isFinite(value)||value<0)||xyxy[2]<=xyxy[0]||xyxy[3]<=xyxy[1])throw fail('选择题原图来源无效。')
  assets.add(assetId);return{assetId,url,imageUrl:origin()+url,sha256:digest,bytes,width,height,page,region:xyxy.slice()}
 })
 if(!pages.every(page=>regions.some(region=>region.page===page)))throw fail('选择题原图页码不完整。')
 if(!exact(q.quality,['label','authority','formalProgressEligible'])||q.quality.label!=='AI checked'||q.quality.authority!=='ai-provisional'||q.quality.formalProgressEligible!==false)throw fail('选择题练习质量标记无效。')
 return{id,paperId,questionNumber:number,routeId:q.routeId,topicIds:topics,answerMode:q.answerMode,options,source:{questionPdfSha256:q.source.questionPdfSha256,pages,regions},quality:{label:'AI checked',authority:'ai-provisional',formalProgressEligible:false}}
}

function normalizeSession(value,expected={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail('选择题练习会话不完整。')
 const submitted=value.status==='submitted',keys=['id','routeId','topicId','status','questionIds','questionCount','createdAt','updatedAt',...(submitted?['answers','result','submittedAt']:[])]
 if(!exact(value,keys))throw fail('选择题练习会话字段无效。')
 const id=identifier(value.id),routeId=identifier(value.routeId),topicId=value.topicId===null?null:identifier(value.topicId),questionIds=Array.isArray(value.questionIds)?value.questionIds.map(item=>identifier(item)).filter(Boolean):[],count=integer(value.questionCount,1,50)
 if(!id||!ROUTES[routeId]||value.topicId!==null&&!topicId||!['draft','submitted'].includes(value.status)||!questionIds.length||questionIds.length>50||new Set(questionIds).size!==questionIds.length||count!==questionIds.length||!iso(value.createdAt)||!iso(value.updatedAt)||expected.sessionId&&id!==expected.sessionId||expected.routeId&&routeId!==expected.routeId||expected.questionCount!==undefined&&count!==expected.questionCount||expected.questionIds&&(questionIds.length!==expected.questionIds.length||questionIds.some((item,index)=>item!==expected.questionIds[index])))throw fail('选择题练习会话绑定无效。')
 const session={id,routeId,topicId,status:value.status,questionIds,questionCount:count,createdAt:value.createdAt,updatedAt:value.updatedAt}
 if(!submitted)return session
 if(!Array.isArray(value.answers)||value.answers.length!==count||!exact(value.result,['score','maxScore','items'])||!Array.isArray(value.result.items)||value.result.items.length!==count||integer(value.result.score,0,count)===null||value.result.maxScore!==count||!iso(value.submittedAt))throw fail('选择题练习结果不完整。')
 const answers=value.answers.map((answer,index)=>{if(!exact(answer,['questionId','selectedOptions','unanswered'])||answer.questionId!==questionIds[index]||typeof answer.unanswered!=='boolean')throw fail('选择题练习答案记录无效。');const selected=answer.unanswered?Array.isArray(answer.selectedOptions)&&!answer.selectedOptions.length?[]:null:sortedOptions(answer.selectedOptions);if(!selected)throw fail('选择题练习答案记录无效。');return{questionId:answer.questionId,selectedOptions:selected,unanswered:answer.unanswered}})
 const items=value.result.items.map((item,index)=>{if(!exact(item,['questionId','correct','unanswered'])||item.questionId!==questionIds[index]||typeof item.correct!=='boolean'||typeof item.unanswered!=='boolean'||item.unanswered!==answers[index].unanswered||item.unanswered&&item.correct)throw fail('选择题练习评分结果无效。');return{questionId:item.questionId,correct:item.correct,unanswered:item.unanswered}})
 if(items.filter(item=>item.correct).length!==value.result.score)throw fail('选择题练习得分不一致。')
 return{...session,answers,result:{score:value.result.score,maxScore:count,items},submittedAt:value.submittedAt}
}

function normalizeSubmit(payload,expected){
 if(!exact(payload,['session','duplicate'])||typeof payload.duplicate!=='boolean')throw fail('选择题提交结果不完整。')
 const session=normalizeSession(payload.session,expected);if(session.status!=='submitted')throw fail('选择题提交尚未完成。')
 return{session,duplicate:payload.duplicate}
}

async function fetchCatalog(filters={}){
 const routeId=filters.routeId?identifier(filters.routeId):'',topicId=filters.topicId?identifier(filters.topicId):''
 if(filters.routeId&&!routeId||filters.topicId&&!topicId)throw fail('选择题练习筛选无效。')
 const payload=await getJson(`${ROOT}/catalog?routeId=${encodeURIComponent(routeId)}&topicId=${encodeURIComponent(topicId)}`,{timeout:12000,stemAuth:false})
 return normalizeCatalog(payload,{routeId,topicId})
}
async function fetchQuestion(questionId){const id=identifier(questionId);if(!id)throw fail('选择题编号无效。');return normalizeQuestion(await getJson(`${ROOT}/questions/${encodeURIComponent(id)}`,{timeout:12000,stemAuth:false}),id)}
async function createSession(input,s){guard(s);const routeId=identifier(input?.routeId),topicId=input?.topicId?identifier(input.topicId):'',questionIds=Array.isArray(input?.questionIds)?input.questionIds.map(value=>identifier(value)):null,count=integer(input?.count??10,1,50);if(!ROUTES[routeId]||input?.topicId&&!topicId||questionIds&&(!questionIds.length||questionIds.length>50||questionIds.some(id=>!id)||new Set(questionIds).size!==questionIds.length)||!questionIds&&count===null)throw fail('选择题练习范围无效。');const body={routeId,...(topicId?{topicId}:{}),...(questionIds?{questionIds}:{count})},payload=await requestJson(`${ROOT}/sessions`,body,{timeout:15000});guard(s);return normalizeSession(payload?.session,{routeId,questionCount:questionIds?questionIds.length:count,...(questionIds?{questionIds}:{})})}
async function getSession(sessionId,s){guard(s);const id=identifier(sessionId);if(!id)throw fail('选择题练习会话无效。');const payload=await getJson(`${ROOT}/sessions/${encodeURIComponent(id)}`,{timeout:12000});guard(s);return normalizeSession(payload?.session,{sessionId:id})}
async function fetchHistory(s){guard(s);const payload=await getJson(`${ROOT}/history`,{timeout:12000});guard(s);if(!exact(payload,['sessions'])||!Array.isArray(payload.sessions)||payload.sessions.length>50)throw fail('选择题练习历史无效。');return payload.sessions.map(value=>normalizeSession(value))}
async function submitSession(sessionId,input,s){guard(s);const id=identifier(sessionId),submission=clean(input?.submissionId,128),answers=input?.answers;if(!id||!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(submission)||!Array.isArray(answers)||answers.length>50)throw fail('选择题提交信息无效。');const seen=new Set(),normalized=answers.map(answer=>{if(!exact(answer,['questionId','selectedOptions']))throw fail('选择题答案格式无效。');const questionId=identifier(answer.questionId),selected=sortedOptions(answer.selectedOptions);if(!questionId||seen.has(questionId)||!selected)throw fail('选择题答案格式无效。');seen.add(questionId);return{questionId,selectedOptions:selected}}),body={submissionId:submission,answers:normalized,...(input.confirmUnanswered===true?{confirmUnanswered:true}:{})},payload=await requestJson(`${ROOT}/sessions/${encodeURIComponent(id)}/submit`,body,{timeout:20000});guard(s);return normalizeSubmit(payload,{sessionId:id,...(input.routeId?{routeId:input.routeId}:{}),...(input.questionIds?{questionIds:input.questionIds}:{})})}

const draftKey=(owner,sessionId)=>DRAFT_PREFIX+encodeURIComponent(owner)+':'+encodeURIComponent(sessionId)
const recentKey=(owner,routeId)=>RECENT_PREFIX+encodeURIComponent(owner)+':'+encodeURIComponent(routeId)
function createDraft(session,s,labels={}){guard(s);const value=normalizeSession(session);return{schemaVersion:DRAFT_SCHEMA,owner:s.owner,epoch:s.epoch,sessionId:value.id,routeId:value.routeId,topicId:value.topicId,routeLabel:clean(labels.routeLabel,160),topicLabel:clean(labels.topicLabel,180),questionIds:value.questionIds,index:0,answers:{},status:value.status,result:value.result||null,submissionId:'',createdAt:value.createdAt,updatedAt:Date.now()}}
function validDraftResult(result,questionIds,answers){if(!exact(result,['score','maxScore','items'])||integer(result.score,0,questionIds.length)===null||result.maxScore!==questionIds.length||!Array.isArray(result.items)||result.items.length!==questionIds.length)return false;let score=0;for(let index=0;index<questionIds.length;index++){const item=result.items[index],hasAnswer=Array.isArray(answers[questionIds[index]])&&answers[questionIds[index]].length>0;if(!exact(item,['questionId','correct','unanswered'])||item.questionId!==questionIds[index]||typeof item.correct!=='boolean'||typeof item.unanswered!=='boolean'||item.unanswered===hasAnswer||item.unanswered&&item.correct)return false;if(item.correct)score++}return score===result.score}
function validDraft(value,s){
 if(!value||value.schemaVersion!==DRAFT_SCHEMA||value.owner!==s.owner||value.epoch!==s.epoch||!identifier(value.sessionId)||!ROUTES[value.routeId]||value.topicId!==null&&!identifier(value.topicId)||clean(value.routeLabel,160)!==value.routeLabel||clean(value.topicLabel,180)!==value.topicLabel||!Array.isArray(value.questionIds)||!value.questionIds.length||value.questionIds.length>50||new Set(value.questionIds).size!==value.questionIds.length||value.questionIds.some(id=>!identifier(id))||!Number.isInteger(value.index)||value.index<0||value.index>=value.questionIds.length||!['draft','submitted'].includes(value.status)||typeof value.answers!=='object'||!value.answers||Array.isArray(value.answers)||value.submissionId&&!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value.submissionId)||!iso(value.createdAt)||!Number.isFinite(value.updatedAt))return false
 for(const [id,options]of Object.entries(value.answers))if(!value.questionIds.includes(id)||!sortedOptions(options))return false
 if(value.status==='submitted'?!validDraftResult(value.result,value.questionIds,value.answers):value.result!==null)return false
 return true
}
function saveDraft(value,s){guard(s);const next={...clone(value),owner:s.owner,epoch:s.epoch,updatedAt:Date.now()};if(!validDraft(next,s))throw fail('本机选择题草稿无效。');try{wx.setStorageSync(draftKey(s.owner,next.sessionId),next);wx.setStorageSync(recentKey(s.owner,next.routeId),next.sessionId)}catch{throw fail('本机空间不足，选择题答案尚未保存。','practice_storage_full')}return clone(next)}
function readDraft(sessionId,s){const value=wx.getStorageSync(draftKey(s.owner,sessionId));return validDraft(value,s)?clone(value):null}
function recentDraft(s,routeId){const route=identifier(routeId);if(!route)return null;const id=wx.getStorageSync(recentKey(s.owner,route));return readDraft(id,s)}
const newSubmissionId=()=>`cpsub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,12)}`

module.exports={ROOT,ROUTES,scope,current,normalizeCatalog,normalizeQuestion,normalizeSession,normalizeSubmit,fetchCatalog,fetchQuestion,createSession,getSession,fetchHistory,submitSession,createDraft,saveDraft,readDraft,recentDraft,newSubmissionId}
