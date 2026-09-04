const SUBMISSION_SCOPES = ['stem-photo', 'listening', 'reading', 'writing', 'coach-stem-photo', 'coach-listening', 'coach-reading', 'coach-writing']
const DRAFT_SCOPES = ['listening', 'reading', 'writing', 'coach']

function recordTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return numeric
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function readLocalSubmissions() {
  return SUBMISSION_SCOPES.map((scope) => wx.getStorageSync(`stemistSubmission:${scope}`)).filter((item) => item && typeof item === 'object')
}

function readLocalDraftCount() {
  return DRAFT_SCOPES.filter((scope) => Boolean(wx.getStorageSync(`stemistDraft:${scope}`))).length
}

function remoteLearningRecords(attempts = []) {
  if (!Array.isArray(attempts)) return []
  return attempts.map((item) => {
    const source = item && typeof item === 'object' ? item : {}
    const snapshot = source.attempt && typeof source.attempt === 'object' ? source.attempt : {}
    const routeId = String(source.routeId || snapshot.routeId || '').trim()
    const stage = String(source.stage || snapshot.stage || '').trim()
    const attemptId = String(source.attemptId || snapshot.attemptId || '').trim()
    const submittedAt = source.submittedAt || snapshot.submittedAt || source.updatedAt || source.createdAt || ''
    const markingMode = String(snapshot.markingMode || '').toLowerCase()
    return {
      source: 'account',
      attemptId,
      skill: source.mode === 'full-paper' ? 'STEM full paper' : 'STEM topic practice',
      routeId,
      stage,
      subjectCode: String(snapshot.subjectCode || '').trim(),
      subject: String(snapshot.subject || '').trim(),
      coachMode: markingMode.includes('ai') ? 'ai' : 'server',
      providerStatus: '',
      submittedAt,
      timestamp: recordTimestamp(submittedAt),
    }
  }).filter((item) => item.attemptId || item.routeId || item.timestamp)
}

function mergeLearningRecords(local = [], remote = []) {
  const merged = []
  const seen = new Set()
  const add = (item, prefix) => {
    if (!item || typeof item !== 'object') return
    const timestamp = recordTimestamp(item.timestamp || item.submittedAt || item.updatedAt)
    const key = String(item.attemptId || `${prefix}:${item.skill || ''}:${item.routeId || ''}:${timestamp}`)
    if (seen.has(key)) return
    seen.add(key)
    merged.push({ ...item, timestamp })
  }
  ;(Array.isArray(local) ? local : []).forEach((item) => add(item, 'local'))
  ;(Array.isArray(remote) ? remote : []).forEach((item) => add(item, 'remote'))
  return merged.sort((left, right) => right.timestamp - left.timestamp)
}

function localLearningSummary(now = Date.now()) {
  const submissions = readLocalSubmissions().sort((left, right) => Number(right.submittedAt || 0) - Number(left.submittedAt || 0))
  const weekStart = Number(now) - 7 * 24 * 60 * 60 * 1000
  return {
    submissions,
    recentActivity: submissions[0] || null,
    completedThisWeek: submissions.filter((item) => Number(item.submittedAt || 0) >= weekStart).length,
    draftCount: readLocalDraftCount(),
  }
}

module.exports = { DRAFT_SCOPES, SUBMISSION_SCOPES, localLearningSummary, mergeLearningRecords, readLocalDraftCount, readLocalSubmissions, recordTimestamp, remoteLearningRecords }
