const { validDestinationId, validRouteId, validSelector } = require('./agentHandoffRegistry.generated')

const HANDOFF_PATH = '/bundles/ai-entry/index'
const QUERY_KEYS = ['destinationId', 'courseSystem', 'subjectCode', 'stage', 'routeId', 'task']
const MAX_QUERY_CHARS = 512
const MAX_HANDOFFS = 16

function clean(value, max = 96) { return String(value || '').trim().slice(0, max) }
function decode(value) { try { return decodeURIComponent(String(value || '').replace(/\+/g, ' ')) } catch { return '' } }

function requestFromQuery(query) {
  const source = String(query || '')
  if (source.length > MAX_QUERY_CHARS) return null
  const request = {}
  for (const pair of source.split('&').filter(Boolean)) {
    const index = pair.indexOf('=')
    const key = decode(index < 0 ? pair : pair.slice(0, index))
    const value = clean(decode(index < 0 ? '' : pair.slice(index + 1)))
    if (!QUERY_KEYS.includes(key) || Object.hasOwn(request, key)) return null
    if (value) request[key] = value
  }
  if (request.destinationId && (Object.keys(request).length !== 1 || !validDestinationId(request.destinationId))) return null
  if (request.routeId && !validRouteId(request.routeId)) return null
  for (const key of ['courseSystem', 'task', 'subjectCode', 'stage']) if (request[key] && !validSelector(key, request[key])) return null
  return request
}

function requestFromOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return null
  const request = {}
  for (const key of QUERY_KEYS) if (options[key] !== undefined && clean(options[key])) request[key] = clean(options[key])
  return requestFromQuery(queryFromRequest(request))
}

function queryFromRequest(request = {}) {
  return QUERY_KEYS.filter(key => request[key]).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(clean(request[key]))}`).join('&')
}

function safePath(value) {
  const path = `/${String(value || '').replace(/^\/+/, '')}`
  return path === HANDOFF_PATH ? path : ''
}

function safePayload(payload, request) {
  const value = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
  if (request.destinationId) {
    if (value.destinationId && clean(value.destinationId) !== request.destinationId) return null
    return { status: 'ready', destinationId: request.destinationId }
  }
  if (value.status && value.status !== 'choose') return null
  return { status: 'choose' }
}

function sanitizeAgentHandoff(event) {
  const pageId = Number(event?.pageId)
  const path = safePath(event?.path)
  const request = requestFromQuery(event?.query)
  if (!Number.isSafeInteger(pageId) || pageId <= 0 || !path || !request) return null
  const payload = safePayload(event?.payload, request)
  if (!payload) return null
  if (request.destinationId && payload.destinationId && request.destinationId !== payload.destinationId) return null
  return { pageId, path, query: queryFromRequest(request), payload }
}

function cacheAgentHandoff(store, event) {
  if (!store || typeof store !== 'object' || Array.isArray(store)) return false
  const value = sanitizeAgentHandoff(event)
  if (!value || Object.hasOwn(store, value.pageId)) return false
  const keys = Object.keys(store)
  while (keys.length >= MAX_HANDOFFS) delete store[keys.shift()]
  store[value.pageId] = { path: value.path, query: value.query, payload: value.payload }
  return true
}

function consumeAgentHandoff(store, pageId) {
  const key = String(Number(pageId))
  if (!store || !Object.hasOwn(store, key)) return null
  const value = store[key]
  delete store[key]
  return value
}

function registerAgentHandoff(wxApi, globalData) {
  if (!wxApi?.onAgentHandoff || !globalData || globalData.__agentHandoffRegistered) return false
  globalData.agentHandoffs = globalData.agentHandoffs && typeof globalData.agentHandoffs === 'object' ? globalData.agentHandoffs : {}
  wxApi.onAgentHandoff(event => cacheAgentHandoff(globalData.agentHandoffs, event))
  globalData.__agentHandoffRegistered = true
  return true
}

module.exports = { HANDOFF_PATH, cacheAgentHandoff, consumeAgentHandoff, queryFromRequest, registerAgentHandoff, requestFromOptions, requestFromQuery, sanitizeAgentHandoff }
