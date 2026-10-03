const { requestJson } = require('./api')
const { readAsJpegDataUrl, compressImage } = require('./image')
const { DEFAULT_API_BASE, safeApiBase } = require('./apiOrigin')
const { normalizeSourceRegion, sourceRegionStyle } = require('./sourceRegion')
const {isSingleChoice,hasChoice,nextChoiceAnswer}=require('./nativeChoice')
const {gradeObjectiveAnswer}=require('./nativeObjectiveAnswer')
const {normalizeQuestionFocus,choiceOptions,questionDisplay}=require('./questionFocus')

const SESSION_PREFIX = 'stemistNativePractice:'
const RECENT_PREFIX = 'stemistNativeRecent:'
const EPOCH_KEY = 'stemistPrivacyEpoch'
const MIN_SET = 6
const TOPIC_FLOOR = 12
const CHAPTER_MODE = 'chapter-study'
const ORIGINAL_SOURCE = 'original-foundation'
const ORIGINAL_AUTH = 'original-foundation-catalog'
const ORIGINAL_LABEL = '原创基础练习'
const ORIGINAL_SCORE = 'original-learning-only'
const ORIGINAL_ENDPOINT = '/api/stem/original-foundation/submit'
const CHAPTER_SIZES = [1, 3, 5, 10, 15]
const marking = new Set()
const clone = value => JSON.parse(JSON.stringify(value))
const unique = values => [...new Set(Array.isArray(values) ? values.filter(v => typeof v === 'string' && v) : [])]
const identity = () => { const user = wx.getStorageSync('stemistUser') || {}; return String(user.id || user.username || '') }
const epoch = () => Number(wx.getStorageSync(EPOCH_KEY)) || 0
const id = () => `mini-set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
const validId = value => /^mini-set-[a-z0-9-]{8,80}$/.test(String(value || ''))

// These counts are display/preflight only. The server repeats all eligibility
// checks before assembly; no client count authorizes a question or a score.
function selectionState(inventory, topicIds, components, questionCount, studyMode = '') {
const selected = unique(topicIds)
const allowed = inventory?.paperComponents || []
const scope = [...new Set(components || [])]
const componentValid = scope.length > 0 && scope.every(c => allowed.includes(c))
if (studyMode === CHAPTER_MODE) {
 const p=inventory?.practicePolicy?.chapterStudy,versioned=inventory?.chapterStudy?.mode===CHAPTER_MODE&&p?.mode===CHAPTER_MODE&&p.minSourceGroups===1&&p.maxSourceGroups===15&&p.countPolicy==='cap-to-available'&&p.formalProgressEligible===false
 const all=scope.length===allowed.length&&allowed.every(c=>scope.includes(c)),availability=t=>all?t?.chapterStudy:scope.length===1?t?.componentCounts?.[scope[0]]?.chapterStudy:null
 const topicCounts=Object.fromEntries((inventory?.topics||[]).map(t=>[t.id,availability(t)?.available||0])),a=availability(selected.length===1?inventory?.topics?.find(t=>t.id===selected[0]):null),availableCount=a?.available||0
 const sizes=[...new Set(CHAPTER_SIZES.map(n=>Math.min(n,availableCount)).filter(Boolean))],startable=versioned&&componentValid&&selected.length===1&&Boolean(a?.startable)
 return{availableCount,topicCounts,sizes,ready:false,studyReady:startable,canStart:startable&&sizes.includes(Number(questionCount)),fallbackKind:a?.fallbackKind||null,officialAvailable:a?.officialAvailable||0,originalAvailable:a?.originalAvailable||0,hint:!selected.length?'选择一个要学习的章节':selected.length!==1?'章节学习每次只选择一个章节。':!componentValid||!a?'章节学习请选择全部卷型或仅一个卷型。':!startable?'本章暂无可用练习，请稍后刷新。':''}
}
const all = new Set()
const topicCounts = {}
const topicFormal = {}, topicStartable = {}
const policy = inventory?.practicePolicy
const versioned = policy?.schemaVersion === 'stem-topic-practice-policy-v1' && policy.minSourceGroups === MIN_SET && policy.minReviewedGroups === TOPIC_FLOOR
const crossStudy=versioned&&policy.allowCrossTopicStudy===true&&selected.length>1
for (const topic of inventory?.topics || []) {
  const reviewed = new Set(scope.flatMap(c => unique(topic.questionIdsByComponent?.[c]?.verifiedQuestionIds)))
  const explicit = versioned && scope.every(c => Array.isArray(topic.questionIdsByComponent?.[c]?.apiReadyQuestionIds))
  const ids = explicit ? new Set(scope.flatMap(c => unique(topic.questionIdsByComponent[c].apiReadyQuestionIds))) : reviewed
  const reviewedCount = [...reviewed].filter(q => ids.has(q)).length
  topicCounts[topic.id] = ids.size
  topicFormal[topic.id] = reviewedCount >= TOPIC_FLOOR
  // Only an explicit API-ready list can admit released study sources. Raw
  // OCR/study IDs and topic membership sums never authorize a practice set.
  topicStartable[topic.id] = crossStudy&&explicit?ids.size>0:explicit
    ? topic.apiStartable === true && (topicFormal[topic.id] || (ids.size >= MIN_SET && (ids.size > reviewedCount || policy.allowReviewedSubsetStudy===true)))
    : topicFormal[topic.id]
  if (selected.includes(topic.id)) ids.forEach(q => all.add(q))
}
const startable = componentValid && selected.length > 0 && all.size>=MIN_SET && selected.every(t => topicStartable[t])
const ready = startable && selected.every(t => topicFormal[t])
const sizes = (versioned ? policy.setSizes : [6, 10, 15]).filter(n => n <= all.size&&(!crossStudy||n>=selected.length))
return { availableCount: all.size, topicCounts, sizes, ready, studyReady: startable && !ready,
  canStart: startable && sizes.includes(Number(questionCount)),
  hint: !selected.length ? '选择要练习的章节' : !startable ? '所选章节或卷型的题目尚未备齐，请调整选择。' : '' }
}

function questionAsset(value) {
const raw = String(value || '').replace(/^https:\/\/stem\.ieltsist\.com/i, '')
if (/^\/api\/stem\/practice-source-image\?routeId=[a-z0-9-]+&sourceQuestionId=[-a-zA-Z0-9_%:]+&region=(?:[0-9]|1[0-9])&v=[a-f0-9]{64}(?:&view=region)?$/.test(raw)) return raw
if (!/^\/question-assets\/[a-zA-Z0-9_-]+\/(?:qp|ms)-\d+\.(?:jpg|jpeg|png|webp)$/.test(raw)) throw new Error('题目原图地址无效，请重新组卷。')
return raw
}

function imageUrl(path) {
const app = getApp()
const base = safeApiBase(app?.globalData?.apiBaseUrl) || DEFAULT_API_BASE
return `${base}${questionAsset(path)}`
}

const plain = value => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const exactKeys = (value, keys) => plain(value) && Object.keys(value).sort().join('|') === keys.slice().sort().join('|')
const cleanText = (value, max = 6000) => { const text = typeof value === 'string' ? value.trim() : ''; return text && text.length <= max ? text : '' }
function validateOriginalGroup(g,e,index) {
  const forbidden = ['sourceRef', 'answerRef', 'sourceContent', 'nativeSourceImages', 'questionFocus', 'choiceOptions', 'answerKey', 'correctOption', 'correctOptionId', 'solution', 'markSchemePoints', 'officialScore', 'officialGrade', 'formalScore', 'grade', 'gradeEstimate', 'score', 'maxScore', 'rawMarks', 'maxMarks', 'percentage', 'scoreResult']
  if(forbidden.some(k=>Object.prototype.hasOwnProperty.call(g,k))||g.id!==`original-foundation:${e.routeId}:${e.syllabusTopicIds[0]}:v1`||g.sourceKind!==ORIGINAL_SOURCE||g.sourceAuthority!==ORIGINAL_AUTH||g.displaySourceLabel!==ORIGINAL_LABEL||g.routeId!==e.routeId||g.questionGroupId!==g.id||g.studentStudyEligible!==true||g.studyOnly!==true||g.formalProgressEligible!==false||g.countsTowardFormalGrade===true)throw Error('原创基础练习来源无效，请重新组卷。')
  const q=g.originalQuestion
  const questionKeys = ['schemaVersion', 'catalogVersion', 'id', 'routeId', 'stage', 'subject', 'subjectCode', 'topicId', 'topicName', 'sourceKind', 'sourceAuthority', 'displaySourceLabel', 'foundationBasis', 'prompt', 'answerType', 'options', 'responseContract', 'answerContract', 'formalProgressEligible', 'countsTowardFormalGrade']
  if(!exactKeys(q,questionKeys)||q.schemaVersion!=='stem-original-foundation-question-v1'||q.catalogVersion!=='v1'||q.id!==g.id||q.routeId!==e.routeId||q.stage!==e.stage||String(q.subjectCode)!==String(e.subjectCode)||q.topicId!==e.syllabusTopicIds[0]||!cleanText(q.subject,120)||!cleanText(q.topicName,200)||q.sourceKind!==ORIGINAL_SOURCE||q.sourceAuthority!==g.sourceAuthority||q.displaySourceLabel!==g.displaySourceLabel||q.foundationBasis!=='curated-foundation'||!cleanText(q.prompt,12000)||q.answerType!=='single-choice'||q.formalProgressEligible!==false||q.countsTowardFormalGrade!==false)throw Error('原创基础练习题目不完整，请重新组卷。')
  if(!Array.isArray(q.options)||![3,4].includes(q.options.length)||q.options.some((o,i)=>!exactKeys(o,['id','text'])||o.id!==['A','B','C','D'][i]||!cleanText(o.text,2000)))throw Error('原创基础练习选项无效，请重新组卷。')
  const optionIds=q.options.map(o=>o.id)
  if(!exactKeys(q.responseContract,['kind','optionIds'])||q.responseContract.kind!=='single-choice'||!Array.isArray(q.responseContract.optionIds)||q.responseContract.optionIds.join('|')!==optionIds.join('|'))throw Error('原创基础练习作答规则无效，请重新组卷。')
  const a=q.answerContract
  const answerKeys=['schemaVersion', 'id', 'responseType', 'submissionEndpoint', 'maxScore', 'scoreScope', 'reveal']
  if(!exactKeys(a,answerKeys)||a.schemaVersion!=='stem-original-foundation-answer-contract-v1'||a.id!==q.id+':answer:v1'||a.responseType!=='single-choice'||a.submissionEndpoint!==ORIGINAL_ENDPOINT||a.maxScore!==1||a.scoreScope!==ORIGINAL_SCORE||a.reveal!=='after-submission'||!exactKeys(g.answerContract,answerKeys)||answerKeys.some(k=>g.answerContract[k]!==a[k]))throw Error('原创基础练习答案规则无效，请重新组卷。')
  if(!Array.isArray(g.parts)||g.parts.length!==1)throw Error('原创基础练习分问信息无效，请重新组卷。')
  const p=g.parts[0],partId=q.id+':part-1',b=p?.sourceBindingProvenance
  if(!p||p.partId!==partId||Number(p.marks)!==1||p.sourceQuestionId!==q.id||p.questionGroupId!==g.id||p.sourceKind!==ORIGINAL_SOURCE||p.sourceAuthority!==g.sourceAuthority||p.displaySourceLabel!==g.displaySourceLabel||p.originalQuestionId!==q.id||p.originalCatalogVersion!=='v1'||!exactKeys(b,['schemaVersion','sourceQuestionId','questionPartId','bindingSignature','reviewVersion'])||b.schemaVersion!=='stem-original-foundation-binding-v1'||b.sourceQuestionId!==q.id||b.questionPartId!==partId||!/^original:[a-f0-9]{64}$/.test(b.bindingSignature)||b.reviewVersion!=='v1'||forbidden.some(k=>Object.prototype.hasOwnProperty.call(p,k)))throw Error('原创基础练习绑定无效，请重新组卷。')
  return{id:g.id,marks:1,answerFormat:'single-choice',sourceLabel:ORIGINAL_LABEL,images:[],parts:[{id:partId,label:String(p.label||'main'),marks:1,canMark:false,sourceBindingProvenance:clone(b)}],choiceOptions:q.options.map(o=>({label:o.id,text:o.text.trim()})),studyOnly:true,original:true,prompt:q.prompt.trim(),topicId:q.topicId,originalCatalogVersion:'v1',answerContract:clone(a)}
}

function validatePracticeSet(payload, expected) {
if (!payload || payload.schemaVersion !== 'syllabus-practice-set-v1' || payload.routeId !== expected.routeId || payload.stage !== expected.stage || String(payload.subjectCode) !== String(expected.subjectCode)) throw new Error('组卷响应不完整或路线不匹配，请重试。')
const groups = payload.questionGroups
const chapterStudy = expected.studyMode === CHAPTER_MODE
if (chapterStudy) {
  const selected = unique(payload.selectedSyllabusTopicIds), available = Number(payload.available), count = Number(payload.count), source = payload.sourceAvailability, mix = payload.sourceMix
  if (payload.studyMode !== CHAPTER_MODE || payload.sourcePreference !== (expected.sourcePreference || 'official-first') || payload.practiceMode !== 'study-only' || payload.formalProgressEligible !== false || expected.syllabusTopicIds.length !== 1 || selected.length !== 1 || selected[0] !== expected.syllabusTopicIds[0] ||
    !Array.isArray(payload.selectedSyllabusTopicIds)||payload.selectedSyllabusTopicIds.length!==1||!Number.isSafeInteger(Number(expected.questionCount))||Number(expected.questionCount)<1||Number(expected.questionCount)>15||!Array.isArray(groups) || groups.length < 1 || groups.length > 15 || count !== groups.length || groups.length > Number(expected.questionCount) || !Number.isSafeInteger(available) || available < groups.length || typeof payload.limited !== 'boolean' || payload.limited !== (groups.length < Number(expected.questionCount)) || payload.partial!==undefined&&payload.partial!==payload.limited ||
    !plain(source) || !['official', 'originalFoundation', 'total', 'selectedPool'].every(key => Number.isSafeInteger(source[key]) && source[key] >= 0) || source.total !== source.official + source.originalFoundation || source.selectedPool !== available ||
    !plain(mix) || !Number.isSafeInteger(mix.official) || !Number.isSafeInteger(mix.originalFoundation) || mix.official < 0 || mix.originalFoundation < 0 || mix.official + mix.originalFoundation !== groups.length || mix.official>source.official||mix.originalFoundation>source.originalFoundation|| !Array.isArray(payload.questionGroupIds) || payload.questionGroupIds.length !== groups.length) throw new Error('章节学习组卷响应不完整，请重试。')
} else if (!Array.isArray(groups) || groups.length < MIN_SET || groups.length !== Number(expected.questionCount) || groups.length > 15 || payload.partial) throw new Error('这次组卷未返回完整题目，原选择已保留，请重试。')
if (!['verified', 'study-only'].includes(payload.practiceMode)) throw new Error('所选题目暂未达到练习条件。')
if (payload.practiceMode === 'verified' && payload.formalProgressEligible !== true) throw new Error('练习资格尚未确认，请刷新题库。')
const seen = new Set()
const questions = groups.map((group, index) => {
  if (!group?.id || seen.has(group.id) || chapterStudy && payload.questionGroupIds[index] !== group.id) throw new Error('题目重复或不属于当前学科，请重新组卷。')
  seen.add(group.id)
  if (chapterStudy && group.sourceKind === ORIGINAL_SOURCE) return validateOriginalGroup(group, expected, index)
  if (group.routeId !== expected.routeId || group.stage !== expected.stage || String(group.subjectCode) !== String(expected.subjectCode) || !expected.components.includes(Number(group.paperComponent))) throw new Error('题目重复或不属于当前学科，请重新组卷。')
  if (group.studentStudyEligible !== true || group.sourceContent?.complete !== true || group.sourceContent?.fileComplete !== true || !group.sourceRef?.paperId) throw new Error('题目原文或图表不完整，请重试。')
  if (!group.syllabusMapping?.topicIds?.some(t => expected.syllabusTopicIds.includes(t))) throw new Error('题目与所选章节不匹配。')
  let images = unique(group.sourceContent.assetUrls).map(questionAsset)
  let sourceRegions = []
  if (images.length) {
    if (images.some(url => !url.startsWith('/question-assets/' + group.sourceRef.paperId + '/'))) throw new Error('题图与原卷不匹配，请重新组卷。')
    if (images.some(path => !/\/qp-/.test(path)) || (Array.isArray(group.sourceContent.pages) && images.length !== group.sourceContent.pages.length)) throw new Error('题目原图尚未完整返回，请重试。')
  } else {
    if (group.sourceContent.schemaVersion !== 'ai-verified-coordinate-source-v1' || !Array.isArray(group.nativeSourceImages) || !group.nativeSourceImages.length || group.nativeSourceImages.length > 20) throw new Error('题目原图尚未完整返回，请重试。')
    sourceRegions = group.nativeSourceImages.map(image => normalizeSourceRegion(image, group.routeId, group.id))
    const pages = [...new Set(sourceRegions.map(image => image.page))]
    if (!Array.isArray(group.sourceContent.pages) || pages.length !== group.sourceContent.pages.length || group.sourceContent.pages.some(page => !pages.includes(page))) throw new Error('题目原图尚未完整返回，请重试。')
    images = sourceRegions.map(image => image.url)
    if (new Set(images).size !== images.length) throw new Error('题目原图重复，请重新组卷。')
  }
  if(group.questionFocus)sourceRegions=normalizeQuestionFocus(group.questionFocus,group.sourceRef.paperId,group.id,images)
  const options=choiceOptions(group.choiceOptions)
  const parts = (group.parts || []).map(part => {
    const provenance = part.provenance || part.sourceBindingProvenance || part.markingProvenance
    const bound = provenance?.sourceQuestionId === group.id && provenance?.questionPartId === part.partId && Boolean(provenance.bindingSignature)
    return { id: String(part.partId || ''), label: String(part.label || ''), marks: Number(part.marks),
      canMark: part.aiAssistedMarkingAvailable === true && bound,
      provenance: bound ? clone(provenance) : null }
  })
  if (!parts.length || new Set(parts.map(p => p.id)).size !== parts.length || parts.some(p => !p.id || !Number.isFinite(p.marks) || p.marks < 0)) throw new Error('题目分问信息不完整，请重试。')
  if (!Number.isFinite(Number(group.totalMarks)) || Number(group.totalMarks) !== parts.reduce((sum, p) => sum + p.marks, 0)) throw new Error('题目总分不完整，请重新组卷。')
  return { id: group.id, number: String(group.questionNumber || ''), marks: Number(group.totalMarks),
    answerFormat:isSingleChoice({subjectCode:group.subjectCode,component:group.paperComponent,answerFormat:group.answerFormat,choiceLabels:group.choiceLabels})?'single-choice':'written',
    component: Number(group.paperComponent), paperId: group.sourceRef.paperId,
    sourceLabel: [group.sourceRef.paper, group.questionNumber].filter(Boolean).join(' · '),
    qualityFlag: group.qualityFlag === 'aicheck' ? 'aicheck' : '',
    images, sourceRegions, parts,choiceOptions:options, studyOnly: payload.practiceMode === 'study-only' }
})
if (chapterStudy) {
  const originalCount = questions.filter(question => question.original).length
  if (payload.sourceMix.originalFoundation !== originalCount || payload.sourceMix.official !== questions.length - originalCount) throw new Error('章节学习来源统计不一致，请重试。')
}
return { routeId: expected.routeId, stage: expected.stage, subjectCode: String(expected.subjectCode),
  components: expected.components.slice(), topicIds: expected.syllabusTopicIds.slice(),
  practiceMode: payload.practiceMode,...(chapterStudy ? { formalProgressEligible:false,studyMode: CHAPTER_MODE, sourcePreference: expected.sourcePreference || 'official-first', limited: payload.limited, sourceAvailability: clone(payload.sourceAvailability), sourceMix: clone(payload.sourceMix) } : {}), questions }
}

async function generatePractice(spec) {
const startedEpoch = epoch()
const startedOwner = identity()
const payload = await requestJson('/api/stem/practice-sets', {
  routeId: spec.routeId, syllabusTopicIds: spec.syllabusTopicIds,
  questionCount: spec.questionCount, components: spec.components,
  excludeAttempted: false, seed: Date.now() >>> 0,
  ...(spec.studyMode === CHAPTER_MODE ? { studyMode: CHAPTER_MODE, sourcePreference: spec.sourcePreference || 'official-first' } : {}),
}, { timeout: 20000, stemAuth: false, nativeSourceRegions: true })
if (startedEpoch !== epoch() || startedOwner !== identity()) throw new Error('账号已变化，请重新开始练习。')
return createSession(payload, spec)
}

function createSession(payload, spec) {
return { ...validatePracticeSet(payload, spec), id: id(), schema: 1, owner: identity(), privacyEpoch: epoch(),
  index: 0, answers: {}, createdAt: Date.now(), updatedAt: Date.now() }
}

function assertSession(session) {
if (!session || !validId(session.id) || session.schema !== 1 || !Array.isArray(session.questions)) throw new Error('未找到这次练习，请重新组卷。')
if (session.privacyEpoch !== epoch()) throw new Error('本次会话已结束，请返回学习页。')
if (session.owner && session.owner !== identity()) throw new Error('账号已切换，请返回学习页。')
if(session.studyMode===CHAPTER_MODE&&(!['official-first','original-foundation-only'].includes(session.sourcePreference)||session.formalProgressEligible!==false))throw Error('章节学习会话无效，请重新组卷。')
if (session.questions.some(question => {const binding=question.parts?.[0]?.sourceBindingProvenance;return question.original && session.studyMode !== CHAPTER_MODE || question.original && (question.studyOnly !== true || question.answerFormat !== 'single-choice' || !cleanText(question.prompt, 12000) || question.topicId !== session.topicIds?.[0] || question.originalCatalogVersion!=='v1'||question.answerContract?.schemaVersion!=='stem-original-foundation-answer-contract-v1'||question.answerContract?.submissionEndpoint !== ORIGINAL_ENDPOINT || !Array.isArray(question.choiceOptions) || !/^(?:ABC|ABCD)$/.test(question.choiceOptions.map(option => option.label).join('')) || question.parts?.length !== 1 || binding?.schemaVersion!=='stem-original-foundation-binding-v1'||binding?.sourceQuestionId !== question.id||binding?.questionPartId!==question.parts[0].id||!/^original:[a-f0-9]{64}$/.test(String(binding?.bindingSignature||''))||binding?.reviewVersion!=='v1')})) throw new Error('原创基础练习会话无效，请重新组卷。')
}

function saveSession(session) {
assertSession(session)
const next = { ...session, updatedAt: Date.now() }
try {
  wx.setStorageSync(`${SESSION_PREFIX}${session.id}`, next)
  wx.setStorageSync(`${RECENT_PREFIX}${session.routeId}`, session.id)
} catch { throw new Error('本机空间不足，练习尚未保存。请释放空间后重试。') }
return next
}

function readSession(sessionId) {
if (!validId(sessionId)) return null
const session = wx.getStorageSync(`${SESSION_PREFIX}${sessionId}`)
try { assertSession(session); return clone(session) } catch { return null }
}

function needsSignIn(sessionId) {
if (!validId(sessionId) || identity()) return false
const saved = wx.getStorageSync(`${SESSION_PREFIX}${sessionId}`)
return Boolean(saved?.owner && saved.privacyEpoch === epoch())
}

function recentSession(routeId) { return readSession(wx.getStorageSync(`${RECENT_PREFIX}${routeId}`)) }
async function refreshQuestionDisplay(sessionId,questionId,active=()=>true){
 const session=readSession(sessionId),q=session?.questions.find(q=>q.id===questionId),startedOwner=identity(),startedEpoch=epoch()
 if(!q||q.original||q.sourceRegions?.length)return false
 const display=await questionDisplay(session,q)
 if(!display||!active()||identity()!==startedOwner||epoch()!==startedEpoch)return false
 const latest=readSession(sessionId),question=latest?.questions.find(q=>q.id===questionId)
 if(!question)return false
 question.sourceRegions=display.regions;if(display.options)question.choiceOptions=display.options
 saveSession(latest);return true
}

function saveChoice(sessionId,questionId,choice){
 const session=readSession(sessionId),question=session?.questions.find(q=>q.id===questionId)
 if(!session||!question||!isSingleChoice({...question,subjectCode:session.subjectCode}))throw Error('这道题不支持选项作答。')
 const oldPhoto=session.answers[questionId]?.photo
 session.answers[questionId]=nextChoiceAnswer(session.answers[questionId],choice)
 saveSession(session);if(oldPhoto)removeEvidence(oldPhoto);return session
}

function validateOriginalResult(r,e) {
 const forbidden=['officialScore','officialGrade','grade','gradeEstimate','paperId','sourceRef','markingProvenance','markingGrant'],bad=()=>{throw Error('原创基础练习结果无效，请重试。')}
 if(!plain(r)||forbidden.some(k=>Object.prototype.hasOwnProperty.call(r,k))||r.schemaVersion!=='stem-original-foundation-result-v1'||r.routeId!==e.routeId||r.syllabusTopicId!==e.syllabusTopicId||r.questionId!==e.questionId||r.selectedOptionId!==e.selectedOptionId||e.ownerId&&r.ownerId!=null&&String(r.ownerId)!==e.ownerId||!e.optionIds.includes(r.correctOptionId)||typeof r.correct!=='boolean'||!Number.isInteger(r.score)||![0,1].includes(r.score)||r.maxScore!==1||r.scoreScope!==ORIGINAL_SCORE||r.formalProgressEligible!==false||r.countsTowardFormalGrade!==false||r.correct!==(r.selectedOptionId===r.correctOptionId)||r.score!==(r.correct?1:0)||!exactKeys(r.solution,['summary','markPoints'])||!cleanText(r.solution.summary,6000)||!Array.isArray(r.solution.markPoints)||!r.solution.markPoints.length||r.solution.markPoints.length>10)bad()
 const seen=new Set(),markPoints=r.solution.markPoints.map(p=>{if(!exactKeys(p,['id','awarded','marks','maxMarks','reason'])||!cleanText(p.id,160)||seen.has(p.id)||typeof p.awarded!=='boolean'||!Number.isInteger(p.marks)||![0,1].includes(p.marks)||p.maxMarks!==1||p.awarded!==(p.marks===1)||!cleanText(p.reason,2000))bad();seen.add(p.id);return{id:p.id,awarded:p.awarded,marks:p.marks,maxMarks:1,reason:p.reason.trim()}})
 if(markPoints.reduce((n,p)=>n+p.marks,0)!==r.score)bad()
 return{schemaVersion:r.schemaVersion,available:true,original:true,selectedOptionId:r.selectedOptionId,correct:r.correct,score:r.score,maxScore:1,scoreScope:ORIGINAL_SCORE,formalProgressEligible:false,countsTowardFormalGrade:false,correctOptionId:r.correctOptionId,solution:{summary:r.solution.summary.trim(),markPoints}}
}

async function markOriginalChoice(s,q,a) {
 const lock=`${s.id}:${q.id}:original`
 if(marking.has(lock))throw Error('本题正在核对，请等待当前结果。')
 if(!wx.getStorageSync('stemistSessionToken')||!identity())throw Object.assign(Error('请登录后提交，已选答案会保留。'),{statusCode:401})
 const owner=identity(),revision=a.revision,selectedOptionId=a.choice,index=s.questions.indexOf(q),attemptId=a.attemptId||`${s.id}-q${index}-r${revision}`
 const check=()=>{const latest=readSession(s.id),answer=latest?.answers[q.id];if(!latest||identity()!==owner||answer?.revision!==revision||answer?.choice!==selectedOptionId||answer?.attemptId!==attemptId)throw Error('作答或账号已变化，请重新提交。');return latest}
 s.owner=owner;s.answers[q.id].attemptId=attemptId;saveSession(s);marking.add(lock)
 try {
  const expected={routeId:s.routeId,syllabusTopicId:q.topicId,questionId:q.id,selectedOptionId,optionIds:q.choiceOptions.map(o=>o.label),ownerId:owner}
  const result=validateOriginalResult(await requestJson(q.answerContract.submissionEndpoint,{routeId:s.routeId,syllabusTopicId:q.topicId,questionId:q.id,response:{selectedOptionId}}),expected);check()
  const scoreResult={rawMarks:result.score,maxMarks:1,percentage:result.score*100,partial:false,scoreScope:ORIGINAL_SCORE,formalProgressEligible:false,countsTowardFormalGrade:false}
  const markingParts=[{unitPartId:q.parts[0].id,provenance:{routeId:s.routeId,...q.parts[0].sourceBindingProvenance}}]
  const synced=await requestJson('/api/stem/attempts',{attemptId,mode:'topic',routeId:s.routeId,stage:s.stage,unitId:s.id,studyMode:CHAPTER_MODE,sourcePreference:s.sourcePreference,markingParts,submittedAt:new Date().toISOString(),attempt:{id:attemptId,unitId:s.id,routeId:s.routeId,stage:s.stage,studyMode:CHAPTER_MODE,sourcePreference:s.sourcePreference,attemptStatus:'study-result',answers:{[q.parts[0].id]:selectedOptionId},evidence:{kind:'single-choice',count:1},formalResult:false,scoreResult}})
  const latest=check();if(synced?.attempt?.attemptId!==attemptId)throw Error('服务器尚未确认学习记录，答案已保留。')
  latest.answers[q.id].objectiveResult=result;latest.answers[q.id].objectiveHistory={...(latest.answers[q.id].objectiveHistory||{}),[revision]:result};saveSession(latest);return result
 } finally { marking.delete(lock) }
}

async function markChoice(sessionId,questionId){
 const session=readSession(sessionId),q=session?.questions.find(q=>q.id===questionId),answer=session?.answers[questionId]
 if(!session||!q||!isSingleChoice({...q,subjectCode:session.subjectCode})||!hasChoice(answer))throw Error('请先选择本题答案。')
 if(q.original)return markOriginalChoice(session,q,answer)
 if(!wx.getStorageSync('stemistSessionToken'))throw Object.assign(Error('请登录后核对答案，已选答案会保留。'),{statusCode:401})
 const expectedOwner=identity(),revision=answer.revision,selectedOption=answer.choice
 const check=()=>{const latest=readSession(sessionId);if(!latest||identity()!==expectedOwner||latest.answers[questionId]?.revision!==revision||latest.answers[questionId]?.choice!==selectedOption)throw Error('作答或账号已变化，请重新提交。');return latest}
 session.owner=expectedOwner;saveSession(session)
 const expected={attemptId:sessionId+'-q'+session.questions.indexOf(q)+'-r'+revision,mode:'topic',routeId:session.routeId,stage:session.stage,paperId:q.paperId,sourceQuestionId:q.id,selectedOption}
 const markingParts=q.parts.filter(p=>p.provenance).map(p=>({unitPartId:p.id,provenance:{...p.provenance,routeId:session.routeId}}))
 const synced=await requestJson('/api/stem/attempts',{attemptId:expected.attemptId,mode:'topic',routeId:session.routeId,stage:session.stage,paperId:q.paperId,unitId:session.id,submittedAt:new Date().toISOString(),markingParts,attempt:{id:expected.attemptId,routeId:session.routeId,unitId:session.id,attemptStatus:'submitted',answers:{[q.id]:selectedOption},evidence:{kind:'single-choice',count:1}}})
 check();if(synced?.attempt?.attemptId!==expected.attemptId)throw Error('服务器尚未确认作答，答案已保留。')
 const result=await gradeObjectiveAnswer(expected),latest=check()
 latest.answers[q.id].objectiveResult=result
 latest.answers[q.id].objectiveHistory={...(latest.answers[q.id].objectiveHistory||{}),[revision]:result}
 saveSession(latest);return result
}

function questionView(session, index) {
const current = Math.max(0, Math.min(session.questions.length - 1, Number(index) || 0))
const q = session.questions[current]
const answer = session.answers[q.id] || {}
const choiceMode=q.original===true||isSingleChoice({...q,subjectCode:session.subjectCode})
const results = q.parts.map(p => answer.results?.[p.id] ? { label: p.label === 'main' ? '本题' : p.label, ...answer.results[p.id] } : null).filter(Boolean)
return { index: current, total: session.questions.length,
  answeredCount: session.questions.filter(item => hasChoice(session.answers[item.id])||Boolean(session.answers[item.id]?.photo)).length,
  question: { id: q.id, number: q.number, sourceLabel: q.sourceLabel, marks: q.marks,
    reviewLabel: q.qualityFlag === 'aicheck' ? 'AI 审核' : '',
    reviewNotice: q.qualityFlag === 'aicheck' ? '仅供练习，不计正式进度' : '',
    choiceMode, original: q.original === true, prompt: q.original ? q.prompt : '', originalNotice: q.original ? '仅用于本章学习，不计正式进度或官方成绩' : '',
    options:q.choiceOptions||choiceOptions(null),hasOptionText:Boolean(q.choiceOptions?.some(o=>o.text)),
    images: (q.images || []).map((path, i) => ({ id: `${q.id}-${i}`, url: imageUrl(path), loaded: false, failed: false,
      ...(q.sourceRegions?.[i] ? sourceRegionStyle(q.sourceRegions[i]) : {}) })),
    partsLabel: q.parts.map(p => p.label).filter(label => label && label !== 'main').join(' · '),
    canMark: !q.original && q.parts.some(p => p.canMark), studyOnly: q.studyOnly, fullPage: !q.original && !q.sourceRegions?.length },
  photo: answer.photo || '', choice:hasChoice(answer)?answer.choice:'', objectiveResult:answer.objectiveResult||null, results:choiceMode?[]:results, reviewedCount: results.length,
  reviewComplete: q.parts.some(p => p.canMark) && q.parts.filter(p => p.canMark).every(p => Boolean(answer.results?.[p.id])),
  unavailableParts: q.parts.filter(p => !p.canMark).length,
  navItems: session.questions.map((item, i) => ({ index: i, label: i + 1, current: i === current, answered: hasChoice(session.answers[item.id])||Boolean(session.answers[item.id]?.photo) })) }
}

function evidenceDirectory() { return `${wx.env.USER_DATA_PATH}/native-practice` }
function removeEvidence(path) {
if (!path || !String(path).startsWith(`${evidenceDirectory()}/`) || String(path).includes('..')) return
try { wx.getFileSystemManager().unlink({ filePath: path, fail() {} }) } catch { /* Missing evidence is already removed. */ }
}

async function attachPhoto(context, sourcePath, { cancelled = () => false } = {}) {
if (cancelled()) throw new Error('裁剪已取消。')
const session = readSession(context?.sessionId)
if (!session || context.privacyEpoch !== epoch()) throw new Error('练习已结束，请返回题目重新拍摄。')
const questionIndex = session.questions.findIndex(q => q.id === context.questionId)
if (questionIndex < 0) throw new Error('照片与题目不匹配，请返回重新拍摄。')
if (session.questions[questionIndex].original) throw new Error('原创基础练习请直接选择答案。')
const old = session.answers[context.questionId] || {}
const revision = (old.revision || 0) + 1
const dest = `${evidenceDirectory()}/${session.id}-${questionIndex}-${revision}-${Date.now().toString(36)}.jpg`
const compressed = await compressImage(sourcePath)
if (cancelled()) throw new Error('裁剪已取消。')
assertSession(session)
const fs = wx.getFileSystemManager()
try { fs.mkdirSync(evidenceDirectory(), true) } catch { fs.accessSync(evidenceDirectory()) }
await new Promise((resolve, reject) => fs.copyFile({ srcPath: compressed, destPath: dest, success: resolve, fail: () => reject(new Error('照片未保存，请检查本机空间后重试。')) }))
try {
  assertSession(session)
  const latest = readSession(session.id)
  if (cancelled() || !latest) throw new Error('裁剪或练习已结束，照片未写入。')
  latest.answers[context.questionId] = { photo: dest, revision, results: {}, attemptId: `${session.id}-q${questionIndex}-r${revision}` }
  saveSession(latest)
} catch (error) { removeEvidence(dest); throw error }
if (old.photo) removeEvidence(old.photo)
return session.id
}

function verifiedResult(result, part) {
const score = result?.score ?? result?.rawMarks
const maxScore = result?.maxScore ?? result?.maxMarks
if (result?.mode !== 'vision' || result?.providerStatus !== 'connected' || typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > part.marks || maxScore !== part.marks || typeof result.confidence !== 'number' || !Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) throw new Error('AI 未返回有效批改结果；照片已保留，可重试。')
return { score, maxScore, summary: String(result.summary || result.rationale || '').slice(0, 6000),
  confidence: result.confidence, reviewRequired: result.reviewRequired !== false || result.humanReviewRequired !== false,
  provisional: true }
}

async function markQuestion(sessionId, questionId, onProgress = () => {}) {
const lock = `${sessionId}:${questionId}`
if (marking.has(lock)) throw new Error('本题正在批改，请等待当前结果。')
const token = wx.getStorageSync('stemistSessionToken')
if (!token || !identity()) throw Object.assign(new Error('请先登录，拍好的照片会保留。'), { statusCode: 401 })
let session = readSession(sessionId)
if (!session) throw new Error('练习已结束，请重新打开。')
const question = session.questions.find(q => q.id === questionId)
const answer = session.answers[questionId]
if (question?.original) throw new Error('原创基础练习请直接选择答案。')
if (!question || !answer?.photo) throw new Error('请先拍摄本题答案。')
const parts = question.parts.filter(p => p.canMark && !answer.results?.[p.id])
if (!parts.length) return
marking.add(lock)
const expectedOwner = identity()
const ensureCurrent = () => {
  assertSession(session)
  if (identity() !== expectedOwner || wx.getStorageSync('stemistSessionToken') !== token) throw new Error('登录状态已变化，请重新登录后重试。')
  const current = readSession(sessionId)
  if (!current || current.answers[questionId]?.revision !== answer.revision) throw new Error('答案照片已更新，请重新提交。')
  return current
}
try {
  // A guest draft is adopted only on the learner's explicit submit action.
  session.owner = expectedOwner
  saveSession(session)
  const imageDataUrl = await readAsJpegDataUrl(answer.photo)
  ensureCurrent()
  const boundParts = question.parts.filter(p => p.canMark).map(p => ({ unitPartId: p.id, provenance: { ...p.provenance, routeId: session.routeId } }))
  const binding = { attemptId: answer.attemptId, mode: 'topic', routeId: session.routeId, stage: session.stage, paperId: question.paperId, unitId: session.id }
  const response = await requestJson('/api/stem/attempts', { ...binding, submittedAt: new Date().toISOString(), markingParts: boundParts,
    attempt: { id: answer.attemptId, routeId: session.routeId, unitId: session.id, attemptStatus: 'marking-pending', answers: {}, evidence: { kind: 'photo', count: 1 } } })
  ensureCurrent()
  if (response?.attempt?.attemptId !== answer.attemptId) throw new Error('服务端尚未确认本次提交，照片已保留。')
  const capabilityResponse = await requestJson('/api/stem/marking/capabilities', { attemptId: answer.attemptId, mode: 'topic', submitted: true, paperId: question.paperId, parts: parts.map(p => ({ provenance: { ...p.provenance, routeId: session.routeId } })) })
  ensureCurrent()
  const capabilities = capabilityResponse?.capabilities
  if (!Array.isArray(capabilities) || parts.some(p => capabilities.filter(c => c.questionPartId === p.id && typeof c.markingGrant === 'string' && c.markingGrant).length !== 1)) throw new Error('这道题的批改授权未完整返回，请重试。')
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    ensureCurrent()
    onProgress(`正在批改 ${i + 1}/${parts.length}`)
    const result = await requestJson('/api/ai/mark-handwriting', { attemptId: answer.attemptId, mode: 'topic', submitted: true, paperId: question.paperId,
      markingGrant: capabilities.find(c => c.questionPartId === part.id).markingGrant,
      imageDataUrl, typedResponse: '', provenance: { ...part.provenance, routeId: session.routeId } }, { timeout: 60000 })
    const latest = ensureCurrent()
    latest.answers[questionId].results[part.id] = verifiedResult(result, part)
    saveSession(latest)
    onProgress(`已批改 ${i + 1}/${parts.length}`)
  }
} finally { marking.delete(lock) }
}

module.exports = { MIN_SET, TOPIC_FLOOR, SESSION_PREFIX, RECENT_PREFIX, EPOCH_KEY, epoch, selectionState, validatePracticeSet,
generatePractice, createSession, saveSession, readSession, needsSignIn, recentSession, questionView, attachPhoto, markQuestion, verifiedResult,validateOriginalResult,saveChoice,markChoice,refreshQuestionDisplay }
