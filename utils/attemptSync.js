const { requestJson } = require('./api')

function nextAttemptId() {
  return `mini-photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function syncStemPhotoAttempt({ context = {}, answer = '', coachMode = '', providerStatus = '', attemptId = '' } = {}) {
  if (!wx.getStorageSync('stemistSessionToken')) return { skipped: 'not_authenticated' }
  const routeId = String(context.routeId || '').trim()
  const stage = String(context.stage || '').trim()
  if (!routeId || !stage) return { skipped: 'route_context_missing' }
  const stableAttemptId = String(attemptId || '').trim() || nextAttemptId()
  const submittedAt = new Date().toISOString()
  const response = await requestJson('/api/stem/attempts', {
    attemptId: stableAttemptId,
    mode: 'topic',
    routeId,
    stage,
    submittedAt,
    attempt: {
      id: stableAttemptId,
      attemptStatus: 'submitted',
      markingMode: 'ai-coach-photo',
      submittedAt,
      notes: {
        source: 'stemist-miniprogram',
        coachMode: String(coachMode || ''),
        providerStatus: String(providerStatus || ''),
        answer: String(answer || '').slice(0, 4000),
      },
      evidence: { kind: 'photo', count: 1 },
    },
  }, { timeout: 8000 })
  const persistedAttemptId = String(response && response.attempt && response.attempt.attemptId || '')
  if (persistedAttemptId !== stableAttemptId) throw new Error('云端未确认这次 STEM 学习记录')
  return { ...response, clientAttemptId: stableAttemptId }
}

module.exports = { nextAttemptId, syncStemPhotoAttempt }
