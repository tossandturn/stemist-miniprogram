const { readDeviceProfile } = require('./utils/device')
const { DEFAULT_API_BASE, DEFAULT_IELTS_API_BASE, safeApiBase, safeIeltsApiBase } = require('./utils/apiOrigin')
const { ensureWeChatSession } = require('./utils/wechatAuth')
const { wrapEntryPage, prepareEntry, consentAccepted } = require('./utils/entryAccess')
const registerPage = Page
Page = definition => registerPage(wrapEntryPage(definition))

App({
  globalData: {
    apiBaseUrl: DEFAULT_API_BASE,
    ieltsApiBaseUrl: DEFAULT_IELTS_API_BASE,
    deviceProfile: null,
    debugMode: false,
    wechatAuth: { status: 'pending' },
  },
  onLaunch() {
    const configured = wx.getStorageSync('stemistApiBaseUrl')
    const safeConfigured = safeApiBase(configured)
    if (safeConfigured) this.globalData.apiBaseUrl = safeConfigured
    const configuredIelts = wx.getStorageSync('stemistIeltsApiBaseUrl')
    const safeConfiguredIelts = safeIeltsApiBase(configuredIelts)
    if (safeConfiguredIelts) this.globalData.ieltsApiBaseUrl = safeConfiguredIelts
    this.globalData.deviceProfile = readDeviceProfile()
    try {
      const accountInfo = wx.getAccountInfoSync && wx.getAccountInfoSync()
      const envVersion = String(accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion || '').toLowerCase()
      this.globalData.debugMode = envVersion === 'develop' || envVersion === 'trial'
    } catch { this.globalData.debugMode = false }
    // Permission precedes any existing-session refresh. Guests still log in
    // explicitly; Page registration prevents protected onLoad side effects.
    prepareEntry().then(allowed => allowed && consentAccepted() ? ensureWeChatSession({ silent: true }) : {status:'consent-required'}).then((result) => { this.globalData.wechatAuth = result }).catch((error) => { this.globalData.wechatAuth = { status: 'unavailable', errorCode: error && error.code } })
  },
  onShow() {
    this.globalData.deviceProfile = readDeviceProfile()
    return prepareEntry().then(allowed=>{if(!allowed)getCurrentPages().slice(-1)[0]?.onShow?.()})
  },
})
