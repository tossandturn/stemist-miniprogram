import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

let pageConfig
let handoffCalls = 0
const handoffTargets = []
const source = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'pages/webview/index.js'), 'utf8')
vm.runInNewContext(source, {
  Page: (config) => { pageConfig = config },
  require: (name) => name === '../../utils/page'
    ? { deviceState: (value) => value, syncDevice: () => {} }
    : { requestJson: async (_url, payload) => { handoffCalls += 1; handoffTargets.push(payload.target); return { url: payload.target === 'ielts' ? 'https://ieltsist.com/api/auth/stem-handoff/consume?code=one-time' : 'https://stem.ieltsist.com/api/auth/webview-handoff/consume?code=one-time' } } },
  wx: { navigateBack: () => {}, getStorageSync: (key) => key === 'stemistSessionToken' ? 'token' : '' },
  String,
  Array,
  decodeURIComponent,
  encodeURIComponent,
  URL,
  Promise,
})

async function load(url) {
  const page = { data: { ...pageConfig.data }, setData(update) { Object.assign(this.data, update) } }
  Object.assign(page, pageConfig)
  pageConfig.onLoad.call(page, { url: encodeURIComponent(url) })
  await new Promise((resolve) => setTimeout(resolve, 0))
  return page.data
}

assert.match((await load('https://stem.ieltsist.com/papers?subject=9702')).url, /webview-handoff\/consume/)
assert.equal(handoffCalls, 1)
assert.match((await load('https://ieltsist.com/?module=speaking')).url, /stem-handoff\/consume/)
assert.equal(handoffCalls, 2)
assert.deepEqual(handoffTargets, ['stem', 'ielts'])
assert.equal((await load('http://stem.ieltsist.com/')).url, '')
assert.equal((await load('https://evil.example/')).url, '')
assert.equal((await load('https://stem.ieltsist.com.evil.example/')).url, '')
assert.equal((await load('https://user@stem.ieltsist.com/')).url, '')
console.log('Mini-program WebView allowlist contract passed.')
