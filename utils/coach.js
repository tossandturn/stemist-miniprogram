const { askCoach, askIeltsCoach } = require('./api')

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
  if(/timeout|timed out|abort|超时/i.test(text))return 'AI 请求超时，当前内容已保留，请直接重试。'
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

async function runCoach({ message = '', context = {}, imageDataUrls = [], history = [], onStage = null } = {}) {
  const cleanMessage = String(message || '').trim()
  const images = Array.isArray(imageDataUrls) ? imageDataUrls.filter(Boolean) : []
  if (!cleanMessage && !images.length) throw new Error('请先输入内容或提供照片证据')
  const normalizedContext = normalizeCoachContext(context)
  const isIelts = String(normalizedContext.product || '').toLowerCase() === 'ieltsist'
  const stage=value=>{if(typeof onStage==='function')try{onStage(value)}catch{}}
  stage('calling')
  const result = isIelts
    ? await askIeltsCoach({ message: cleanMessage, context: normalizedContext, imageDataUrls: images,history,onStage:stage })
    : await askCoach({ message: cleanMessage, context: normalizedContext, imageDataUrls: images,history,onStage:stage })
  stage('arranging')
  const state=coachState(result)
  const photoFailed=images.length>0&&(String(result.mode||'').toLowerCase()==='offline'||['error','not_configured'].includes(String(result.providerStatus||'').toLowerCase()))
  return { ...result, answer: photoFailed?'这次图片答疑尚未完成，图片和补充说明已保留，直接重试即可，无需重新拍照。':coachAnswer(result), coachState: state }
}

module.exports = { normalizeCoachContext, coachAnswer, coachState, safeCoachWarning, runCoach }
