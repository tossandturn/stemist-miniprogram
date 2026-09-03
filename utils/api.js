function baseUrl() {
  const app = getApp()
  return String((app && app.globalData && app.globalData.apiBaseUrl) || 'https://stem.ieltsist.com').replace(/\/+$/, '')
}

function requestJson(path, data, { timeout = 30000 } = {}) {
  const token = wx.getStorageSync('stemistSessionToken')
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl()}${path}`,
      method: 'POST',
      timeout,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(response) {
        const payload = response.data || {}
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(payload)
          return
        }
        reject(new Error(payload.error || payload.message || `请求失败（${response.statusCode}）`))
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络连接失败，请稍后重试'))
      },
    })
  })
}

function askCoach({ message, context = {}, imageDataUrls = [] }) {
  return requestJson('/api/ai/coach', { message, context, imageDataUrls })
}

module.exports = { askCoach, requestJson }
