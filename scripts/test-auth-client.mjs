import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'utils', 'auth.js'), 'utf8')
const storage = {}
const module = { exports: {} }
const fakeRequire = (name) => {
  if (name === './api') return { requestJson: async (url) => url === '/api/auth/logout' ? { ok: true } : ({ accessToken: 'token', identity: { id: 'ielts:42', username: 'student-42', roles: ['student'] } }) }
  if (name === './session') return { clearLocalSession: () => { delete storage.stemistSessionToken; delete storage.stemistUser } }
  throw new Error(`unexpected module ${name}`)
}
const wx = {
  setStorageSync: (key, value) => { storage[key] = value },
  getStorageSync: (key) => storage[key],
  removeStorageSync: (key) => { delete storage[key] },
}
vm.runInNewContext(source, { module, exports: module.exports, require: fakeRequire, wx, Promise, String, Error, Object })
const { signIn, currentUser } = module.exports
await signIn('student-42', 'password', 'login')
assert.equal(storage.stemistSessionToken, 'token')
assert.deepEqual(JSON.parse(JSON.stringify(currentUser())), { id: 'ielts:42', username: 'student-42', roles: ['student'] })
await module.exports.signOut()
assert.equal(storage.stemistSessionToken, undefined)
console.log('Shared account identity parsing passed.')
