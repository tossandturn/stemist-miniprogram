const { DEFAULT_PRODUCT_CONFIG } = require('./productConfigDefaults')
const { DEFAULT_API_BASE, safeApiBase } = require('./apiOrigin')

const PRODUCT_CONFIG_SCHEMA = 'stemist-product-config-v1'
const PRODUCT_CONFIG_CAPABILITY = 1
const PRODUCT_CONFIG_MAX_BYTES = 128 * 1024
const PRODUCT_CONFIG_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const PRODUCT_CONFIG_PATH = '/api/product/config'
const CACHE_SCHEMA = 'stemist-product-config-cache-v1'
const CACHE_PREFIX = 'stemistProductConfig:v1:'
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const REVISION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/
const CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f]/
const HOME_IDS = Object.freeze(['alevel', 'ap', 'ib', 'ielts', 'competition', 'calculator'])
const COACH_IDS = Object.freeze(['steps', 'answers', 'pdf', 'tavern'])
const CATEGORY_IDS = Object.freeze(['all', 'companion', 'story', 'fortune'])
const REQUIRED_TAVERN_IDS = Object.freeze(['keeper', 'study-buddy', 'cat-companion', 'story-traveler', 'xianxia-guide', 'mystery-guide', 'eastern-oracle', 'tarot-reader'])
const TAVERN_ICONS = Object.freeze(['keeper-tree-lantern.svg', 'study-buddy-banter.svg', 'cat-companion-face.svg', 'story-traveler-map.svg', 'xianxia-sword-bamboo.svg', 'mystery-tea-lens.svg', 'eastern-oracle-lots.svg', 'tarot-moon-cards.svg'])
const PAGE_TARGETS = Object.freeze({
  alevel: '/pages/practice/index?category=alevel',
  ap: '/bundles/curricula/index?board=ap',
  ib: '/bundles/curricula/index?board=ib',
  ielts: '/pages/practice/index?category=ielts',
  competition: '/pages/papers/index?category=competition',
  calculator: '/pages/calculator/index',
  coach: '/bundles/coach/index',
  announcements: '/bundles/announcements/index',
  'university-directory': '/bundles/curricula/universities',
})
const channelState = Object.create(null)

function configError(message) {
  const error = new Error(message)
  error.code = 'invalid_product_config'
  return error
}

