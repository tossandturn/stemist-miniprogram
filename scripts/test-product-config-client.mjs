import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime, settle } from './helpers/mini-runtime.mjs'

const plain = value => JSON.parse(JSON.stringify(value))
const clone = value => plain(value)
const fixture = plain(miniRuntime().load('utils/productConfigDefaults').DEFAULT_PRODUCT_CONFIG)

function configured(extra = {}) {
  const value = clone(fixture)
  Object.assign(value, extra)
  return value
}

function clientRuntime({ request, envVersion = 'release' } = {}) {
  const app = { globalData: { apiBaseUrl: 'https://stem.ieltsist.com' } }
  return miniRuntime({
    globals: { getApp: () => app },
    wx: {
      getAccountInfoSync: () => ({ miniProgram: { envVersion } }),
      request: request || (options => options.fail?.({ errMsg: 'request:fail timeout' })),
    },
  })
}

{
  const runtime = clientRuntime()
  const client = runtime.load('utils/productConfig')
  const defaults = runtime.load('utils/productConfigDefaults')
  const normalized = client.validateProductConfig(clone(fixture))
  assert.deepEqual(plain(normalized), fixture, 'the mechanically exported defaults must be accepted without drift')
  assert.deepEqual(plain(defaults.DEFAULT_PRODUCT_CONFIG), fixture, 'the bundled fallback must exactly match the mechanical export')
  const nativeRuntime=miniRuntime(),homeDefinition=nativeRuntime.load('pages/index/index'),coachDefinition=nativeRuntime.load('bundles/coach/index'),tavernDefinition=nativeRuntime.load('bundles/coach/tavernPresets')
  assert.equal(fixture.home.heading,homeDefinition.data.homeHeading)
  assert.deepEqual(fixture.home.entries,plain(homeDefinition.data.entryPoints.map(({id,title,detail,tone})=>({id,title,detail,tone}))))
  assert.deepEqual(fixture.home.secondary,plain(homeDefinition.data.secondaryLinks))
  assert.deepEqual(fixture.coach.modes,plain(coachDefinition.data.modes))
  assert.deepEqual(fixture.tavern.categories,plain(tavernDefinition.TAVERN_CATEGORIES.map(({id,label})=>({id,label}))))
  assert.deepEqual(fixture.tavern.presets,plain(tavernDefinition.TAVERN_PRESETS.map(({id,name,tag,detail,greeting,placeholder,starters,category,icon})=>({id,name,tag,detail,greeting,placeholder,starters,category,icon}))))
  assert.equal(client.productConfigChannel(), 'release')

  for (const envVersion of ['develop', 'trial']) {
    assert.equal(clientRuntime({ envVersion }).load('utils/productConfig').productConfigChannel(), envVersion)
  }
  assert.equal(clientRuntime({ envVersion: 'unexpected' }).load('utils/productConfig').productConfigChannel(), 'release')

  const unknownEnvelope = configured({ surprise: true })
  assert.throws(() => client.validateProductConfig(unknownEnvelope), /unknown|未知|schema/i)
  assert.throws(() => client.validateProductConfig(configured({ schemaVersion: 'stemist-product-config-v2' })), /schema|版本/i)
  assert.throws(() => client.validateProductConfig(configured({ minCapabilityVersion: 2 })), /capability|能力/i)
  assert.throws(() => client.validateProductConfig(configured({ revision: 'Foundation V1' })), /revision|版本/i)
  assert.throws(() => client.validateProductConfig(configured({ revision: 'none' })), /revision|版本/i)
  assert.throws(() => client.validateProductConfig(configured({ publishedAt: '2026-02-30T12:00:00+08:00' })), /publishedAt|ISO/i)

  const whitespace = clone(fixture)
  whitespace.home.heading = ' 今天想学什么？'
  assert.throws(() => client.validateProductConfig(whitespace), /trim/i)

  const surrogate = clone(fixture)
  surrogate.home.heading = `今天${String.fromCharCode(0xd800)}学什么`
  assert.throws(() => client.validateProductConfig(surrogate), /surrogate/i)

  const duplicate = clone(fixture)
  duplicate.home.entries[1].id = duplicate.home.entries[0].id
  assert.throws(() => client.validateProductConfig(duplicate), /duplicate|重复/i)

  const control = clone(fixture)
  control.home.heading = '今天\u0000学什么'
  assert.throws(() => client.validateProductConfig(control), /control|控制/i)

  for (const mutate of [
    value => { value.home.entries[0].detail = '' },
    value => { value.coach.modes[0].detail = '' },
    value => { value.tavern.presets[0].detail = '' },
    value => { value.tavern.presets[0].placeholder = '' },
  ]) {
    const value = clone(fixture); mutate(value)
    assert.throws(() => client.validateProductConfig(value), /length|invalid/i)
  }

  const businessInjection = clone(fixture)
  businessInjection.tavern.presets[6].divinationKind = 'remote-override'
  assert.throws(() => client.validateProductConfig(businessInjection), /unknown|未知/i)

  const missingScreen = clone(fixture)
  missingScreen.home.secondary.push({ id: 'remote-news', label: '今日消息', action: { kind: 'screen', target: 'not-published' } })
  assert.throws(() => client.validateProductConfig(missingScreen), /screen|页面|target/i)

  const oversized = clone(fixture)
  oversized.pages = Array.from({ length: 16 }, (_, pageIndex) => ({
    id: `large-${pageIndex}`,
    title: `大页面 ${pageIndex}`,
    sections: Array.from({ length: 20 }, (_, sectionIndex) => ({ id: `section-${sectionIndex}`, type: 'text', title: '', text: '界'.repeat(4000) })),
  }))
  assert.throws(() => client.validateProductConfig(oversized), /128|bytes|过大/i)

  const tooManyPageItems = clone(fixture)
  tooManyPageItems.pages = [{
    id: 'item-budget', title: '条目预算', sections: [
      ...Array.from({ length: 3 }, (_, sectionIndex) => ({ id: `links-${sectionIndex}`, type: 'links', title: '', items: Array.from({ length: 30 }, (_, itemIndex) => ({ id: `item-${itemIndex}`, label: '本地入口', detail: '', action: { kind: 'page', target: 'coach' } })) })),
      ...Array.from({ length: 17 }, (_, sectionIndex) => ({ id: `text-${sectionIndex}`, type: 'text', title: '', text: '内容' })),
    ],
  }]
  assert.throws(() => client.validateProductConfig(tooManyPageItems), /100|total|items/i)

  const emptyNotice = clone(fixture)
  emptyNotice.pages = [{ id: 'empty-notice', title: '提醒', sections: [{ id: 'notice', type: 'notice', title: '', text: '', tone: 'info' }] }]
  assert.throws(() => client.validateProductConfig(emptyNotice), /length|invalid/i)

  const unsafeUrls = [
    'http://example.com/path',
    'https://user@example.com/path',
    'https://example.com:443/path',
    'https://example.com/path?query=1',
    'https://example.com/path#fragment',
    'https://127.0.0.1/path',
    'https://localhost/path',
    'https://example.com/a/../b',
    'https://example.com/a/%2e%2e/b',
    'https://example.com/a%00b',
    'https://Example.com/path',
    'https://service.test/path',
    'https://service.example/path',
    'https://example.com/a\\b',
    'https://example.com/white space',
  ]
  let recursivelyEncoded = '../'
  for (let index = 0; index < 9; index++) recursivelyEncoded = encodeURIComponent(recursivelyEncoded)
  unsafeUrls.push(`https://example.com/${recursivelyEncoded}`)
  for (const url of unsafeUrls) {
    const value = clone(fixture)
    value.home.secondary.push({ id: 'copy-link', label: '复制链接', action: { kind: 'copy', url } })
    assert.throws(() => client.validateProductConfig(value), /url|链接|https|copy/i, url)
  }

  const unsafeAction = clone(fixture)
  unsafeAction.home.secondary.push({ id: 'remote-open', label: '打开远端', action: { kind: 'navigate', target: 'https://example.com' } })
  assert.throws(() => client.validateProductConfig(unsafeAction), /action|动作|kind/i)

  const safe = clone(fixture)
  safe.pages.push({
    id: 'daily-note',
    title: '今日说明',
    sections: [
      { id: 'intro', type: 'text', title: '', text: '这是一段公开说明。' },
      { id: 'warning', type: 'notice', title: '提醒', text: '以页面内说明为准。', tone: 'warning' },
      { id: 'links', type: 'links', title: '相关入口', items: [
        { id: 'home', label: 'A-Level', detail: '', action: { kind: 'page', target: 'alevel' } },
        { id: 'copy', label: '复制官网', detail: '请在浏览器中打开', action: { kind: 'copy', url: 'https://example.com/public%20path' } },
      ] },
    ],
  })
  safe.home.secondary.push({ id: 'daily-note', label: '今日说明', action: { kind: 'screen', target: 'daily-note' } })
  const validated = client.validateProductConfig(safe)
  assert.equal(client.configuredPage(validated, 'daily-note').title, '今日说明')
  assert.deepEqual(plain(client.resolveProductAction(validated, { kind: 'page', target: 'alevel' })), { kind: 'navigate', url: '/pages/practice/index?category=alevel' })
  assert.deepEqual(plain(client.resolveProductAction(validated, { kind: 'screen', target: 'daily-note' })), { kind: 'navigate', url: '/bundles/configured/index?id=daily-note' })
  assert.deepEqual(plain(client.resolveProductAction(validated, { kind: 'copy', url: 'https://example.com/public%20path' })), { kind: 'copy', url: 'https://example.com/public%20path' })
  assert.equal(client.resolveProductAction(validated, { kind: 'screen', target: 'missing' }), null)
}

