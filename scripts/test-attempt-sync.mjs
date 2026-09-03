import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'utils', 'attemptSync.js'), 'utf8')
const calls = []
const module = { exports: {} }
const fakeRequire = (name) => name === './api'
  ? { requestJson: async (url, payload, options) => { calls.push({ url, payload, options }); return { ok: true, attempt: { attemptId: payload.attemptId } } } }
  : (() => { throw new Error(`unexpected module ${name}`) })()
const storage = { stemistSessionToken: 'token' }
vm.runInNewContext(source, {
  module,
  exports: module.exports,
  require: fakeRequire,
  wx: { getStorageSync: (key) => storage[key] },
  Promise,
  String,
  Number,
  Boolean,
  Math,
  Date,
  Error,
  Object,
})

const { syncStemPhotoAttempt } = module.exports
const result = await syncStemPhotoAttempt({
  context: { routeId: 'cie-9702-as-physics', stage: 'AS' },
  answer: 'first issue is unit conversion',
  coachMode: 'ai',
  providerStatus: 'connected',
})
assert.equal(result.ok, true)
assert.equal(calls[0].url, '/api/stem/attempts')
assert.equal(calls[0].payload.mode, 'topic')
assert.equal(calls[0].payload.routeId, 'cie-9702-as-physics')
assert.equal(calls[0].payload.attempt.evidence.kind, 'photo')
assert.equal(calls[0].payload.attempt.imageDataUrls, undefined)
assert.equal(calls[0].options.timeout, 8000)
assert.match(calls[0].payload.attemptId, /^mini-photo-/)

delete storage.stemistSessionToken
assert.deepEqual(JSON.parse(JSON.stringify(await syncStemPhotoAttempt({ context: { routeId: 'cie-9702-as-physics', stage: 'AS' }, answer: 'x' }))), { skipped: 'not_authenticated' })
console.log('STEM photo attempt sync contract passed.')
