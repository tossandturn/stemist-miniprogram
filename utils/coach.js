const { askCoach } = require('./api')

function normalizeCoachContext(context = {}) {
  const source = context && typeof context === 'object' ? context : {}
  return {
    ...source,
    stage: String(source.stage || 'practice'),
    source: String(source.source || 'stemist-miniprogram'),
  }
}

function coachAnswer(result) {
  return String(result && (result.answer || result.message) || '').trim()
}

async function runCoach({ message = '', context = {}, imageDataUrls = [] } = {}) {
  const cleanMessage = String(message || '').trim()
  const images = Array.isArray(imageDataUrls) ? imageDataUrls.filter(Boolean) : []
  if (!cleanMessage && !images.length) throw new Error('请先输入内容或提供照片证据')
  const result = await askCoach({ message: cleanMessage, context: normalizeCoachContext(context), imageDataUrls: images })
  return { ...result, answer: coachAnswer(result) }
}

module.exports = { normalizeCoachContext, coachAnswer, runCoach }
