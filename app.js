App({
  globalData: {
    apiBaseUrl: 'https://stem.ieltsist.com',
  },
  onLaunch() {
    const configured = wx.getStorageSync('stemistApiBaseUrl')
    if (configured) this.globalData.apiBaseUrl = configured.replace(/\/+$/, '')
  },
})