{
  const requests = []
  const runtime = clientRuntime({ request: options => requests.push(options) })
  const client = runtime.load('utils/productConfig')
  const first = client.loadProductConfig({ now: 10_000 })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://stem.ieltsist.com/api/product/config?channel=release&capability=1')
  assert.equal(requests[0].method, 'GET')
  assert.equal(requests[0].dataType, 'text')
  assert.equal(requests[0].responseType, 'text')
  assert.equal(requests[0].header.Authorization, undefined, 'the public request must not send session credentials')
  requests[0].success({ statusCode: 200, data: clone(fixture), header: { ETag: '"foundation-v1"' } })
  const firstResult = await first
  assert.equal(firstResult.source, 'network')
  assert.equal(firstResult.config.revision, 'foundation-v1')

  const second = client.loadProductConfig({ now: 11_000 })
  assert.equal(requests[1].header['If-None-Match'], '"foundation-v1"')
  requests[1].success({ statusCode: 304, data: '', header: { ETag: '"foundation-v1"' } })
  const secondResult = await second
  assert.equal(secondResult.source, 'not-modified')
  assert.equal(secondResult.config.revision, 'foundation-v1')
  const cached = runtime.storage.get(client.productConfigCacheKey('release'))
  assert.equal(cached.savedAt, 11_000, 'a confirming 304 refreshes the public last-good age')

  const timeout = client.loadProductConfig({ now: 12_000 })
  requests[2].fail({ errMsg: 'request:fail timeout' })
  const timeoutResult = await timeout
  assert.equal(timeoutResult.source, 'cache')
  assert.equal(timeoutResult.config.revision, 'foundation-v1')
  assert.equal(runtime.storage.get('stemistSessionToken'), undefined)
}

