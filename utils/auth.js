const { requestJson } = require('./api')
const { clearLocalSession } = require('./session')

async function signIn(username, password, mode = 'login') {
  const normalizedUsername = String(username || '').trim().toLowerCase()
  const payload = await requestJson(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, { username: normalizedUsername, password })
  if (!payload.accessToken) throw new Error('登录响应缺少会话令牌，请联系管理员')
  wx.setStorageSync('stemistSessionToken', payload.accessToken)
  const returnedUser = payload.user || payload.identity || {}
  wx.setStorageSync('stemistUser', {
    id: payload.id || returnedUser.id || '',
    username: payload.username || returnedUser.username || normalizedUsername,
    roles: payload.roles || payload.workspaceRoles || returnedUser.roles || returnedUser.workspaceRoles || [],
  })
  return payload
}

function currentUser() { return wx.getStorageSync('stemistUser') || null }

function signOut() {
  const hasToken = Boolean(wx.getStorageSync('stemistSessionToken'))
  const remoteLogout = hasToken
    ? requestJson('/api/auth/logout', {}, { timeout: 5000 }).catch(() => ({ offline: true }))
    : Promise.resolve({ skipped: 'not_authenticated' })
  clearLocalSession()
  return remoteLogout
}

module.exports = { signIn, currentUser, signOut }
