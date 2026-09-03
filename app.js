const { readDeviceProfile } = require('./utils/device')

App({
  globalData: {
    apiBaseUrl: 'https://stem.ieltsist.com',
    deviceProfile: null,
  },
  onLaunch() {
    const configured = wx.getStorageSync('stemistApiBaseUrl')
    if (configured) this.globalData.apiBaseUrl = configured.replace(/\/+$/, '')
    this.globalData.deviceProfile = readDeviceProfile()
  },
  onShow() { this.globalData.deviceProfile = readDeviceProfile() },
})