{
  const requests = []
  const runtime = clientRuntime({ request: options => requests.push(options) })
  const client = runtime.load('utils/productConfig')
  const pending = client.loadProductConfig({ now: 1 })
  requests[0].success({ statusCode: 200, data: `${JSON.stringify(fixture)}${' '.repeat(client.PRODUCT_CONFIG_MAX_BYTES)}`, header: {} })
  const result = await pending
  assert.equal(result.source, 'bundled')
  assert.equal(result.unavailable, true, 'an over-budget raw response must fail closed')
}

{
  const requests = []
  const runtime = clientRuntime({ request: options => requests.push(options) })
  const client = runtime.load('utils/productConfig')
  runtime.storage.set('stemistSessionToken', 'private-session-must-stay')
  runtime.storage.set('stemistDraft:fixture', { answer: 'draft-must-stay' })
  runtime.storage.set(client.productConfigCacheKey('release'), {
    schemaVersion: 'stemist-product-config-cache-v1',
    savedAt: 1,
    etag: '"expired"',
    config: clone(fixture),
  })
  const expired = client.loadProductConfig({ now: client.PRODUCT_CONFIG_CACHE_MAX_AGE_MS + 2 })
  requests[0].fail({ errMsg: 'request:fail timeout' })
  const expiredResult = await expired
  assert.equal(expiredResult.source, 'bundled')
  assert.equal(expiredResult.config.revision, fixture.revision)
  assert.equal(runtime.storage.get('stemistSessionToken'), 'private-session-must-stay')
  assert.deepEqual(runtime.storage.get('stemistDraft:fixture'), { answer: 'draft-must-stay' })

  runtime.storage.set(client.productConfigCacheKey('release'), { schemaVersion: 'wrong', savedAt: 99, config: { unsafe: true } })
  const corrupt = client.loadProductConfig({ now: 100 })
  requests[1].fail({ errMsg: 'request:fail timeout' })
  assert.equal((await corrupt).source, 'bundled')
}

