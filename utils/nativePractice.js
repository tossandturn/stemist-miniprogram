const { requestJson } = require('./api')
const { readAsJpegDataUrl, compressImage } = require('./image')
const { DEFAULT_API_BASE, safeApiBase } = require('./apiOrigin')

const SESSION_PREFIX = 'stemistNativePractice:'
const RECENT_PREFIX = 'stemistNativeRecent:'
const EPOCH_KEY = 'stemistPrivacyEpoch'
const MIN_SET = 6
const TOPIC_FLOOR = 12
const marking = new Set()
const clone = value => JSON.parse(JSON.stringify(value))
const unique = values => [...new Set(Array.isArray(values) ? values.filter(v => typeof v === 'string' && v) : [])]
const identity = () => { const user = wx.getStorageSync('stemistUser') || {}; return String(user.id || user.username || '') }
const epoch = () => Number(wx.getStorageSync(EPOCH_KEY)) || 0
const id = () => `mini-set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
const validId = value => /^mini-set-[a-z0-9-]{8,80}$/.test(String(value || ''))

// These counts are display/preflight only. The server repeats all eligibility
// checks before assembly; no client count authorizes a question or a score.
function selectionState(inventory, topicIds, components, questionCount) {
  const selected = unique(topicIds)
  const allowed = inventory?.paperComponents || []
  const scope = [...new Set(components || [])]
  const componentValid = scope.length > 0 && scope.every(c => allowed.includes(c))
  const all = new Set()
  const topicCounts = {}
  for (const topic of inventory?.topics || []) {
    const ids = new Set(scope.flatMap(c => unique(topic.questionIdsByComponent?.[c]?.verifiedQuestionIds)))
    topicCounts[topic.id] = ids.size
    if (selected.includes(topic.id)) ids.forEach(q => all.add(q))
  }
  const ready = componentValid && selected.length > 0 && selected.every(t => topicCounts[t] >= TOPIC_FLOOR)
  const sizes = [6, 10, 15].filter(n => n <= all.size)
  return { availableCount: all.size, topicCounts, sizes, ready,
    canStart: ready && sizes.includes(Number(questionCount)),
    hint: !selected.length ? '选择要练习的章节' : !ready ? '所选章节或卷型的题目尚未备齐，请调整选择。' : '' }
}

function questionAsset(value) {
  const raw = String(value || '').replace(/^https:\/\/stem\.ieltsist\.com/i, '')
  if (!/^\/question-assets\/[a-zA-Z0-9_-]+\/(?:qp|ms)-\d+\.(?:jpg|jpeg|png|webp)$/.test(raw)) throw new Error('题目原图地址无效，请重新组卷。')
  return raw
}

function imageUrl(path) {
  const app = getApp()
  const base = safeApiBase(app?.globalData?.apiBaseUrl) || DEFAULT_API_BASE
  return `${base}${questionAsset(path)}`
}

function validatePracticeSet(payload, expected) {
  if (!payload || payload.schemaVersion !== 'syllabus-practice-set-v1' || payload.routeId !== expected.routeId || payload.stage !== expected.stage || String(payload.subjectCode) !== String(expected.subjectCode)) throw new Error('组卷响应不完整或路线不匹配，请重试。')
  const groups = payload.questionGroups
  if (!Array.isArray(groups) || groups.length < MIN_SET || groups.length !== Number(expected.questionCount) || groups.length > 15 || payload.partial) throw new Error('这次组卷未返回完整题目，原选择已保留，请重试。')
  if (!['verified', 'study-only'].includes(payload.practiceMode)) throw new Error('所选题目暂未达到练习条件。')
  if (payload.practiceMode === 'verified' && payload.formalProgressEligible !== true) throw new Error('练习资格尚未确认，请刷新题库。')
  const seen = new Set()
  const questions = groups.map(group => {
    if (!group?.id || seen.has(group.id) || group.routeId !== expected.routeId || group.stage !== expected.stage || String(group.subjectCode) !== String(expected.subjectCode) || !expected.components.includes(Number(group.paperComponent))) throw new Error('题目重复或不属于当前学科，请重新组卷。')
    seen.add(group.id)
    if (group.studentStudyEligible !== true || group.sourceContent?.complete !== true || group.sourceContent?.fileComplete !== true || !group.sourceRef?.paperId) throw new Error('题目原文或图表不完整，请重试。')
    if (!group.syllabusMapping?.topicIds?.some(t => expected.syllabusTopicIds.includes(t))) throw new Error('题目与所选章节不匹配。')
    const images = unique(group.sourceContent.assetUrls).map(questionAsset)
    if (!images.length || images.some(path => !/\/qp-/.test(path)) || (Array.isArray(group.sourceContent.pages) && images.length !== group.sourceContent.pages.length)) throw new Error('题目原图尚未完整返回，请重试。')
    const parts = (group.parts || []).map(part => {
      const provenance = part.markingProvenance
      const bound = provenance?.sourceQuestionId === group.id && provenance?.questionPartId === part.partId && Boolean(provenance.bindingSignature)
      return { id: String(part.partId || ''), label: String(part.label || ''), marks: Number(part.marks),
        canMark: part.aiAssistedMarkingAvailable === true && bound,
        provenance: bound ? clone(provenance) : null }
    })
    if (!parts.length || new Set(parts.map(p => p.id)).size !== parts.length || parts.some(p => !p.id || !Number.isFinite(p.marks) || p.marks < 0)) throw new Error('题目分问信息不完整，请重试。')
    if (!Number.isFinite(Number(group.totalMarks)) || Number(group.totalMarks) !== parts.reduce((sum, p) => sum + p.marks, 0)) throw new Error('题目总分不完整，请重新组卷。')
    return { id: group.id, number: String(group.questionNumber || ''), marks: Number(group.totalMarks),
      component: Number(group.paperComponent), paperId: group.sourceRef.paperId,
      sourceLabel: [group.sourceRef.paper, group.questionNumber].filter(Boolean).join(' · '),
      images, parts, studyOnly: payload.practiceMode === 'study-only' }
  })
  return { routeId: expected.routeId, stage: expected.stage, subjectCode: String(expected.subjectCode),
    components: expected.components.slice(), topicIds: expected.syllabusTopicIds.slice(),
    practiceMode: payload.practiceMode, questions }
}

async function generatePractice(spec) {
  const startedEpoch = epoch()
  const startedOwner = identity()
  const payload = await requestJson('/api/stem/practice-sets', {
    routeId: spec.routeId, syllabusTopicIds: spec.syllabusTopicIds,
    questionCount: spec.questionCount, components: spec.components,
    excludeAttempted: false, seed: Date.now() >>> 0,
  }, { timeout: 20000, stemAuth: false })
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

function questionView(session, index) {
  const current = Math.max(0, Math.min(session.questions.length - 1, Number(index) || 0))
  const q = session.questions[current]
  const answer = session.answers[q.id] || {}
  const results = q.parts.map(p => answer.results?.[p.id] ? { label: p.label, ...answer.results[p.id] } : null).filter(Boolean)
  return { index: current, total: session.questions.length,
    answeredCount: session.questions.filter(item => Boolean(session.answers[item.id]?.photo)).length,
    question: { id: q.id, number: q.number, sourceLabel: q.sourceLabel, marks: q.marks,
      images: q.images.map((path, i) => ({ id: `${q.id}-${i}`, url: imageUrl(path), loaded: false, failed: false })),
      partsLabel: q.parts.map(p => p.label).filter(Boolean).join(' · '),
      canMark: q.parts.some(p => p.canMark), studyOnly: q.studyOnly },
    photo: answer.photo || '', results, reviewedCount: results.length,
    reviewComplete: q.parts.some(p => p.canMark) && q.parts.filter(p => p.canMark).every(p => Boolean(answer.results?.[p.id])),
    unavailableParts: q.parts.filter(p => !p.canMark).length,
    navItems: session.questions.map((item, i) => ({ index: i, label: i + 1, current: i === current, answered: Boolean(session.answers[item.id]?.photo) })) }
}

function evidenceDirectory() { return `${wx.env.USER_DATA_PATH}/native-practice` }
function removeEvidence(path) {
  if (!path || !String(path).startsWith(`${evidenceDirectory()}/`) || String(path).includes('..')) return
  try { wx.getFileSystemManager().unlink({ filePath: path, fail() {} }) } catch { /* Missing evidence is already removed. */ }
}

async function attachPhoto(context, sourcePath) {
  const session = readSession(context?.sessionId)
  if (!session || context.privacyEpoch !== epoch()) throw new Error('练习已结束，请返回题目重新拍摄。')
  const questionIndex = session.questions.findIndex(q => q.id === context.questionId)
  if (questionIndex < 0) throw new Error('照片与题目不匹配，请返回重新拍摄。')
  const old = session.answers[context.questionId] || {}
  const revision = (old.revision || 0) + 1
  const dest = `${evidenceDirectory()}/${session.id}-${questionIndex}-${revision}-${Date.now().toString(36)}.jpg`
  const compressed = await compressImage(sourcePath)
  assertSession(session)
  const fs = wx.getFileSystemManager()
  try { fs.mkdirSync(evidenceDirectory(), true) } catch { fs.accessSync(evidenceDirectory()) }
  await new Promise((resolve, reject) => fs.copyFile({ srcPath: compressed, destPath: dest, success: resolve, fail: () => reject(new Error('照片未保存，请检查本机空间后重试。')) }))
  try {
    assertSession(session)
    const latest = readSession(session.id)
    if (!latest) throw new Error('练习已结束。')
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
  if (marking.has(lock)) return
  const token = wx.getStorageSync('stemistSessionToken')
  if (!token || !identity()) throw Object.assign(new Error('请先登录，拍好的照片会保留。'), { statusCode: 401 })
  let session = readSession(sessionId)
  if (!session) throw new Error('练习已结束，请重新打开。')
  const question = session.questions.find(q => q.id === questionId)
  const answer = session.answers[questionId]
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
  generatePractice, createSession, saveSession, readSession, needsSignIn, recentSession, questionView, attachPhoto, markQuestion, verifiedResult }
