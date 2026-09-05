import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'utils', 'session.js'), 'utf8')
const values = {
  stemistSessionToken: 'token', stemistUser: { id: 'ielts:1' }, stemistDraft: true,
  'stemistDraft:listening': { text: 'private' }, 'stemistSubmission:writing': { text: 'private' }, stemistCroppedImage: '/tmp/private.jpg', stemistCoachContext: { routeId: 'private' }, stemistWritingPhoto: '/tmp/private.jpg', stemistCropReturn: { route: 'stem' },
  'stemistNotebook:cie-9702-as-physics': { body: 'private notebook' }, stemistPendingAttemptSync: { routeId: 'private' },
}
const wx = { removeStorageSync: (key) => { delete values[key] }, getStorageInfoSync: () => ({ keys: Object.keys(values) }) }
const module = { exports: {} }
let pendingClears=0
vm.runInNewContext(source, { module, exports: module.exports, wx, String, Array, Object, require: (name) => { assert.equal(name,'./page'); return { discardPendingDrafts: () => { pendingClears++ } } } })

const preservedValues = {
  stemistSessionToken: 'expired-token',
  stemistUser: { id: 'ielts:1' },
  'stemistDraft:writing': { text: 'unfinished essay' },
  stemistCroppedImage: '/tmp/question.jpg',
  stemistCoachContext: { routeId: 'cie-9702-as-physics' },
  stemistWritingPhoto: '/tmp/writing.jpg',
  stemistPendingAttemptSync: { routeId: 'cie-9702-as-physics' },
  'stemistNotebook:cie-9702-as-physics': { body: 'private notebook' },
}
Object.assign(values, preservedValues)
module.exports.clearLocalSession({ preserveDrafts: true })
assert.equal(pendingClears,0)
assert.equal(values.stemistSessionToken, undefined)
assert.equal(values.stemistUser, undefined)
assert.deepEqual(values['stemistDraft:writing'], preservedValues['stemistDraft:writing'])
assert.equal(values.stemistCroppedImage, '/tmp/question.jpg')
assert.deepEqual(values.stemistCoachContext, preservedValues.stemistCoachContext)
assert.equal(values.stemistWritingPhoto, '/tmp/writing.jpg')
assert.deepEqual(values.stemistPendingAttemptSync, preservedValues.stemistPendingAttemptSync)
assert.deepEqual(values['stemistNotebook:cie-9702-as-physics'], preservedValues['stemistNotebook:cie-9702-as-physics'])

module.exports.clearLocalSession()
assert.equal(pendingClears,1)
assert.equal(values.stemistSessionToken, undefined)
assert.equal(values.stemistUser, undefined)
assert.equal(values['stemistDraft:listening'], undefined)
assert.equal(values['stemistSubmission:writing'], undefined)
assert.equal(values.stemistCroppedImage, undefined)
assert.equal(values['stemistNotebook:cie-9702-as-physics'], undefined)
assert.equal(values.stemistPendingAttemptSync, undefined)
console.log('Session-local privacy cleanup passed.')