{
  const requests = []
  const runtime = clientRuntime({ request: options => requests.push(options) })
  const client = runtime.load('utils/productConfig')
  const oldConfig = configured({ revision: 'slow-v1' })
  const newConfig = configured({ revision: 'fast-v2' })
  newConfig.home.heading = '新版本先到'
  const slow = client.loadProductConfig({ now: 1_000 })
  const fast = client.loadProductConfig({ now: 1_001 })
  requests[1].success({ statusCode: 200, data: newConfig, header: { etag: '"fast-v2"' } })
  assert.equal((await fast).config.revision, 'fast-v2')
  requests[0].success({ statusCode: 200, data: oldConfig, header: { etag: '"slow-v1"' } })
  const stale = await slow
  assert.equal(stale.stale, true)
  assert.equal(stale.config.revision, 'fast-v2', 'a late older response cannot overwrite newer accepted state')
  assert.equal(runtime.storage.get(client.productConfigCacheKey('release')).config.revision, 'fast-v2')
}

{
  const requests = []
  const runtime = clientRuntime({ request: options => requests.push(options) })
  const client = runtime.load('utils/productConfig')
  const initial = client.loadProductConfig({ now: 1 })
  requests[0].success({ statusCode: 200, data: clone(fixture), header: { etag: '"initial"' } })
  await initial
  const olderPending = client.loadProductConfig({ now: 2 })
  const expiringRequest = client.loadProductConfig({ now: client.PRODUCT_CONFIG_CACHE_MAX_AGE_MS + 2 })
  requests[2].fail({ errMsg: 'request:fail timeout' })
  assert.equal((await expiringRequest).source, 'bundled')
  requests[1].success({ statusCode: 200, data: configured({ revision: 'late-old' }), header: { etag: '"late-old"' } })
  const stale = await olderPending
  assert.equal(stale.stale, true)
  assert.equal(stale.source, 'bundled', 'a stale concurrent response cannot revive an active publication older than seven days')
  assert.equal(stale.config.revision, fixture.revision)
}

{
  const queue = []
  const runtime = clientRuntime({ request: options => queue.push(options) })
  const client = runtime.load('utils/productConfig')
  const v1 = configured({ revision: 'publication-v1' })
  const v2 = configured({ revision: 'publication-v2' })
  v2.home.heading = '后端更新后的标题'

  const p1 = client.loadProductConfig({ now: 1 })
  queue.shift().success({ statusCode: 200, data: v1, header: { etag: '"v1"' } })
  assert.equal((await p1).config.revision, 'publication-v1')
  const p2 = client.loadProductConfig({ now: 2 })
  queue.shift().success({ statusCode: 200, data: v2, header: { etag: '"v2"' } })
  assert.equal((await p2).config.home.heading, '后端更新后的标题')
  const rollback = client.loadProductConfig({ now: 3 })
  queue.shift().success({ statusCode: 200, data: v1, header: { etag: '"v1-again"' } })
  assert.equal((await rollback).config.revision, 'publication-v1', 'opaque revisions allow an explicit backend rollback on the same client')
}

