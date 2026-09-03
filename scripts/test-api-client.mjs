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
} } : (() => { throw new Error(`unexpected module ${name}`) })()
vm.runInNewContext(source, {
  module,
  exports: module.exports,
  wx,
  require: fakeRequire,
  getApp: () => ({ globalData: { apiBaseUrl: 'https://stem.ieltsist.com' } }),
  Promise,
  String,
  Number,
  RegExp,
  Error,
  Object,
})

const { askCoach, getJson, requestJson } = module.exports
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

response = { statusCode: 401, data: { error: 'expired' } }
await assert.rejects(() => requestJson('/api/ai/coach', { message: 'x' }), /登录已过期/)
assert.equal(storage.stemistSessionToken, undefined)
assert.equal(sessionCleanupOptions.preserveDrafts, true)
console.log('Mini Program API client contract passed.')
