const { readDeviceProfile, deviceClass } = require('./device')

function deviceState(extra = {}) {
  const profile = readDeviceProfile()
  return { ...extra, deviceClass: deviceClass(profile), isTablet: profile.isTablet, windowWidth: profile.windowWidth, windowHeight: profile.windowHeight, orientation: profile.orientation }
}

function syncDevice(page) {
  const profile = readDeviceProfile()
  page.setData({ deviceClass: deviceClass(profile), isTablet: profile.isTablet, windowWidth: profile.windowWidth, windowHeight: profile.windowHeight, orientation: profile.orientation })
  return profile
}

function draftKey(scope) { return `stemistDraft:${String(scope || 'default')}` }

function readDraft(scope) {
  const value = wx.getStorageSync(draftKey(scope))
  return value && typeof value === 'object' ? value : null
}

function writeDraft(scope, value) {
  wx.setStorageSync(draftKey(scope), { ...value, updatedAt: Date.now() })
}

function clearDraft(scope) { wx.removeStorageSync(draftKey(scope)) }

function scheduleDraft(page, scope, value) {
  if (page.__draftTimer) clearTimeout(page.__draftTimer)
  page.__draftTimer = setTimeout(() => writeDraft(scope, value), 350)
}

function cancelDraft(page) {
  if (page.__draftTimer) {
    clearTimeout(page.__draftTimer)
    page.__draftTimer = null
  }
}

module.exports = { deviceState, syncDevice, draftKey, readDraft, writeDraft, clearDraft, scheduleDraft, cancelDraft }