{
  const runtime = clientRuntime()
  const client = runtime.load('utils/productConfig')
  const presets = runtime.load('bundles/coach/tavernPresets')
  const remote = clone(fixture)
  const eastern = remote.tavern.presets.find(item => item.id === 'eastern-oracle')
  eastern.name = '远端展示名'
  eastern.greeting = '远端开场白，但不能改变占卜业务字段。'
  remote.tavern.presets.push({
    id: 'night-reader',
    name: '夜读搭子',
    tag: '安静陪伴',
    detail: '只提供普通文字聊天。',
    greeting: '今晚想聊哪一页？',
    placeholder: '说说想聊的内容…',
    starters: ['陪我聊聊今天读到的内容'],
    category: 'companion',
    icon: 'keeper-tree-lantern.svg',
  })
  const valid = client.validateProductConfig(remote)
  const catalog = presets.configuredTavernCatalog(valid.tavern)
  const localEastern = presets.tavernPreset('eastern-oracle')
  const configuredEastern = presets.catalogPreset(catalog, 'eastern-oracle')
  assert.equal(configuredEastern.name, '远端展示名')
  assert.equal(configuredEastern.divinationKind, localEastern.divinationKind)
  assert.deepEqual(plain(configuredEastern.supportedSpreads), plain(localEastern.supportedSpreads))
  const extra = presets.catalogPreset(catalog, 'night-reader')
  assert.equal(extra.interactionKind, 'textchat')
  assert.equal(extra.divinationKind, undefined)
  assert.equal(extra.category, 'companion')
  assert.deepEqual(plain(catalog.presets.slice(0, 8).map(item => item.id)), remote.tavern.presets.slice(0, 8).map(item => item.id))
}

{
  const validationRuntime = clientRuntime()
  const client = validationRuntime.load('utils/productConfig')
  const remote = clone(fixture)
  remote.home.heading = '后端今日标题'
  remote.home.entries.reverse()
  remote.home.entries[0].title = '远端计算器标题'
  remote.home.secondary.push({ id: 'copy-guide', label: '复制公开指南', action: { kind: 'copy', url: 'https://example.com/guide' } })
  remote.coach.modes.reverse()
  remote.coach.modes[0].title = '远端酒馆标题'
  const valid = client.validateProductConfig(remote)
  const productConfig = {
    readProductConfigSnapshot: () => ({ config: fixture, source: 'bundled' }),
    loadProductConfig: async () => ({ config: valid, source: 'network', stale: false }),
    resolveProductAction: (config, action) => client.resolveProductAction(config, action),
  }
  const commonModules = {
    'utils/page': { deviceState: value => ({ ...value, deviceClass: 'device-phone', orientation: 'portrait', isTablet: false }), syncDevice() {} },
    'utils/productConfig': productConfig,
    'utils/share': { public: {}, onShareAppMessage: () => ({ title: 'share', path: '/bundles/coach/index' }) },
  }
  const copied = [], homeCalls = []
  const homeRuntime = miniRuntime({
    modules: {
      ...commonModules,
      'utils/api': { getJson: async () => ({ provider: null, coachEnabled: false }) },
      'utils/learningSummary': { localLearningSummary: () => ({ completedThisWeek: 0, draftCount: 0, submissions: [], recentActivity: null }) },
      'utils/wechatAuth': { ensureWeChatSession: async () => ({}) },
      'utils/announcements': { announcementViews: value => value, fetchAnnouncements: async () => ({ items: [] }), ownerId: () => 'guest' },
    },
    wx: {
      navigateTo: options => homeCalls.push(options),
      setClipboardData: options => { copied.push(options); options.success?.() },
      showToast() {},
    },
  })
  const home = homeRuntime.page('pages/index/index')
  await home.refreshProductConfig()
  assert.equal(home.data.homeHeading, '后端今日标题')
  assert.deepEqual(plain(home.data.entryPoints.map(item => item.id)), remote.home.entries.map(item => item.id))
  assert.equal(home.data.entryPoints[0].title, '远端计算器标题')
  home.openEntry({ currentTarget: { dataset: { entry: 'calculator' } } })
  assert.equal(homeCalls.at(-1).url, '/pages/calculator/index', 'remote metadata and order cannot replace the local primary action registry')
  home.openSecondary({ currentTarget: { dataset: { secondary: 'university-directory' } } })
  assert.equal(homeCalls.at(-1).url, '/bundles/curricula/universities')
  home.openSecondary({ currentTarget: { dataset: { secondary: 'copy-guide' } } })
  assert.equal(copied.at(-1).data, 'https://example.com/guide')

  const coachRuntime = miniRuntime({ modules: commonModules })
  const coach = coachRuntime.page('bundles/coach/index')
  coach.onLoad({ routeId: 'trusted-local-context' })
  await coach.refreshProductConfig()
  assert.deepEqual(plain(coach.data.modes.map(item => item.id)), remote.coach.modes.map(item => item.id))
  assert.equal(coach.data.modes[0].title, '远端酒馆标题')
  coach.openMode({ currentTarget: { dataset: { mode: 'pdf' } } })
  assert.equal(coachRuntime.calls.at(-1).url, '/bundles/marking/index')
}

