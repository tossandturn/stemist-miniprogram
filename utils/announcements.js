const { getJson, requestJson } = require('./api')

const PROTOCOL = 'stem-announcements-v1'
const MAX_READ_IDS = 300
const CATEGORIES = {
  system: '系统通知',
  feature: '功能更新',
  learning: '学习提醒',
  service: '服务通知',
}
const ALLOWED_PATHS = new Set([
  '/pages/index/index',
  '/pages/practice/index',
  '/pages/papers/index',
  '/pages/calculator/index',
  '/pages/coach/index',
  '/pages/progress/index',
  '/pages/notebook/index',
  '/pages/stem/capture',
  '/pages/stem/camera',
  '/pages/stem/topics',
  '/pages/stem/practice',
  '/pages/stem/paper',
  '/pages/stem/coach',
  '/pages/ielts/listening',
  '/pages/ielts/library',
  '/pages/ielts/home',
  '/pages/ielts/exam',
  '/pages/ielts/vocabulary',
  '/pages/ielts/reading',
  '/pages/ielts/writing',
  '/pages/ielts/writing-full',
  '/pages/ielts/speaking',
  '/bundles/curricula/index',
  '/bundles/marking/index',
])
const ALLOWED_QUERY_KEYS = new Set(['board', 'category', 'course', 'family', 'level', 'mode', 'module', 'paper', 'routeId', 'session', 'stage', 'subject', 'subjectCode', 'year'])

function cleanText(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : ''
}

function cleanBody(value) {
  return typeof value === 'string'
    ? value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000)
    : ''
}

function validTimestamp(value) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : ''
}

function ownerId(value) {
  const stored = value === undefined ? wx.getStorageSync('stemistUser')?.id : value
  return cleanText(String(stored || 'guest'), 120) || 'guest'
}

function readKey(value) {
  return `stemistAnnouncementReads:${encodeURIComponent(ownerId(value))}`
}

function readIds(value) {
  const stored = wx.getStorageSync(readKey(value))
  const entries = Array.isArray(stored) ? stored : Array.isArray(stored?.ids) ? stored.ids : []
  return new Set(entries.map((entry) => cleanText(entry, 120)).filter(Boolean))
}

function writeReadIds(value, ids) {
  const entries = [...ids].slice(-MAX_READ_IDS)
  wx.setStorageSync(readKey(value), { version: 1, ids: entries })
  return new Set(entries)
}

function action(value) {
  if (!value || typeof value !== 'object') return null
  const label = cleanText(value.label, 30)
  const url = cleanText(value.url, 260)
  return label && isSafeAnnouncementRoute(url) ? { label, url } : null
}

function announcementStatus(value) {
  const status = cleanText(value, 20).toLowerCase()
  return ['draft', 'published', 'archived'].includes(status) ? status : 'published'
}

function dateLabel(value) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function normalizeAnnouncement(value) {
  if (!value || typeof value !== 'object') return null
  const title = cleanText(value.title, 90)
  const body = cleanBody(value.body)
  if (!title || !body) return null
  const category = Object.hasOwn(CATEGORIES, value.category) ? value.category : 'system'
  const publishedAt = validTimestamp(value.publishedAt)
  const updatedAt = validTimestamp(value.updatedAt)
  return {
    id: cleanText(value.id, 120),
    title,
    summary: cleanText(value.summary, 180) || cleanText(body.replace(/\s+/g, ' '), 180),
    body,
    category,
    categoryLabel: CATEGORIES[category],
    pinned: value.pinned === true,
    status: announcementStatus(value.status),
    publishedAt,
    publishedLabel: dateLabel(publishedAt || updatedAt),
    updatedAt,
    expiresAt: validTimestamp(value.expiresAt),
    readAt: validTimestamp(value.readAt),
    action: action(value.action),
  }
}

function normalizeItems(values) {
  return (Array.isArray(values) ? values : []).map(normalizeAnnouncement).filter((value) => value && value.id)
}

