import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'utils/api.js'), 'utf8')
const storage = { stemistSessionToken: 'short-lived-test-token' }
let requestOptions
let response = { statusCode: 200, data: { ok: true } }
const wx = {
  getStorageSync: (key) => storage[key],
  removeStorageSync: (key) => { delete storage[key] },
  request: (options) => { requestOptions = options; options.success(response) },
}
const module = { exports: {} }
let sessionCleanupOptions
const fakeRequire = (name) => name === './session' ? { clearLocalSession: (options) => {
  sessionCleanupOptions = options
  delete storage.stemistSessionToken
  delete storage.stemistUser
} } : name === './apiOrigin' ? { DEFAULT_API_BASE: 'https://stem.ieltsist.com', DEFAULT_IELTS_API_BASE: 'https://ieltsist.com', safeApiBase: (value) => String(value || '').replace(/\/+$/, '') === 'https://stem.ieltsist.com' ? 'https://stem.ieltsist.com' : '', safeIeltsApiBase: (value) => String(value || '').replace(/\/+$/, '') === 'https://ieltsist.com' ? 'https://ieltsist.com' : '' } : (() => { throw new Error(`unexpected module ${name}`) })()
vm.runInNewContext(source, {
  module,
  exports: module.exports,
  wx,
  require: fakeRequire,
  getApp: () => ({ globalData: { apiBaseUrl: 'https://stem.ieltsist.com', ieltsApiBaseUrl: 'https://ieltsist.com' } }),
  Promise,
  String,
  Number,
  RegExp,
  Error,
  Object,
})

const { askCoach, askIeltsCoach, getJson, isAuthError, requestJson } = module.exports
assert.deepEqual(await getJson('/api/stem/routes/demo/syllabus-topics'), { ok: true })
assert.equal(requestOptions.method, 'GET')
assert.equal(requestOptions.data, undefined)
assert.equal(requestOptions.header.Authorization, 'Bearer short-lived-test-token')
assert.equal(requestOptions.header['Content-Type'], undefined)

response = { statusCode: 200, data: { ok: true } }
await askCoach({ message: 'text', context: {}, imageDataUrls: [] })
assert.equal(requestOptions.timeout, 55000)
await askCoach({ message: 'photo', context: {}, imageDataUrls: ['data:image/jpeg;base64,ZmFrZQ=='] })
assert.equal(requestOptions.timeout, 60000)

response = { statusCode: 200, data: { mode: 'ai', answer: 'IELTS feedback' } }
await askIeltsCoach({ message: 'check my reading answer', context: { product: 'IELTSist', skill: 'reading' } })
assert.equal(requestOptions.url, 'https://ieltsist.com/api/help/chat')
assert.equal(requestOptions.data.helpContext.product, 'IELTSist')
assert.equal(requestOptions.data.history.length, 0)
assert.equal(requestOptions.timeout, 55000)

response = { statusCode: 401, data: { error: 'expired' } }
const authError = await requestJson('/api/ai/coach', { message: 'x' }).catch((error) => error)
assert.match(authError.message, /登录已过期/)
assert.equal(authError.statusCode, 401)
assert.equal(authError.code, 'auth_required')
assert.equal(isAuthError(authError), true)
assert.equal(storage.stemistSessionToken, undefined)
assert.equal(sessionCleanupOptions.preserveDrafts, true)
console.log('Mini Program API client contract passed.')