{
  const validationRuntime = clientRuntime()
  const client = validationRuntime.load('utils/productConfig')
  const remote = clone(fixture)
  remote.tavern.presets.find(item => item.id === 'keeper').name = '远端树洞名'
  remote.tavern.presets.push({ id: 'night-reader', name: '夜读搭子', tag: '安静陪伴', detail: '普通文字聊天。', greeting: '今晚想聊哪一页？', placeholder: '说说想聊的内容…', starters: ['聊聊今天读到的内容'], category: 'companion', icon: 'keeper-tree-lantern.svg' })
  const v1 = client.validateProductConfig(remote)
  const v2 = client.validateProductConfig({ ...clone(remote), revision: 'tavern-v2', tavern: { ...clone(remote.tavern), presets: clone(remote.tavern.presets).map(item => item.id === 'keeper' ? { ...item, name: '后端更新树洞名' } : item) } })
  let active = v1
  const runtime = miniRuntime({
    modules: {
      'utils/productConfig': { readProductConfigSnapshot: () => ({ config: v1, source: 'cache' }), loadProductConfig: async () => ({ config: active, source: 'network', stale: false }) },
      'utils/api': { isAuthError: () => false, requestJson: async () => { throw new Error('unexpected request') } },
      'utils/coach': { coachHelpPolicy: () => ({ solutionDisabled: false }) },
    },
  })
  const tavern = runtime.page('bundles/coach/tavern')
  tavern.onLoad()
  assert.equal(tavern.data.personas.find(item => item.id === 'keeper').name, '远端树洞名')
  assert.equal(tavern.data.personas.find(item => item.id === 'night-reader').interactionKind, 'textchat')
  tavern.choosePersona({ currentTarget: { dataset: { persona: 'keeper' } } })
  tavern.onMessage({ detail: { value: '不能被配置刷新清掉的草稿' } })
  active = v2
  await tavern.refreshProductConfig()
  assert.equal(tavern.data.selected.name, '后端更新树洞名')
  assert.equal(tavern.data.message, '不能被配置刷新清掉的草稿')
  assert.equal(tavern.data.personas.find(item => item.id === 'eastern-oracle').divinationKind, 'hexagram')
  tavern.choosePersona({ currentTarget: { dataset: { persona: 'night-reader' } } })
  tavern.onMessage({ detail: { value: '回滚时也必须保留的新增角色草稿' } })
  active = client.validateProductConfig(configured({ revision: 'tavern-rollback' }))
  await tavern.refreshProductConfig()
  assert.equal(tavern.data.persona, 'night-reader')
  assert.equal(tavern.data.selected.id, 'night-reader', 'removing remote discovery metadata cannot switch an active conversation identity')
  assert.equal(tavern.data.message, '回滚时也必须保留的新增角色草稿')
  assert.equal(tavern.data.personas.some(item => item.id === 'night-reader'), false, 'rollback removes the extra preset from new discovery')
}

