const { clearLocalSession } = require('./session')

function baseUrl() {
  const app = getApp()
  return String((app && app.globalData && app.globalData.apiBaseUrl) || 'https://stem.ieltsist.com').replace(/\/+$/, '')
}

function safeErrorMessage(payload, statusCode) {
  const message = String((payload && (payload.error || payload.message)) || '').trim()
  if (statusCode >= 500 || /stack|provider|api[ _-]?key|balance|https?:\/\//i.test(message)) return '服务暂时不可用，请稍后重试。'
  return message.slice(0, 240) || `请求失败（${statusCode}）`
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
          reject(new Error('登录已过期，请重新登录后再使用 AI'))
          return
        }
        reject(new Error(safeErrorMessage(payload, response.statusCode)))
      },
      fail(error) {
        const raw = String(error && error.errMsg || '')
        reject(new Error(/timeout|超时/i.test(raw) ? '请求超时，请检查网络后重试。' : '网络连接失败，请稍后重试'))
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
  return requestJson('/api/ai/coach', { message, context, imageDataUrls })
}

module.exports = { askCoach, getJson, requestJson, safeErrorMessage }
