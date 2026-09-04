const { clearLocalSession } = require('./session')
const { DEFAULT_API_BASE, safeApiBase } = require('./apiOrigin')

function baseUrl() {
  const app = getApp()
  return safeApiBase(app && app.globalData && app.globalData.apiBaseUrl) || DEFAULT_API_BASE
}

const COACH_TEXT_TIMEOUT_MS = 55_000
const COACH_IMAGE_TIMEOUT_MS = 60_000

function safeErrorMessage(payload, statusCode) {
  const message = String((payload && (payload.error || payload.message)) || '').trim()
  if (statusCode >= 500 || /stack|provider|api[ _-]?key|balance|https?:\/\//i.test(message)) return '服务暂时不可用，请稍后重试。'
  return message.slice(0, 240) || `请求失败（${statusCode}）`
}

function requestError(message, statusCode = 0, code = '') {
  const error = new Error(message)
  error.statusCode = Number(statusCode) || 0
  error.code = String(code || '')
  return error
}

function isAuthError(error) {
  return Number(error && error.statusCode) === 401 || String(error && error.code) === 'auth_required'
}

function requestJson(path, data, { timeout = 30000, method = 'POST' } = {}) {
  const token = wx.getStorageSync('stemistSessionToken')
  return new Promise((resolve, reject) => {
    const request = {
      url: `${baseUrl()}${path}`,
      method: String(method || 'POST').toUpperCase(),
      timeout,
      header: {
        ...(String(method || 'POST').toUpperCase() === 'GET' ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(response) {
        const payload = response.data || {}
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(payload)
          return
        }
        if (response.statusCode === 401) {
          // Keep an in-progress draft so the same learner can sign in again;
          // explicit logout still clears drafts and evidence completely.
          clearLocalSession({ preserveDrafts: true })
          reject(requestError('登录已过期，原始输入仍保留。请重新登录后再使用 AI。', 401, 'auth_required'))
          return
        }
        reject(requestError(safeErrorMessage(payload, response.statusCode), response.statusCode, payload && payload.code))
      },
      fail(error) {
        const raw = String(error && error.errMsg || '')
        reject(requestError(/timeout|超时/i.test(raw) ? '请求超时，请检查网络后重试。' : '网络连接失败，请稍后重试', 0, /timeout|超时/i.test(raw) ? 'network_timeout' : 'network_error'))
      },
    }
    if (data !== undefined && data !== null) request.data = data
    wx.request(request)
  })
}

function getJson(path, { timeout = 8000 } = {}) {
  return requestJson(path, undefined, { timeout, method: 'GET' })
}

function askCoach({ message, context = {}, imageDataUrls = [] }) {
  const images = Array.isArray(imageDataUrls) ? imageDataUrls : []
  return requestJson('/api/ai/coach', { message, context, imageDataUrls: images }, {
    timeout: images.length ? COACH_IMAGE_TIMEOUT_MS : COACH_TEXT_TIMEOUT_MS,
  })
}

module.exports = { COACH_IMAGE_TIMEOUT_MS, COACH_TEXT_TIMEOUT_MS, askCoach, getJson, isAuthError, requestError, requestJson, safeErrorMessage }
