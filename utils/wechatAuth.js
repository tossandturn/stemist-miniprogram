const { requestJson } = require('./api')

let exchangeInFlight = null

function storedToken() {
  return String(wx.getStorageSync('stemistSessionToken') || '').trim()
}

function storeIdentity(payload = {}) {
  const token = String(payload.accessToken || payload.token || '').trim()
  if (!token) throw new Error('微信登录响应缺少会话令牌')
  const identity = payload.identity || payload.user || {}
  wx.setStorageSync('stemistSessionToken', token)
  wx.setStorageSync('stemistUser', {
    id: payload.id || identity.id || '',
    username: payload.username || identity.username || '微信用户',
    roles: payload.roles || payload.workspaceRoles || identity.roles || identity.workspaceRoles || [],
  })
  return wx.getStorageSync('stemistUser')
}

function wxLoginCode() {
  if (typeof wx.login !== 'function') return Promise.reject(Object.assign(new Error('当前运行环境不支持微信登录'), { code: 'wechat_login_unavailable' }))
  return new Promise((resolve, reject) => {
    wx.login({
      success: (result) => {
        const code = String(result && result.code || '').trim()
        if (code) resolve(code)
        else reject(Object.assign(new Error('微信登录没有返回有效凭证'), { code: 'wechat_code_missing' }))
      },
      fail: (error) => reject(Object.assign(new Error('微信登录暂时失败，请稍后重试'), { code: 'wechat_login_failed', detail: error && error.errMsg })),
    })
  })
}

async function exchangeCode(code) {
  const payload = await requestJson('/api/auth/wechat', { code }, { method: 'POST', timeout: 10000 })
  return { status: 'authenticated', user: storeIdentity(payload), payload }
}

async function ensureWeChatSession({ silent = true } = {}) {
  if (storedToken()) return { status: 'authenticated', user: wx.getStorageSync('stemistUser') || null, reused: true }
  if (exchangeInFlight) return exchangeInFlight
  exchangeInFlight = wxLoginCode()
    .then((code) => exchangeCode(code))
    .catch((error) => {
      if (silent) return { status: 'unavailable', error }
      throw error
    })
    .finally(() => { exchangeInFlight = null })
  return exchangeInFlight
}

module.exports = { ensureWeChatSession, exchangeCode, storedToken, storeIdentity, wxLoginCode }
