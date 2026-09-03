const { requestJson } = require('./api')

async function signIn(username, password, mode = 'login') {
  const payload = await requestJson(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, { username, password })
  if (!payload.accessToken) throw new Error('登录响应缺少会话令牌，请联系管理员')
  wx.setStorageSync('stemistSessionToken', payload.accessToken)
  const returnedUser = payload.user || {}
  wx.setStorageSync('stemistUser', {
    id: payload.id || returnedUser.id || '',
    username: payload.username || returnedUser.username || username,
    roles: payload.roles || payload.workspaceRoles || [],
  })
  return payload
}

function currentUser() { return wx.getStorageSync('stemistUser') || null }

function signOut() {
  wx.removeStorageSync('stemistSessionToken')
  wx.removeStorageSync('stemistUser')
}

module.exports = { signIn, currentUser, signOut }
