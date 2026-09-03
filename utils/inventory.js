const { getJson } = require('./api')

function countOrNull(value) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null
}

function normalizeInventory(payload, expectedRouteId = '') {
  if (!payload || typeof payload !== 'object') throw new Error('题库状态响应无效')
  const routeId = String(payload.routeId || expectedRouteId || '').trim()
  if (expectedRouteId && routeId && routeId !== expectedRouteId) throw new Error('题库状态与当前路线不匹配')
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
      ready: Boolean(topic && topic.ready),
      studyReady: Boolean(topic && topic.studyReady),
      ctaPolicy: String((topic && topic.ctaPolicy) || ''),
    })).filter((topic) => topic.id && topic.name)
    : []
  return {
    routeId,
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
  const payload = await getJson(`/api/stem/routes/${encodeURIComponent(id)}/syllabus-topics`)
  return normalizeInventory(payload, id)
}

module.exports = { countOrNull, fetchRouteInventory, normalizeInventory }
