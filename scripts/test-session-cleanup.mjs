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
}
const wx = { removeStorageSync: (key) => { delete values[key] } }
const module = { exports: {} }
vm.runInNewContext(source, { module, exports: module.exports, wx, String, Array, Object })
module.exports.clearLocalSession()
assert.equal(values.stemistSessionToken, undefined)
assert.equal(values.stemistUser, undefined)
assert.equal(values['stemistDraft:listening'], undefined)
assert.equal(values['stemistSubmission:writing'], undefined)
assert.equal(values.stemistCroppedImage, undefined)
console.log('Session-local privacy cleanup passed.')
