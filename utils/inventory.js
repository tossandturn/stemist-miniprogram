const { getJson } = require('./api')

const INVENTORY_CACHE_TTL_MS = 60 * 1000
const inventoryCache = new Map()
const uniqueIds = value => [...new Set((Array.isArray(value) ? value : []).filter(id => typeof id === 'string' && id))]
const CHAPTER_MODE='chapter-study',ORIGINAL='original-foundation'
const chapterCount=v=>Number.isSafeInteger(v)&&v>=0?v:null
function normalizeChapterAvailability(v){
 if(v==null)return null
 const available=chapterCount(v.available),officialAvailable=chapterCount(v.officialAvailable),originalAvailable=chapterCount(v.originalAvailable),fallbackKind=v.fallbackKind===null?null:String(v.fallbackKind||'')
 if(v.mode!==CHAPTER_MODE||available===null||officialAvailable===null||originalAvailable===null||available!==officialAvailable+originalAvailable||typeof v.startable!=='boolean'||v.startable!==(available>0)||![null,ORIGINAL].includes(fallbackKind)||(fallbackKind===ORIGINAL)!==(officialAvailable===0&&originalAvailable>0))throw Error('章节学习题库状态不兼容，请更新后重试。')
 return{mode:CHAPTER_MODE,available,officialAvailable,originalAvailable,startable:v.startable,fallbackKind}
}
function normalizeChapterPolicy(v){
 if(v==null)return null
 if(v.mode!==CHAPTER_MODE||v.minSourceGroups!==1||v.maxSourceGroups!==15||v.countPolicy!=='cap-to-available'||v.formalProgressEligible!==false||!Array.isArray(v.sourcePreferences)||v.sourcePreferences.join('|')!=='official-first|original-foundation-only')throw Error('章节学习题库规则不兼容，请更新后重试。')
 return{mode:CHAPTER_MODE,minSourceGroups:1,maxSourceGroups:15,countPolicy:v.countPolicy,formalProgressEligible:false,sourcePreferences:v.sourcePreferences.slice()}
}

function normalizePracticePolicy(value) {
  if (value === undefined || value === null) return null
  if (value.schemaVersion !== 'stem-topic-practice-policy-v1' || value.minSourceGroups !== 6 || value.minReviewedGroups !== 12 ||
    !Array.isArray(value.setSizes) || !value.setSizes.length || value.setSizes.some(n => ![6, 10, 15].includes(n))) {
    throw new Error('题库练习规则不兼容，请更新后重试。')
  }
  return { schemaVersion: value.schemaVersion, minSourceGroups: value.minSourceGroups,
    minReviewedGroups: value.minReviewedGroups, setSizes: [...new Set(value.setSizes)].sort((a, b) => a - b),allowReviewedSubsetStudy:value.allowReviewedSubsetStudy===true,allowCrossTopicStudy:value.allowCrossTopicStudy===true,
    chapterStudy: normalizeChapterPolicy(value.chapterStudy) }
}

function countOrNull(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null
}