{
  const config = clone(fixture)
  config.pages.push({
    id: 'daily-note',
    title: '今日说明',
    sections: [
      { id: 'copy', type: 'links', title: '链接', items: [
        { id: 'native', label: '打开 Coach', detail: '', action: { kind: 'page', target: 'coach' } },
        { id: 'official', label: '复制官网', detail: '', action: { kind: 'copy', url: 'https://example.com/public' } },
      ] },
    ],
  })
  const calls = []
  const toasts = []
  let clipboard
  let activeConfig=config
  const productConfig = {
    readProductConfigSnapshot: () => ({ config, source: 'cache' }),
    loadProductConfig: async () => ({ config:activeConfig, source: 'network', stale: false }),
    configuredPage: (value, id) => value.pages.find(page => page.id === id) || null,
    resolveProductAction: (value, action) => action.kind === 'page'
      ? { kind: 'navigate', url: '/bundles/coach/index' }
      : action.kind === 'copy' ? { kind: 'copy', url: action.url } : null,
  }
  const runtime = miniRuntime({
    modules: { 'utils/productConfig': productConfig },
    wx: {
      navigateTo: options => calls.push(options),
      setClipboardData: options => { clipboard = options },
      showToast: options => toasts.push(options),
    },
  })
  const page = runtime.page('bundles/configured/index')
  await page.onLoad({ id: 'daily-note', title: 'private option must be ignored' })
  assert.equal(page.data.title, '今日说明')
  assert.equal(page.data.state, 'ready')
  page.openLink({ currentTarget: { dataset: { section: 'copy', item: 'native' } } })
  assert.equal(calls.at(-1).url, '/bundles/coach/index')
  page.openLink({ currentTarget: { dataset: { section: 'copy', item: 'official' } } })
  assert.equal(clipboard.data, 'https://example.com/public')
  assert.equal(toasts.length, 0, 'copy success is never claimed before the platform success callback')
  clipboard.success()
  assert.equal(toasts.at(-1).title, '链接已复制')
  page.data.title = 'private mutable title must not be shared'
  const safeShare=page.onShareAppMessage()
  assert.equal(safeShare.path, '/bundles/configured/index?id=daily-note')
  assert.equal(safeShare.title, 'STEMist · 今日说明')
  const v2=clone(config);v2.revision='screen-v2';v2.pages[0].title='后端更新后的今日说明';activeConfig=v2
  await page.retry();assert.equal(page.data.title,'后端更新后的今日说明')
  activeConfig=config
  await page.retry();assert.equal(page.data.title,'今日说明','the same installed generic screen must visibly restore a rolled-back publication')

  const unknown = runtime.page('bundles/configured/index')
  await unknown.onLoad({ id: 'missing' })
  assert.equal(unknown.data.state, 'unknown')
  assert.match(unknown.data.error, /不可用|不存在/)
  unknown.data.title='private unknown-screen title'
  assert.deepEqual(plain(unknown.onShareAppMessage()),{title:'STEMist',path:'/pages/index/index',imageUrl:'/design-system/share-card.png'})

  const offlineRuntime = miniRuntime({
    modules: { 'utils/productConfig': {
      readProductConfigSnapshot: () => ({ config: fixture, source: 'bundled' }),
      loadProductConfig: async () => ({ config: fixture, source: 'bundled', unavailable: true }),
      configuredPage: (value, id) => value.pages.find(page => page.id === id) || null,
      resolveProductAction: () => null,
    } },
  })
  const offline = offlineRuntime.page('bundles/configured/index')
  await offline.onLoad({ id: 'not-cached-yet' })
  assert.equal(offline.data.state, 'error')
  assert.match(offline.data.error, /网络|重试/)

  const template = fs.readFileSync(new URL('../bundles/configured/index.wxml', import.meta.url), 'utf8')
  assert.match(template, /wx:for="{{sections}}"[^>]*wx:for-item="section"/)
  assert.match(template, /section\.type === 'text'/)
  assert.match(template, /section\.type === 'notice'/)
  assert.match(template, /section\.type === 'links'/)
  assert.doesNotMatch(template, /web-view|rich-text|bindtap="[^\"]*(?:eval|execute|download)/i)
}

await settle()
console.log('product config client tests passed')
