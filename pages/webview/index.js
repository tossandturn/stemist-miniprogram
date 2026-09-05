const { deviceState, syncDevice } = require('../../utils/page')
const { requestJson } = require('../../utils/api')

const ALLOWED_HOSTS = ['stem.ieltsist.com', 'ieltsist.com']

function allowedUrl(value) {
  try {
    const candidate = decodeURIComponent(String(value || '')).trim()
    const match = candidate.match(/^https:\/\/([^/?#]+)([/?#].*)?$/i)
    if (!match) return ''
    const host = match[1].toLowerCase()
    if (!ALLOWED_HOSTS.includes(host) || host.includes('@') || host.includes(':')) return ''
    return `https://${host}${match[2] || '/'}`
  } catch { return '' }
}

function queryValue(url, key) {
  const match = String(url || '').match(new RegExp(`[?&]${key}=([^&#]*)`, 'i'))
  if (!match) return ''
  try { return decodeURIComponent(match[1] || '') } catch { return '' }
}

function coachContextForUrl(url) {
  if (!url) return { coachSource: 'webview', category: '', family: '', routeId: '', stage: '', subjectCode: '' }
  const host = String(url || '').match(/^https:\/\/([^/?#]+)/i)?.[1]?.toLowerCase() || ''
  if (host === 'ieltsist.com') return { coachSource: 'ielts', category: 'ielts', family: '', routeId: '', stage: '', subjectCode: '' }
  const categoryValue = queryValue(url, 'category').toLowerCase()
  const category = categoryValue === 'competition' ? 'competition' : 'alevel'
  const familyValue = queryValue(url, 'family').toLowerCase()
  const family = ['exam', 'competition', 'admissions'].includes(familyValue) ? familyValue : category === 'competition' ? 'competition' : 'exam'
  return { coachSource: category === 'competition' ? 'competition' : 'alevel', category, family, routeId: queryValue(url, 'routeId'), stage: queryValue(url, 'stage'), subjectCode: queryValue(url, 'subject') || queryValue(url, 'subjectCode') }
}

Page({
  data: deviceState({ url: '', error: '', loaded: false, coachSource: 'webview', category: '', family: '', routeId: '', stage: '', subjectCode: '' }),
  onLoad(options) {
    this.__disposed = false
    const epoch = (this.__epoch || 0) + 1
    this.__epoch = epoch
    const url = allowedUrl(options && options.url)
    this.__rawUrl = url
    this.setData({ url: '', loaded: false, error: url ? '' : '这个网页地址不在 Stemist/IELTSist 安全范围内。', ...coachContextForUrl(url) })
    if (!url) return
    const parsed = url.match(/^https:\/\/([^/?#]+)([/?#].*)?$/i)
    if (!parsed) { this.setData({ url }); return }
    const token = String(wx.getStorageSync('stemistSessionToken') || '')
    // A one-time server handoff lets either embedded web workspace recover
    // the same account without putting the bearer token in a URL.
    const hostname = parsed[1].toLowerCase()
    const target = hostname === 'ieltsist.com' ? 'ielts' : 'stem'
    const pathAndQuery = parsed[2] || '/'
    const isConsumePath = /\/api\/auth\/[^?#]*consume/i.test(pathAndQuery)
    if (token && !isConsumePath) {
      const returnTo = pathAndQuery
      requestJson('/api/auth/webview-handoff', { returnTo, target }, { method: 'POST', timeout: 6000 })
        .then((payload) => {
          if (this.__disposed || epoch !== this.__epoch) return
          const handoff = allowedUrl(payload && payload.url)
          this.setData({ url: handoff || url })
        })
        .catch(() => { if (!this.__disposed && epoch === this.__epoch) this.setData({ url }) })
    } else {
      this.setData({ url })
    }
  },
  onShow() { syncDevice(this) },
  onUnload() { this.__disposed = true; this.__epoch += 1 },
  onResize() { syncDevice(this) },
  onLoadWebView() { this.setData({ loaded: true }) },
  onError() { this.setData({ url: '', loaded: false, error: '页面暂时无法打开，请重试。' }) },
  retry() { this.onLoad({ url: encodeURIComponent(this.__rawUrl || '') }) },
  back() { wx.navigateBack() },
})