function normalizeInventory(payload, expectedRouteId = '') {
  if (!payload || typeof payload !== 'object') throw new Error('题库状态响应无效')
  const routeId = String(payload.routeId || expectedRouteId || '').trim()
  if (expectedRouteId && routeId && routeId !== expectedRouteId) throw new Error('题库状态与当前路线不匹配')
  const paperComponents = [...new Set((Array.isArray(payload.paperComponents) ? payload.paperComponents : []).map(Number).filter(n => Number.isInteger(n) && n > 0))]
  const topics = Array.isArray(payload.topics)
    ? payload.topics.map((topic) => ({
      id: String((topic && topic.id) || ''),
      code: String((topic && topic.code) || ''),
      name: String((topic && (topic.name || topic.title)) || '').trim(),
      verifiedQuestionCount: countOrNull(topic && topic.verifiedQuestionCount),
      studyQuestionCount: countOrNull(topic && topic.studyQuestionCount),
      availableQuestionCount: countOrNull(topic && topic.availableQuestionCount),
      indexedQuestionCount: countOrNull(topic && topic.indexedQuestionCount),
      pendingReviewCount: countOrNull(topic && topic.pendingReviewCount),
      questionIdsByComponent: Object.fromEntries(Object.entries(topic?.questionIdsByComponent || {}).filter(([key]) => /^\d+$/.test(key)).map(([key, value]) => [key, {
        verifiedQuestionIds: uniqueIds(value?.verifiedQuestionIds),
        studyQuestionIds: uniqueIds(value?.studyQuestionIds),
        ...(Array.isArray(value?.apiReadyQuestionIds) ? { apiReadyQuestionIds: uniqueIds(value.apiReadyQuestionIds) } : {}),
        ...(Array.isArray(value?.releasedStudyQuestionIds) ? { releasedStudyQuestionIds: uniqueIds(value.releasedStudyQuestionIds) } : {}),
      }])),
      apiStartable: topic?.apiStartable === true,
      formalScoreReady: topic?.formalScoreReady === true,
      availableSetSizes: Array.isArray(topic?.availableSetSizes) ? topic.availableSetSizes.filter(n => [6, 10, 15].includes(n)) : [],
      ready: Boolean(topic && topic.ready),
      studyReady: Boolean(topic && topic.studyReady),
      ctaPolicy: String((topic && topic.ctaPolicy) || ''),
      chapterStudy: normalizeChapterAvailability(topic?.chapterStudy),
      componentCounts: Object.fromEntries(Object.entries(topic?.componentCounts || {}).filter(([key]) => /^\d+$/.test(key)).map(([key, value]) => [key, { chapterStudy: normalizeChapterAvailability(value?.chapterStudy) }])),
    })).filter((topic) => topic.id && topic.name)
    : []
  let chapterStudy=null
  if(payload.chapterStudy!=null){
    const c=payload.chapterStudy,rawGaps=c.gapTopicIds,gapTopicIds=uniqueIds(rawGaps)
    if(c.mode!==CHAPTER_MODE||c.catalogVersion!=='v1'||chapterCount(c.topicCount)!==topics.length||!Array.isArray(rawGaps)||gapTopicIds.length!==rawGaps.length||topics.length!==payload.topics.length||chapterCount(c.startableTopicCount)!==topics.filter(t=>t.chapterStudy?.startable).length||!topics.every(t=>t.chapterStudy&&paperComponents.every(n=>t.componentCounts[n]?.chapterStudy)))throw Error('章节学习题库状态不完整，请更新后重试。')
    const gaps=topics.filter(t=>t.chapterStudy.officialAvailable===0).map(t=>t.id)
    if(gapTopicIds.length!==gaps.length||gapTopicIds.some(id=>!gaps.includes(id)))throw Error('章节学习题库缺口状态不一致，请更新后重试。')
    chapterStudy={mode:CHAPTER_MODE,catalogVersion:'v1',topicCount:topics.length,startableTopicCount:c.startableTopicCount,gapTopicIds}
  }
  const practicePolicy=normalizePracticePolicy(payload.practicePolicy)
  if(Boolean(chapterStudy)!==Boolean(practicePolicy?.chapterStudy))throw Error('章节学习题库规则不完整，请更新后重试。')
  return {
    routeId,
    practicePolicy,
    chapterStudy,
    paperComponents,
    syllabusVersion: String(payload.syllabusVersion || ''),
    officialPaperCount: countOrNull(payload.officialPaperCount),
    officialPairedPaperCount: countOrNull(payload.officialPairedPaperCount),
    indexedQuestionGroupCount: countOrNull(payload.indexedQuestionGroupCount),
    verifiedQuestionGroupCount: countOrNull(payload.verifiedQuestionGroupCount),
    studyQuestionGroupCount: countOrNull(payload.studyQuestionGroupCount),
    availableQuestionGroupCount: countOrNull(payload.availableQuestionGroupCount),
    unmappedQuestionGroupCount: countOrNull(payload.unmappedQuestionGroupCount),
    ready: Boolean(payload.ready),
    source: String(payload.source || 'server-syllabus-catalog'),
    gate: String(payload.gate || ''),
    topicCount: topics.length,
    topics,
  }
}

async function fetchRouteInventory(routeId) {
  const id = String(routeId || '').trim()
  if (!id) throw new Error('当前路线无效')
  const cached = inventoryCache.get(id)
  if (cached && cached.value && cached.expiresAt > Date.now()) return cached.value
  if (cached && cached.promise) return cached.promise
  // This public source catalog must not renew or forward a learner session.
  const promise = getJson(`/api/stem/routes/${encodeURIComponent(id)}/syllabus-topics`, { stemAuth: false })
    .then((payload) => {
      const value = normalizeInventory(payload, id)
      inventoryCache.set(id, { value, expiresAt: Date.now() + INVENTORY_CACHE_TTL_MS })
      return value
    })
    .finally(() => {
      const current = inventoryCache.get(id)
      if (current && current.promise) inventoryCache.delete(id)
    })
  inventoryCache.set(id, { promise })
  return promise
}

function clearInventoryCache() { inventoryCache.clear() }

module.exports = { INVENTORY_CACHE_TTL_MS, clearInventoryCache, countOrNull, fetchRouteInventory, normalizeInventory }
