import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const source = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'utils/wechatAuth.js'), 'utf8')
const storage = {}
let requestCount = 0
let requestPayload
let requestFailure = null
const module = { exports: {} }
vm.runInNewContext(source, {
  module,
  exports: module.exports,
  Promise,
  String,
  Object,
  Error,
  wx: {
    login: ({ success }) => success({ code: 'wechat-one-time-code' }),
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value },
  },
  require(name) {
    if(name === './authGuard') return {authGuard:()=>payload=>payload?{owner:payload.id||payload.identity?.id||payload.user?.id,token:payload.accessToken||payload.token}:undefined}
    if(name === './nativeSession') return {rememberNativeSession(){},refreshNativeSession:async()=>{}}
    if(name === './session') return {adoptOwner(){}}
    assert.equal(name, './api')
    return { requestJson: async (url, payload, options) => {
      requestCount += 1
      requestPayload = { url, payload, options }
      if (requestFailure) throw requestFailure
      return { accessToken: 'short-lived-token', identity: { id: 'ielts:42', username: '微信用户', displayName:'微信昵称', avatarDataUrl:'data:image/png;base64,fixture', roles: ['student'] } }
    } }
  },
})

const [first, second] = await Promise.all([
  module.exports.ensureWeChatSession({ silent: false }),
  module.exports.ensureWeChatSession({ silent: false }),
])
assert.equal(requestCount, 1, 'concurrent WeChat login calls must share one exchange')
assert.equal(requestPayload.url, '/api/auth/wechat')
assert.equal(requestPayload.payload.code, 'wechat-one-time-code')
assert.equal(requestPayload.options.method, 'POST')
assert.equal(first.status, 'authenticated')
assert.equal(second.status, 'authenticated')
assert.equal(storage.stemistSessionToken, 'short-lived-token')
assert.equal(storage.stemistUser.id, 'ielts:42')
assert.equal(storage.stemistUser.displayName,'微信昵称')
assert.equal(storage.stemistUser.avatarDataUrl,'data:image/png;base64,fixture')
const reused = await module.exports.ensureWeChatSession({ silent: false })
assert.equal(reused.reused, true)
assert.equal(requestCount, 1)
delete storage.stemistSessionToken
requestFailure = Object.assign(new Error('This WeChat identity is linked to conflicting accounts.'), { statusCode: 409, code: 'wechat_identity_conflict' })
await assert.rejects(
  () => module.exports.ensureWeChatSession({ silent: false }),
  (error) => error.code === 'wechat_identity_conflict'
    && error.statusCode === 409
    && /微信账号关联需要确认/.test(error.message)
    && /原有学习记录已保留/.test(error.message),
  'an identity conflict during a subject change must present a safe recovery message',
)
console.log('WeChat silent login exchange contract passed.')
