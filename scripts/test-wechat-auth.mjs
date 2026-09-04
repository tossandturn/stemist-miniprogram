import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const source = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'utils/wechatAuth.js'), 'utf8')
const storage = {}
let requestCount = 0
let requestPayload
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
    assert.equal(name, './api')
    return { requestJson: async (url, payload, options) => {
      requestCount += 1
      requestPayload = { url, payload, options }
      return { accessToken: 'short-lived-token', identity: { id: 'ielts:42', username: '微信用户', roles: ['student'] } }
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
const reused = await module.exports.ensureWeChatSession({ silent: false })
assert.equal(reused.reused, true)
assert.equal(requestCount, 1)
console.log('WeChat silent login exchange contract passed.')