function isSafeAnnouncementRoute(value) {
  try {
    if (typeof value !== 'string' || value.length < 2 || value.length > 260 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return false
    if (value.includes('#')) return false
    const separator = value.indexOf('?')
    const pathname = separator === -1 ? value : value.slice(0, separator)
    const query = separator === -1 ? '' : value.slice(separator + 1)
    if (!ALLOWED_PATHS.has(pathname) || query.includes('?')) return false
    for (const entry of query ? query.split('&') : []) {
      const [rawKey, rawValue = ''] = entry.split('=')
      const key = decodeURIComponent(rawKey || '')
      const queryValue = decodeURIComponent(rawValue)
      if (!ALLOWED_QUERY_KEYS.has(key) || queryValue.length > 100 || /[\u0000-\u001f\u007f]/.test(queryValue)) return false
    }
    return true
  } catch {
    return false
  }
}

function markAnnouncementRead(id, value) {
  const announcementId = cleanText(id, 120)
  if (!announcementId) return readIds(value)
  const ids = readIds(value)
  ids.add(announcementId)
  return writeReadIds(value, ids)
}

function unreadAnnouncementCount(items, value) {
  const seen = readIds(value)
  return normalizeItems(items).filter((item) => !item.readAt && !seen.has(item.id)).length
}

function announcementViews(items, value) {
  const seen = readIds(value)
  return normalizeItems(items).map((item) => ({ ...item, unread: !item.readAt && !seen.has(item.id), hasAction: Boolean(item.action) }))
}

function assertProtocol(result) {
  if (!result || result.schemaVersion !== PROTOCOL || !Array.isArray(result.items)) throw new Error('公告暂时无法读取，请稍后重试。')
  return result
}

async function fetchAnnouncements({ limit = 12, offset = 0 } = {}) {
  const pageLimit = Math.max(1, Math.min(30, Number(limit) || 12))
  const pageOffset = Math.max(0, Math.min(100000, Number(offset) || 0))
  const path = `/api/stem/announcements?limit=${pageLimit}&offset=${pageOffset}`
  const authenticated = Boolean(wx.getStorageSync('stemistSessionToken'))
  let result
  try {
    result = await getJson(path, { timeout: 10000, stemAuth: authenticated })
  } catch (error) {
    if (!authenticated || Number(error?.statusCode) !== 401) throw error
    result = await getJson(path, { timeout: 10000, stemAuth: false })
  }
  result = assertProtocol(result)
  return { ...result, items: normalizeItems(result.items) }
}

async function fetchAnnouncementManagement() {
  const result = assertProtocol(await getJson('/api/stem/announcements/manage', { timeout: 10000 }))
  if (result.canManage !== true) throw new Error('当前账号没有公告管理权限。')
  return { ...result, items: normalizeItems(result.items) }
}

async function recordAnnouncementRead(item, value) {
  const announcement = normalizeAnnouncement(item)
  if (!announcement) return false
  markAnnouncementRead(announcement.id, value)
  if (!wx.getStorageSync('stemistSessionToken')) return true
  try {
    await requestJson(`/api/stem/announcements/${encodeURIComponent(announcement.id)}/read`, {}, { method: 'POST', timeout: 10000 })
  } catch {}
  return true
}

async function saveAnnouncement(id, payload) {
  const announcementId = cleanText(id, 120)
  const title = cleanText(payload?.title, 90)
  const body = cleanBody(payload?.body)
  const summary = cleanText(payload?.summary, 180) || cleanText(body.replace(/\s+/g, ' '), 180)
  const actionLabel = cleanText(payload?.actionLabel, 30)
  const actionUrl = cleanText(payload?.actionUrl, 260)
  if (!title || !body) throw new Error('请填写公告标题和正文。')
  if ((actionLabel || actionUrl) && (!actionLabel || !actionUrl || !isSafeAnnouncementRoute(actionUrl))) throw new Error('跳转仅支持已登记的小程序站内路径。')
  const bodyPayload = {
    title,
    summary,
    body,
    category: Object.hasOwn(CATEGORIES, payload?.category) ? payload.category : 'system',
    pinned: payload?.pinned === true,
    status: ['draft', 'published', 'archived'].includes(payload?.status) ? payload.status : 'draft',
    action: actionLabel && actionUrl ? { label: actionLabel, url: actionUrl } : null,
    expiresAt: cleanText(payload?.expiresAt, 80) || null,
  }
  return requestJson(announcementId ? `/api/stem/announcements/${encodeURIComponent(announcementId)}` : '/api/stem/announcements', bodyPayload, { method: announcementId ? 'PATCH' : 'POST', timeout: 15000 })
}

module.exports = {
  CATEGORIES,
  announcementViews,
  dateLabel,
  fetchAnnouncementManagement,
  fetchAnnouncements,
  isSafeAnnouncementRoute,
  markAnnouncementRead,
  normalizeAnnouncement,
  ownerId,
  recordAnnouncementRead,
  saveAnnouncement,
  unreadAnnouncementCount,
}
