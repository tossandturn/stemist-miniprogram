import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'pages', 'stem', 'coach.js'), 'utf8')
const storage = {
  stemistCroppedImage: '/tmp/cropped.jpg',
  stemistCoachContext: { routeId: 'cie-9702-as-physics', stage: 'AS', subjectCode: '9702' },
  stemistSessionToken: 'token',
}
let pageConfig
let syncedPayload
let syncShouldFail = false
const fakeRequire = (name) => {
  if (name === '../../utils/image') return { readAsJpegDataUrl: async () => 'data:image/jpeg;base64,ZmFrZQ==' }
  if (name === '../../utils/coach') return { runCoach: async () => ({ mode: 'ai', providerStatus: 'connected', answer: 'feedback', coachState: { label: 'AI 已连接', warning: '' } }) }
  if (name === '../../utils/attemptSync') return { nextAttemptId: () => 'mini-photo-test', syncStemPhotoAttempt: async (payload) => { syncedPayload = payload; if (syncShouldFail) throw new Error('offline'); return { ok: true, clientAttemptId: payload.attemptId, attempt: { attemptId: payload.attemptId } } } }
  if (name === '../../utils/page') return { deviceState: (value) => value, syncDevice: () => {} }
  if (name === '../../utils/api') return { isAuthError: (error) => Number(error && error.statusCode) === 401 }
  throw new Error(`unexpected module ${name}`)
}
const wx = {
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value },
  removeStorageSync: (key) => { delete storage[key] },
  navigateBack: () => {},
  redirectTo: () => {},
}
vm.runInNewContext(source, {
  Page: (config) => { pageConfig = config },
  require: fakeRequire,
  wx,
  Promise,
  String,
  Number,
  Boolean,
  Object,
  Date,
  Math,
  Error,
  decodeURIComponent,
})

function createPage() {
  const instance = { data: JSON.parse(JSON.stringify(pageConfig.data)), setData(update) { Object.assign(this.data, update) } }
  Object.assign(instance, pageConfig)
  pageConfig.onLoad.call(instance, {})
  return instance
}

const page = createPage()
await page.ask.call(page)
assert.equal(page.data.answer, 'feedback')
assert.equal(page.data.coachStatus, 'AI 已连接')
assert.equal(page.data.syncStatus, '已同步到 STEM 学习记录')
assert.equal(syncedPayload.context.routeId, 'cie-9702-as-physics')

syncShouldFail = true
const failedPage = createPage()
await failedPage.ask.call(failedPage)
assert.match(failedPage.data.syncStatus, /同步失败/)
assert.match(failedPage.data.warning, /尚未写入云端/)
syncShouldFail = false
await failedPage.retrySync.call(failedPage)
assert.equal(failedPage.data.syncFailed, false)
assert.equal(failedPage.data.syncStatus, '已同步到 STEM 学习记录')
console.log('STEM Coach page sync/error states passed.')
