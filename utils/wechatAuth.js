const { requestJson } = require('./api')
const {rememberNativeSession,refreshNativeSession}=require('./nativeSession')
const {adoptOwner}=require('./session')
const {authGuard}=require('./authGuard')

let exchangeInFlight = null

function storedToken() {
return String(wx.getStorageSync('stemistSessionToken') || '').trim()
}

function storeIdentity(payload,verified) {
const identity = payload.identity || payload.user || {}
adoptOwner(verified.owner)
wx.setStorageSync('stemistSessionToken',verified.token)
wx.setStorageSync('stemistUser', {
id: verified.owner,
username: payload.username || identity.username || '微信用户',
displayName: identity.displayName || '',
avatarDataUrl: identity.avatarDataUrl || '',
roles: payload.roles || payload.workspaceRoles || identity.roles || identity.workspaceRoles || [],
})
rememberNativeSession(payload,'wechat')
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

function presentWeChatIdentityError(error) {
if (String(error && error.code || '') !== 'wechat_identity_conflict') return error
return Object.assign(new Error('微信主体信息正在更新，原有学习记录已保留。请稍后重试；如持续出现，请使用已有账号登录后联系管理员。'), {
statusCode: 409,
code: 'wechat_identity_conflict',
})
}

async function exchangeCode(code,check=authGuard()) {
check()
try {
const payload=await requestJson('/api/auth/wechat', { code }, { method: 'POST', timeout: 10000, stemAuth:false, authCheck:check })
const verified=check(payload)
return { status: 'authenticated', user: storeIdentity(payload,verified), payload }
} catch (error) {
throw presentWeChatIdentityError(error)
}
}

async function ensureWeChatSession({ silent = true } = {}) {
if (storedToken()) {
try{await refreshNativeSession();return { status: 'authenticated', user: wx.getStorageSync('stemistUser') || null, reused: true }}
catch(error){if(silent)return{status:'unavailable',error};throw error}
}
if (exchangeInFlight) return exchangeInFlight
const check=authGuard()
exchangeInFlight = wxLoginCode()
.then((code) => exchangeCode(code,check))
.catch((error) => {
if (silent) return { status: 'unavailable', error }
throw error
})
.finally(() => { exchangeInFlight = null })
return exchangeInFlight
}

module.exports = { ensureWeChatSession, exchangeCode, storedToken, storeIdentity, wxLoginCode }
