function readDeviceProfile() {
  const info = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
  const width = Number(info.windowWidth || info.screenWidth || 375)
  const model = String(info.model || '')
  const deviceType = String(info.deviceType || '').toLowerCase()
  const isTablet = deviceType === 'tablet' || /ipad/i.test(model) || width >= 768
  return {
    kind: isTablet ? 'tablet' : 'phone',
    isTablet,
    windowWidth: width,
    orientation: width >= 768 ? 'landscape-or-portrait-tablet' : 'phone',
  }
}

function deviceClass(profile = readDeviceProfile()) {
  return profile.isTablet ? 'device-tablet' : 'device-phone'
}

module.exports = { readDeviceProfile, deviceClass }
