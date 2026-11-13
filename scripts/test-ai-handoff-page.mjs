import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function commonJs(relative, modules = {}) {
  const cache = new Map()
  function load(name) {
    const normalized = name.replace(/\\/g, '/').replace(/\.js$/, '')
    if (Object.hasOwn(modules, normalized)) return modules[normalized]
    if (cache.has(normalized)) return cache.get(normalized)
    const filename = path.join(root, `${normalized}.js`)
    const module = { exports: {} }
    cache.set(normalized, module.exports)
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      module,
      exports: module.exports,
      require: request => load(path.posix.normalize(path.posix.join(path.posix.dirname(normalized), request))),
      URLSearchParams,
      decodeURIComponent,
      encodeURIComponent,
    }, { filename })
    cache.set(normalized, module.exports)
    return module.exports
  }
  return load(relative)
}

const handoff = commonJs('utils/agentHandoff')
const store = {}

assert.equal(handoff.cacheAgentHandoff(store, {
  pageId: 17,
  path: '/bundles/ai-entry/index',
  query: 'destinationId=cambridge-cie-9702-a2-physics-topics',
  payload: { status: 'ready', destinationId: 'cambridge-cie-9702-a2-physics-topics', token: 'must-not-cache' },
}), true)
assert.deepEqual(JSON.parse(JSON.stringify(store[17])), {
  path: '/bundles/ai-entry/index',
  query: 'destinationId=cambridge-cie-9702-a2-physics-topics',
  payload: { status: 'ready', destinationId: 'cambridge-cie-9702-a2-physics-topics' },
})
assert.equal(handoff.cacheAgentHandoff(store, {
  pageId: 17,
  path: '/bundles/ai-entry/index',
  query: 'destinationId=tools-calculator',
  payload: { status: 'ready', destinationId: 'tools-calculator' },
}), false, 'duplicate pageId must not overwrite the first valid handoff')
assert.equal(store[17].payload.destinationId, 'cambridge-cie-9702-a2-physics-topics')
assert.equal(handoff.cacheAgentHandoff(store, { pageId: 18, path: '/pages/account/auth', query: '', payload: {} }), false)
assert.equal(handoff.cacheAgentHandoff(store, { pageId: 19, path: '/bundles/ai-entry/index', query: 'destinationId=not-real', payload: { status: 'ready', destinationId: 'not-real' } }), false)
assert.equal(handoff.cacheAgentHandoff(store, { pageId: 20, path: '/bundles/ai-entry/index', query: 'destinationId=tools-calculator', payload: { status: 'ready', destinationId: 'tools-progress' } }), false)
assert.equal(Object.hasOwn(store, 18), false)
assert.equal(Object.hasOwn(store, 19), false)
assert.equal(Object.hasOwn(store, 20), false)

