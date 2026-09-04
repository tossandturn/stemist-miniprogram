const DEFAULT_API_BASE = 'https://stem.ieltsist.com'
const DEFAULT_IELTS_API_BASE = 'https://ieltsist.com'

function safeApiBase(value) {
  const candidate = String(value || '').trim().replace(/\/+$/, '')
  if (/^https:\/\/stem\.ieltsist\.com$/i.test(candidate)) return candidate
  // Loopback is reserved for local developer-tool runs. A released client
  // must never accept an arbitrary host from storage.
  if (/^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(candidate)) return candidate
  return ''
}

function safeIeltsApiBase(value) {
  const candidate = String(value || '').trim().replace(/\/+$/, '')
  if (/^https:\/\/ieltsist\.com$/i.test(candidate)) return candidate
  if (/^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(candidate)) return candidate
  return ''
}

module.exports = { DEFAULT_API_BASE, DEFAULT_IELTS_API_BASE, safeApiBase, safeIeltsApiBase }
