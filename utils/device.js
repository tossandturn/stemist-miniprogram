function readDeviceProfile() {
  const info = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
  const width = Number(info.windowWidth || info.screenWidth || 375)
  const height = Number(info.windowHeight || info.screenHeight || 667)
  const model = String(info.model || '')
  const deviceType = String(info.deviceType || '').toLowerCase()
  // Some Android tablets report deviceType=unknown and models such as
  // "Pixel Tablet". Detect tablet families first so a wide phone in
  // landscape is never promoted to the tablet layout, while a tablet model
  // is not accidentally classified as a phone by the word "Pixel".
  const knownTablet = deviceType === 'tablet' || /ipad|tablet|surface duo|galaxy tab|matepad|pad$/i.test(model)
  const knownPhone = !knownTablet && (deviceType === 'phone' || /iphone|android phone|mobile|pixel(?:\s+[0-9]|$)/i.test(model))
  const isTablet = knownTablet || (!knownPhone && width >= 768)
  return {
    kind: isTablet ? 'tablet' : 'phone',
    isTablet,
    windowWidth: width,
    windowHeight: height,
    orientation: isTablet ? (width >= height ? 'landscape' : 'portrait') : 'phone',
  }
}

function deviceClass(profile = readDeviceProfile()) {
  return profile.isTablet ? 'device-tablet' : 'device-phone'
}

module.exports = { readDeviceProfile, deviceClass }