let handoffListener = null
let appDefinition = null
const appModules = {
  'utils/device': { readDeviceProfile: () => ({ deviceClass: 'device-phone' }) },
  'utils/apiOrigin': { DEFAULT_API_BASE: 'https://stem.ieltsist.com', DEFAULT_IELTS_API_BASE: 'https://ieltsist.com', safeApiBase: () => '', safeIeltsApiBase: () => '' },
  'utils/wechatAuth': { ensureWeChatSession: async () => ({ status: 'guest' }) },
  'utils/entryAccess': { wrapEntryPage: value => value, prepareEntry: async () => true, consentAccepted: () => true },
  'utils/agentHandoff': handoff,
}
const wxForApp = {
  getStorageSync: () => '',
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
  onAgentHandoff: listener => { handoffListener = listener },
}
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
vm.runInNewContext(appSource, {
  require: request => appModules[path.posix.normalize(request.replace(/^\.\//, ''))],
  Page: value => value,
  App: value => { appDefinition = value },
  wx: wxForApp,
  getCurrentPages: () => [],
})
appDefinition.globalData = JSON.parse(JSON.stringify(appDefinition.globalData))
await appDefinition.onLaunch.call(appDefinition)
assert.equal(typeof handoffListener, 'function')
handoffListener({ pageId: 21, path: '/bundles/ai-entry/index', query: 'destinationId=tools-calculator', payload: { status: 'ready', destinationId: 'tools-calculator', photo: 'private' } })
assert.deepEqual(JSON.parse(JSON.stringify(appDefinition.globalData.agentHandoffs[21].payload)), { status: 'ready', destinationId: 'tools-calculator' })

let pageDefinition = null
const navigations = []
const wxForPage = { navigateTo: options => { navigations.push(options.url); options.success?.() } }
const pageSource = fs.readFileSync(path.join(root, 'bundles/ai-entry/index.js'), 'utf8')
vm.runInNewContext(pageSource, {
  require: request => {
    const normalized = path.posix.normalize(path.posix.join('bundles/ai-entry', request)).replace(/^\.\//, '').replace(/\.js$/, '')
    if (normalized === 'utils/page') return { deviceState: value => ({ ...value, deviceClass: 'device-phone', orientation: 'portrait' }), syncDevice() {} }
    if (normalized === 'utils/share') return { public: { onShareAppMessage() { return { title: 'STEMist', path: '/pages/index/index', imageUrl: '/design-system/share-card.png' } }, onShareTimeline() { return { title: 'STEMist', query: '' } } } }
    if (normalized === 'utils/agentHandoff') return handoff
    if (normalized === 'bundles/ai-entry/registry.generated') return commonJs('bundles/ai-entry/registry.generated')
    throw new Error(`Unexpected page import ${normalized}`)
  },
  Page: value => { pageDefinition = value },
  wx: wxForPage,
  getApp: () => appDefinition,
  decodeURIComponent,
})
const page = {
  data: JSON.parse(JSON.stringify(pageDefinition.data)),
  getPageId: () => 21,
  setData(value, callback) { Object.assign(this.data, value); callback?.() },
}
for (const [name, value] of Object.entries(pageDefinition)) if (typeof value === 'function') page[name] = value.bind(page)
page.onLoad({ destinationId: 'tools-calculator' })
assert.equal(navigations.length, 0, 'page load must never auto-navigate')
assert.equal(page.data.state, 'ready')
assert.equal(page.data.destination.id, 'tools-calculator')
page.openDestination()
assert.deepEqual(navigations, ['/pages/calculator/index'])
assert.equal(Object.hasOwn(appDefinition.globalData.agentHandoffs, 21), false, 'handoff cache is consumed once')

const choicePage = {
  data: JSON.parse(JSON.stringify(pageDefinition.data)),
  getPageId: () => 22,
  setData(value, callback) { Object.assign(this.data, value); callback?.() },
}
for (const [name, value] of Object.entries(pageDefinition)) if (typeof value === 'function') choicePage[name] = value.bind(choicePage)
choicePage.onLoad({ courseSystem: 'cambridge', subjectCode: '9709', stage: 'AS', task: 'papers' })
assert.equal(choicePage.data.state, 'choose')
assert.equal(choicePage.data.choices.length, 3)
const routeChoiceCount = choicePage.data.choices.length
assert.equal(navigations.length, 1)
choicePage.chooseDestination({ currentTarget: { dataset: { destination: choicePage.data.choices[1].id } } })
assert.equal(choicePage.data.state, 'ready')
assert.equal(choicePage.data.destination.routeId, 'cie-9709-as-p1-p4')
assert.equal(navigations.length, 1)

const wxml = fs.readFileSync(path.join(root, 'bundles/ai-entry/index.wxml'), 'utf8')
const wxss = fs.readFileSync(path.join(root, 'bundles/ai-entry/index.wxss'), 'utf8')
assert.match(wxml, /aria-label=/)
assert.match(wxml, /role="(?:button|list|listitem|status|alert)"/)
assert.match(wxss, /min-height:\s*(?:44|4[8-9]|[5-9]\d)px/)
assert.doesNotMatch(wxml, /😀|🚀|📚|✨/u)

console.log(JSON.stringify({ status: 'passed', cachedFields: 2, routeChoices: routeChoiceCount, automaticNavigations: 0 }))
