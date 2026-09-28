const { requestJson } = require('./api')
const { clearLocalSession,adoptOwner } = require('./session')
const {rememberNativeSession}=require('./nativeSession')
const {authGuard}=require('./authGuard')

async function signIn(username, password, mode = 'login') {
const normalizedUsername = String(username || '').trim().toLowerCase()
const check=authGuard()
const oldCookie=String(wx.getStorageSync('stemistNativeSessionCookie')||'')
const payload=await requestJson(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, { username: normalizedUsername, password }, {stemAuth:false,authCheck:check})
const verified=check(payload)
const returnedUser = payload.user || payload.identity || {}
const cookie=String(wx.getStorageSync('stemistNativeSessionCookie')||'')
adoptOwner(verified.owner,cookie!==oldCookie?cookie:'')
wx.setStorageSync('stemistSessionToken',verified.token)
wx.setStorageSync('stemistUser', {
id: verified.owner,
username: payload.username || returnedUser.username || normalizedUsername,
displayName: returnedUser.displayName || '',
avatarDataUrl: returnedUser.avatarDataUrl || '',
roles: payload.roles || payload.workspaceRoles || returnedUser.roles || returnedUser.workspaceRoles || [],
})
rememberNativeSession(payload,'password')
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
