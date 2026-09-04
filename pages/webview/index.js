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

Page({
  data: deviceState({ url: '', error: '', loaded: false }),
  onLoad(options) {
    const url = allowedUrl(options && options.url)
    this.__rawUrl = url
    this.setData({ url: '', loaded: false, error: url ? '' : '这个网页地址不在 Stemist/IELTSist 安全范围内。' })
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
          const handoff = allowedUrl(payload && payload.url)
          this.setData({ url: handoff || url })
        })
        .catch(() => this.setData({ url, error: '账号接续暂不可用；网页仍可打开，必要时在网页内登录。' }))
    } else {
      this.setData({ url })
    }
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onLoadWebView() { this.setData({ loaded: true }) },
  onError() { this.setData({ error: '网页工作区暂时无法打开，请检查网络或业务域名配置。' }) },
  back() { wx.navigateBack() },
})
