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

function safeCoachWarning(value, fallback = '') {
  const text = String(value || '').replace(/https?:\/\/\S+/gi, '[链接已隐藏]').trim()
  if (!text || /(?:api[_ -]?key|secret|authorization|bearer\s+|sk-[a-z0-9])/i.test(text)) return fallback
  return text.slice(0, 320)
}

function coachState(result = {}) {
  const mode = String(result.mode || '').toLowerCase()
  const providerStatus = String(result.providerStatus || '').toLowerCase()
  if (mode === 'ai' && providerStatus === 'connected') {
    return { label: 'AI 已连接', isConnected: true, isFallback: false, warning: '' }
  }
  if (mode === 'local' || providerStatus === 'skipped') {
    return {
      label: '本地提示',
      isConnected: false,
      isFallback: true,
      warning: safeCoachWarning(result.warning, '这是本地提示，未调用 AI，不是正式评分。'),
    }
  }
  if (mode === 'offline' || providerStatus === 'error' || providerStatus === 'not_configured') {
    return {
      label: 'AI 暂不可用',
      isConnected: false,
      isFallback: true,
      warning: safeCoachWarning(result.warning, 'AI 服务暂时不可用；当前内容是本地提示，不是正式评分。'),
    }
  }
  return { label: '反馈状态待确认', isConnected: false, isFallback: true, warning: '请确认反馈状态后再把结果当作学习依据。' }
}

async function runCoach({ message = '', context = {}, imageDataUrls = [] } = {}) {
  const cleanMessage = String(message || '').trim()
  const images = Array.isArray(imageDataUrls) ? imageDataUrls.filter(Boolean) : []
  if (!cleanMessage && !images.length) throw new Error('请先输入内容或提供照片证据')
  const result = await askCoach({ message: cleanMessage, context: normalizeCoachContext(context), imageDataUrls: images })
  return { ...result, answer: coachAnswer(result), coachState: coachState(result) }
}

module.exports = { normalizeCoachContext, coachAnswer, coachState, safeCoachWarning, runCoach }
