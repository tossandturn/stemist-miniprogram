const { readDeviceProfile } = require('./utils/device')
const { DEFAULT_API_BASE, DEFAULT_IELTS_API_BASE, safeApiBase, safeIeltsApiBase } = require('./utils/apiOrigin')
const { ensureWeChatSession } = require('./utils/wechatAuth')

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
    // wx.login is silent. Start the exchange in the background so the first
    // entry card can usually open with an already-linked shared account. A
    // missing server adapter must never prevent the mini-program shell from
    // launching; the account page remains the explicit recovery path.
    ensureWeChatSession({ silent: true }).then((result) => { this.globalData.wechatAuth = result }).catch((error) => { this.globalData.wechatAuth = { status: 'unavailable', errorCode: error && error.code } })
  },
  onShow() { this.globalData.deviceProfile = readDeviceProfile() },
})
