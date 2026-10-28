const { requestJson } = require('./api')
const { clearLocalSession,adoptOwner } = require('./session')
const {rememberNativeSession}=require('./nativeSession')
const {authGuard}=require('./authGuard')

async function signIn(username, password, mode = 'login',control=null) {
const normalizedUsername = String(username || '').trim().toLowerCase()
control?.current()
const check=authGuard()
const oldCookie=String(wx.getStorageSync('stemistNativeSessionCookie')||'')
const guarded=payload=>{control?.current();return check(payload)}
const request=requestJson(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, { username: normalizedUsername, password }, {stemAuth:false,authCheck:guarded,isCancelled:()=>control?.isCancelled()===true,onTask:task=>control?.onTask(task)})
const payload=control?await Promise.race([request,control.cancelPromise]):await request
control?.current()
const verified=guarded(payload)
const returnedUser = payload.user || payload.identity || {}
const cookie=String(wx.getStorageSync('stemistNativeSessionCookie')||'')
control?.current()
adoptOwner(verified.owner,cookie!==oldCookie?cookie:'')
control?.current()
wx.setStorageSync('stemistSessionToken',verified.token)
control?.current()
wx.setStorageSync('stemistUser', {
id: verified.owner,
username: payload.username || returnedUser.username || normalizedUsername,
displayName: returnedUser.displayName || '',
avatarDataUrl: returnedUser.avatarDataUrl || '',
roles: payload.roles || payload.workspaceRoles || returnedUser.roles || returnedUser.workspaceRoles || [],
})
control?.current()
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
