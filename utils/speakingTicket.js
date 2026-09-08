const { requestIeltsLearning } = require('./ieltsLearning')

const PROTOCOL = 'ielts-realtime-ticket-v1'
const PURPOSE = 'qwen-speaking'

async function issueSpeakingTicket() {
  const result = await requestIeltsLearning('/api/speaking/realtime-ticket', {}, { method: 'POST', timeout: 8000 })
  const ticket = String(result && result.ticket || '').trim()
  const expiresAt = Date.parse(result && result.expiresAt)
  if (result && result.protocol === PROTOCOL
    && result.purpose === PURPOSE
    && /^[A-Za-z0-9_-]{32,128}$/.test(ticket)
    && Number.isFinite(expiresAt)
    && expiresAt > Date.now()) return ticket
  throw new Error('口语连接授权未完成，请重新登录后重试。')
}

module.exports = { issueSpeakingTicket }
