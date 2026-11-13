const { readDeviceProfile } = require('./utils/device')
const { DEFAULT_API_BASE, DEFAULT_IELTS_API_BASE, safeApiBase, safeIeltsApiBase } = require('./utils/apiOrigin')
const { ensureWeChatSession } = require('./utils/wechatAuth')
const { wrapEntryPage, prepareEntry, consentAccepted } = require('./utils/entryAccess')
const { registerAgentHandoff } = require('./utils/agentHandoff')
const registerPage = Page
Page = definition => registerPage(wrapEntryPage(definition))

App({
  globalData: {
    apiBaseUrl: DEFAULT_API_BASE,
    ieltsApiBaseUrl: DEFAULT_IELTS_API_BASE,
    deviceProfile: null,
    debugMode: false,
    wechatAuth: { status: 'pending' },
    agentHandoffs: {},
  },
  onLaunch() {
    registerAgentHandoff(wx, this.globalData)
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
    // Home remains browsable. Existing sessions may refresh silently only
    // after privacy status is checked; protected pages still require consent
    // and identity, and guests are never logged in automatically.
    prepareEntry().then(allowed => allowed && consentAccepted() ? ensureWeChatSession({ silent: true }) : {status:'consent-required'}).then((result) => { this.globalData.wechatAuth = result }).catch((error) => { this.globalData.wechatAuth = { status: 'unavailable', errorCode: error && error.code } })
  },
  onShow() {
    this.globalData.deviceProfile = readDeviceProfile()
    return prepareEntry().then(allowed=>{if(!allowed){const page=getCurrentPages().slice(-1)[0];if(page?.__entryInitialized)page.onShow?.()}})
  },
})
