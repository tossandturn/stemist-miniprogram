const { requestJson } = require('./api')

function nextAttemptId() {
  return `mini-photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function syncStemPhotoAttempt({ context = {}, answer = '', coachMode = '', providerStatus = '' } = {}) {
  if (!wx.getStorageSync('stemistSessionToken')) return { skipped: 'not_authenticated' }
  const routeId = String(context.routeId || '').trim()
  const stage = String(context.stage || '').trim()
  if (!routeId || !stage) return { skipped: 'route_context_missing' }
  const attemptId = nextAttemptId()
  const submittedAt = new Date().toISOString()
  return requestJson('/api/stem/attempts', {
    attemptId,
    mode: 'topic',
    routeId,
    stage,
    submittedAt,
    attempt: {
      id: attemptId,
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
}

module.exports = { nextAttemptId, syncStemPhotoAttempt }