function fail(message) { throw configError(message) }
function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true
      index++
    } else if (code >= 0xdc00 && code <= 0xdfff) return true
  }
  return false
}
function exactKeys(value, allowed, label) {
  if (!isRecord(value)) fail(`${label} must be an object`)
  const expected = new Set(allowed)
  for (const key of Object.keys(value)) if (!expected.has(key)) fail(`${label} has unknown property ${key}`)
  for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${label} is missing ${key}`)
}
function text(value, label, min, max) {
  if (typeof value !== 'string') fail(`${label} must be a string`)
  if (CONTROL_PATTERN.test(value)) fail(`${label} contains a control character`)
  if (hasUnpairedSurrogate(value)) fail(`${label} contains an unpaired surrogate`)
  if (value.trim() !== value) fail(`${label} must already be trimmed`)
  const clean = value, length = Array.from(clean).length
  if (length < min || length > max) fail(`${label} length is invalid`)
  return clean
}
function id(value, label) {
  const clean = text(value, label, 1, 64)
  if (!ID_PATTERN.test(clean)) fail(`${label} is invalid`)
  return clean
}
function list(value, label, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(`${label} length is invalid`)
  return value
}
function unique(items, label) {
  const seen = new Set()
  for (const item of items) {
    if (seen.has(item.id)) fail(`${label} has duplicate id ${item.id}`)
    seen.add(item.id)
  }
  return items
}
function exactIds(items, expected, label) {
  unique(items, label)
  if (items.length !== expected.length || expected.some(value => !items.some(item => item.id === value))) fail(`${label} must contain the exact pinned ids`)
}
function utf8Bytes(value, limit = Number.MAX_SAFE_INTEGER) {
  let bytes = 0
  for (const symbol of String(value || '')) {
    const point = symbol.codePointAt(0)
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4
    if (bytes > limit) return bytes
  }
  return bytes
}
function serializedBytes(value) {
  let serialized
  try { serialized = typeof value === 'string' ? value : JSON.stringify(value) } catch { fail('configuration cannot be serialized') }
  if (typeof serialized !== 'string') fail('configuration cannot be serialized')
  const bytes = utf8Bytes(serialized, PRODUCT_CONFIG_MAX_BYTES)
  if (bytes > PRODUCT_CONFIG_MAX_BYTES) fail('configuration exceeds 128 KiB')
  return serialized
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const item of Object.values(value)) deepFreeze(item)
  return Object.freeze(value)
}
function safeCopyUrl(value) {
  if (typeof value !== 'string' || !value || Array.from(value).length > 2048 || value.trim() !== value || /[\s\\]/u.test(value) || CONTROL_PATTERN.test(value) || hasUnpairedSurrogate(value)) fail('copy url is invalid')
  const matched = /^https:\/\/([^/?#]+)(\/[^?#]*)?$/.exec(value)
  if (!matched) fail('copy url must be public HTTPS without query or fragment')
  const authority = matched[1], host = authority.toLowerCase()
  const blockedSuffixes=['localhost','local','internal','lan','home','test','invalid','example','onion']
  if (authority !== host || !/^[a-z0-9.-]+$/.test(authority) || authority.includes('@') || authority.includes(':') || host.length > 253 || blockedSuffixes.some(suffix=>host===suffix||host.endsWith(`.${suffix}`))) fail('copy url host is not public')
  if (/^\d+(?:\.\d+){0,3}$/.test(host) || /^\[.*\]$/.test(host)) fail('copy url IP hosts are not allowed')
  const labels = host.split('.')
  if (labels.length < 2 || labels.some(part => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)) || !/^[a-z]{2,63}$/.test(labels.at(-1))) fail('copy url host is invalid')
  let path = matched[2] || '/'
  let decodes=0
  while(true){
    if(/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f|8[0-9a-f]|9[0-9a-f])/i.test(path))fail('copy url encoded separators or controls are not allowed')
    let decoded
    try { decoded = decodeURIComponent(path) } catch { fail('copy url path encoding is invalid') }
    if (/[\u0000-\u001f\u007f-\u009f]/u.test(decoded) || hasUnpairedSurrogate(decoded) || decoded.includes('\\') || decoded.split('/').some(part => part === '.' || part === '..')) fail('copy url path traversal is not allowed')
    if(decoded===path)break
    decodes++;if(decodes>8)fail('copy url path encoding is too deeply nested')
    path = decoded
  }
  return value
}
function action(value, screenTargets, label) {
  if (!isRecord(value)) fail(`${label} must be an object`)
  const kind = String(value.kind || '')
  if (kind === 'page') {
    exactKeys(value, ['kind', 'target'], label)
    const target = id(value.target, `${label}.target`)
    if (!Object.prototype.hasOwnProperty.call(PAGE_TARGETS, target)) fail(`${label} page target is not allowlisted`)
    return { kind, target }
  }
  if (kind === 'screen') {
    exactKeys(value, ['kind', 'target'], label)
    const target = id(value.target, `${label}.target`)
    screenTargets.push(target)
    return { kind, target }
  }
  if (kind === 'copy') {
    exactKeys(value, ['kind', 'url'], label)
    return { kind, url: safeCopyUrl(value.url) }
  }
  fail(`${label} action kind is unsupported`)
}
function homeRecord(value, screenTargets) {
  exactKeys(value, ['heading', 'entries', 'secondary'], 'home')
  const entries = list(value.entries, 'home.entries', 6, 6).map((entry, index) => {
    exactKeys(entry, ['id', 'title', 'detail', 'tone'], `home.entries[${index}]`)
    const local = { id: id(entry.id, `home.entries[${index}].id`), title: text(entry.title, `home.entries[${index}].title`, 1, 30), detail: text(entry.detail, `home.entries[${index}].detail`, 1, 80), tone: id(entry.tone, `home.entries[${index}].tone`) }
    if (!HOME_IDS.includes(local.tone)) fail('home entry tone is unsupported')
    return local
  })
  exactIds(entries, HOME_IDS, 'home.entries')
  const secondary = unique(list(value.secondary, 'home.secondary', 0, 6).map((entry, index) => {
    exactKeys(entry, ['id', 'label', 'action'], `home.secondary[${index}]`)
    return { id: id(entry.id, `home.secondary[${index}].id`), label: text(entry.label, `home.secondary[${index}].label`, 1, 40), action: action(entry.action, screenTargets, `home.secondary[${index}].action`) }
  }), 'home.secondary')
  return { heading: text(value.heading, 'home.heading', 1, 40), entries, secondary }
}
function coachRecord(value) {
  exactKeys(value, ['modes'], 'coach')
  const modes = list(value.modes, 'coach.modes', 4, 4).map((mode, index) => {
    exactKeys(mode, ['id', 'title', 'detail'], `coach.modes[${index}]`)
    return { id: id(mode.id, `coach.modes[${index}].id`), title: text(mode.title, `coach.modes[${index}].title`, 1, 30), detail: text(mode.detail, `coach.modes[${index}].detail`, 1, 100) }
  })
  exactIds(modes, COACH_IDS, 'coach.modes')
  return { modes }
}
function tavernRecord(value) {
  exactKeys(value, ['categories', 'presets'], 'tavern')
  const categories = list(value.categories, 'tavern.categories', 4, 4).map((category, index) => {
    exactKeys(category, ['id', 'label'], `tavern.categories[${index}]`)
    return { id: id(category.id, `tavern.categories[${index}].id`), label: text(category.label, `tavern.categories[${index}].label`, 1, 20) }
  })
  exactIds(categories, CATEGORY_IDS, 'tavern.categories')
  const presets = unique(list(value.presets, 'tavern.presets', 8, 24).map((preset, index) => {
    const label = `tavern.presets[${index}]`
    exactKeys(preset, ['id', 'name', 'tag', 'detail', 'greeting', 'placeholder', 'starters', 'category', 'icon'], label)
    const presetId = id(preset.id, `${label}.id`), category = id(preset.category, `${label}.category`), icon = text(preset.icon, `${label}.icon`, 1, 80)
    if (!['companion', 'story', 'fortune'].includes(category)) fail(`${label}.category is unsupported`)
    if (!REQUIRED_TAVERN_IDS.includes(presetId) && !['companion', 'story'].includes(category)) fail(`${label} additional presets must use generic text chat`)
    if (!TAVERN_ICONS.includes(icon)) fail(`${label}.icon is not packaged`)
    const starters = list(preset.starters, `${label}.starters`, 1, 4).map((item, starterIndex) => text(item, `${label}.starters[${starterIndex}]`, 1, 100))
    return { id: presetId, name: text(preset.name, `${label}.name`, 1, 30), tag: text(preset.tag, `${label}.tag`, 1, 30), detail: text(preset.detail, `${label}.detail`, 1, 120), greeting: text(preset.greeting, `${label}.greeting`, 1, 500), placeholder: text(preset.placeholder, `${label}.placeholder`, 1, 120), starters, category, icon }
  }), 'tavern.presets')
  if (REQUIRED_TAVERN_IDS.some(required => !presets.some(item => item.id === required))) fail('tavern.presets is missing a required native preset')
  return { categories, presets }
}
function pagesRecord(value, screenTargets) {
  return unique(list(value, 'pages', 0, 16).map((page, pageIndex) => {
    const pageLabel = `pages[${pageIndex}]`
    exactKeys(page, ['id', 'title', 'sections'], pageLabel)
    let totalLinkItems = 0
    const sections = unique(list(page.sections, `${pageLabel}.sections`, 1, 20).map((section, sectionIndex) => {
      const label = `${pageLabel}.sections[${sectionIndex}]`, type = String(section && section.type || '')
      if (type === 'text') {
        exactKeys(section, ['id', 'type', 'title', 'text'], label)
        return { id: id(section.id, `${label}.id`), type, title: text(section.title, `${label}.title`, 0, 80), text: text(section.text, `${label}.text`, 1, 4000) }
      }
      if (type === 'notice') {
        exactKeys(section, ['id', 'type', 'title', 'text', 'tone'], label)
        const tone = text(section.tone, `${label}.tone`, 1, 20)
        if (!['info', 'warning'].includes(tone)) fail(`${label}.tone is unsupported`)
        return { id: id(section.id, `${label}.id`), type, title: text(section.title, `${label}.title`, 0, 80), text: text(section.text, `${label}.text`, 1, 1000), tone }
      }
      if (type === 'links') {
        exactKeys(section, ['id', 'type', 'title', 'items'], label)
        const items = unique(list(section.items, `${label}.items`, 1, 30).map((item, itemIndex) => {
          const itemLabel = `${label}.items[${itemIndex}]`
          exactKeys(item, ['id', 'label', 'detail', 'action'], itemLabel)
          return { id: id(item.id, `${itemLabel}.id`), label: text(item.label, `${itemLabel}.label`, 1, 80), detail: text(item.detail, `${itemLabel}.detail`, 0, 160), action: action(item.action, screenTargets, `${itemLabel}.action`) }
        }), `${label}.items`)
        totalLinkItems += items.length
        return { id: id(section.id, `${label}.id`), type, title: text(section.title, `${label}.title`, 0, 80), items }
      }
      fail(`${label}.type is unsupported`)
    }), `${pageLabel}.sections`)
    if (sections.length + totalLinkItems > 100) fail(`${pageLabel} has more than 100 total items`)
    return { id: id(page.id, `${pageLabel}.id`), title: text(page.title, `${pageLabel}.title`, 1, 60), sections }
  }), 'pages')
}
function validateProductConfig(value) {
  if (typeof value === 'string') {
    serializedBytes(value)
    try { value = JSON.parse(value) } catch { fail('configuration JSON is invalid') }
  } else serializedBytes(value)
  exactKeys(value, ['schemaVersion', 'revision', 'publishedAt', 'minCapabilityVersion', 'home', 'coach', 'tavern', 'pages'], 'configuration')
  if (value.schemaVersion !== PRODUCT_CONFIG_SCHEMA) fail('configuration schema version is unsupported')
  const revision = text(value.revision, 'revision', 1, 64)
  if (!REVISION_PATTERN.test(revision) || revision === 'none') fail('revision is invalid')
  const publishedAt = text(value.publishedAt, 'publishedAt', 1, 64)
  const dateMatch=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(publishedAt)
  if(!dateMatch)fail('publishedAt must be timezone-aware ISO')
  const yearNumber=Number(dateMatch[1]),monthNumber=Number(dateMatch[2]),dayNumber=Number(dateMatch[3]),offsetHour=Number(dateMatch[10]||0),offsetMinute=Number(dateMatch[11]||0)
  if(monthNumber<1||monthNumber>12||dayNumber<1||dayNumber>new Date(Date.UTC(yearNumber,monthNumber,0)).getUTCDate()||Number(dateMatch[4])>23||Number(dateMatch[5])>59||Number(dateMatch[6])>59||offsetHour>23||offsetMinute>59||!Number.isFinite(Date.parse(publishedAt)))fail('publishedAt must be timezone-aware ISO')
  if (value.minCapabilityVersion !== PRODUCT_CONFIG_CAPABILITY) fail('configuration requires an unsupported capability version')
  const screenTargets = []
  const home = homeRecord(value.home, screenTargets), coach = coachRecord(value.coach), tavern = tavernRecord(value.tavern), pages = pagesRecord(value.pages, screenTargets)
  const pageIds = new Set(pages.map(page => page.id))
  if (screenTargets.some(target => !pageIds.has(target))) fail('configuration action refers to an unknown screen target')
  return deepFreeze({ schemaVersion: PRODUCT_CONFIG_SCHEMA, revision, publishedAt, minCapabilityVersion: value.minCapabilityVersion, home, coach, tavern, pages })
}

function productConfigChannel() {
  try {
    const value = String(wx.getAccountInfoSync && wx.getAccountInfoSync()?.miniProgram?.envVersion || '').toLowerCase()
    return ['release', 'trial', 'develop'].includes(value) ? value : 'release'
  } catch { return 'release' }
}
function productConfigCacheKey(channel = productConfigChannel()) { return `${CACHE_PREFIX}${['release', 'trial', 'develop'].includes(channel) ? channel : 'release'}` }
function currentOrigin() {
  try { return safeApiBase(getApp()?.globalData?.apiBaseUrl) || DEFAULT_API_BASE } catch { return DEFAULT_API_BASE }
}
function safeNow(value) { return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : Date.now() }
function safeEtag(value) { return typeof value === 'string' && value.length <= 200 && !CONTROL_PATTERN.test(value) ? value : '' }
function responseHeader(headers, wanted) {
  if (!isRecord(headers)) return ''
  const key = Object.keys(headers).find(name => name.toLowerCase() === wanted)
  return key ? headers[key] : ''
}
function responseEtag(headers) { return safeEtag(responseHeader(headers, 'etag')) }
function validResponseLength(headers) { const value=String(responseHeader(headers,'content-length')||'').trim();return !value||/^\d+$/.test(value)&&Number(value)<=PRODUCT_CONFIG_MAX_BYTES }
function readCache(channel, now) {
  let value
  try { value = wx.getStorageSync(productConfigCacheKey(channel)) } catch { return null }
  if (!isRecord(value) || value.schemaVersion !== CACHE_SCHEMA || !Number.isFinite(value.savedAt)) return null
  const age = now - value.savedAt
  if (age < 0 || age > PRODUCT_CONFIG_CACHE_MAX_AGE_MS) return null
  try { return { config: validateProductConfig(value.config), etag: safeEtag(value.etag), savedAt: value.savedAt } } catch { return null }
}
function writeCache(channel, config, etag, now) {
  const record = { schemaVersion: CACHE_SCHEMA, savedAt: now, etag: safeEtag(etag), config }
  try { wx.setStorageSync(productConfigCacheKey(channel), record) } catch {}
  return record
}
function stateFor(channel) {
  if (!channelState[channel]) channelState[channel] = { generation: 0, active: null, observedAt: 0 }
  return channelState[channel]
}
function freshActive(channel, now) {
  const active = stateFor(channel).active
  return active && now >= active.savedAt && now - active.savedAt <= PRODUCT_CONFIG_CACHE_MAX_AGE_MS ? active : null
}
function readProductConfigSnapshot({ channel = productConfigChannel(), now = Date.now() } = {}) {
  const currentTime = safeNow(now), safeChannel = ['release', 'trial', 'develop'].includes(channel) ? channel : 'release'
  const state=stateFor(safeChannel);state.observedAt=Math.max(state.observedAt,currentTime)
  const active = freshActive(safeChannel, currentTime), cached = active || readCache(safeChannel, currentTime)
  return cached ? { config: cached.config, source: 'cache', channel: safeChannel, etag: cached.etag || '', savedAt: cached.savedAt } : { config: DEFAULT_PRODUCT_CONFIG, source: 'bundled', channel: safeChannel, etag: '', savedAt: 0 }
}
function resultFromFallback(channel, now, generation, { stale = false } = {}) {
  const snapshot = readProductConfigSnapshot({ channel, now })
  return { ...snapshot, generation, stale }
}
function staleResult(channel, now, generation) {
  const state=stateFor(channel),evaluationTime=Math.max(now,state.observedAt),active=freshActive(channel,evaluationTime)
  if (active) return { config: active.config, source: 'cache', channel, etag: active.etag || '', savedAt: active.savedAt, generation, stale: true }
  return resultFromFallback(channel, evaluationTime, generation, { stale: true })
}
function responsePayload(data) {
  if (typeof data === 'string') {
    serializedBytes(data)
    try { return JSON.parse(data) } catch { fail('configuration JSON is invalid') }
  }
  serializedBytes(data)
  return data
}
function loadProductConfig({ channel = productConfigChannel(), timeout = 8000, now = Date.now() } = {}) {
  const safeChannel = ['release', 'trial', 'develop'].includes(channel) ? channel : 'release', currentTime = safeNow(now), state = stateFor(safeChannel), generation = ++state.generation
  state.observedAt=Math.max(state.observedAt,currentTime)
  const cached = readCache(safeChannel, currentTime) || freshActive(safeChannel, currentTime)
  return new Promise(resolve => {
    let settled = false
    const finish = value => { if (!settled) { settled = true; resolve(value) } }
    const staleOr = options => generation !== state.generation ? finish(staleResult(safeChannel, currentTime, generation)) : finish(options())
    const fallback = () => ({ ...resultFromFallback(safeChannel, currentTime, generation), unavailable: true })
    const request = {
      url: `${currentOrigin()}${PRODUCT_CONFIG_PATH}?channel=${safeChannel}&capability=${PRODUCT_CONFIG_CAPABILITY}`,
      method: 'GET', timeout, dataType: 'text', responseType: 'text',
      header: { Accept: 'application/json', ...(cached?.etag ? { 'If-None-Match': cached.etag } : {}) },
      success(response) {
        staleOr(() => {
          if (Number(response?.statusCode) === 304 && cached) {
            const record = writeCache(safeChannel, cached.config, responseEtag(response.header) || cached.etag, currentTime)
            state.active = record
            return { config: record.config, source: 'not-modified', channel: safeChannel, etag: record.etag, savedAt: record.savedAt, generation, stale: false }
          }
          if (Number(response?.statusCode) !== 200) return fallback()
          if(!validResponseLength(response.header))return fallback()
          try {
            const config = validateProductConfig(responsePayload(response.data)), etag = responseEtag(response.header), record = writeCache(safeChannel, config, etag, currentTime)
            state.active = record
            return { config, source: 'network', channel: safeChannel, etag, savedAt: currentTime, generation, stale: false }
          } catch { return fallback() }
        })
      },
      fail() { staleOr(fallback) },
    }
    try { wx.request(request) } catch { staleOr(fallback) }
  })
}
function configuredPage(config, pageId) {
  if (!config || !Array.isArray(config.pages) || typeof pageId !== 'string' || !ID_PATTERN.test(pageId)) return null
  return config.pages.find(page => page.id === pageId) || null
}
function resolveProductAction(config, value) {
  if (!isRecord(value)) return null
  if (value.kind === 'page' && Object.prototype.hasOwnProperty.call(PAGE_TARGETS, value.target)) return { kind: 'navigate', url: PAGE_TARGETS[value.target] }
  if (value.kind === 'screen' && configuredPage(config, value.target)) return { kind: 'navigate', url: `/bundles/configured/index?id=${encodeURIComponent(value.target)}` }
  if (value.kind === 'copy') try { return { kind: 'copy', url: safeCopyUrl(value.url) } } catch { return null }
  return null
}

module.exports = {
  PRODUCT_CONFIG_CACHE_MAX_AGE_MS,
  PRODUCT_CONFIG_CAPABILITY,
  PRODUCT_CONFIG_MAX_BYTES,
  PRODUCT_CONFIG_PATH,
  configuredPage,
  loadProductConfig,
  productConfigCacheKey,
  productConfigChannel,
  readProductConfigSnapshot,
  resolveProductAction,
  validateProductConfig,
}
