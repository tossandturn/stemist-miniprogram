const { readDeviceProfile, deviceClass } = require('./device')
const pendingDraftOwners = new Set()

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

function clearDraft(scope) {
  for (const page of pendingDraftOwners) {
    if (page.__pendingDraft?.scope !== scope) continue
    clearTimeout(page.__draftTimer); page.__draftTimer = null; page.__pendingDraft = null
    pendingDraftOwners.delete(page)
  }
  wx.removeStorageSync(draftKey(scope))
}

function discardPendingDrafts() {
  for (const page of pendingDraftOwners) {
    clearTimeout(page.__draftTimer)
    page.__draftTimer = null
    page.__pendingDraft = null
  }
  pendingDraftOwners.clear()
}

function scheduleDraft(page, scope, value) {
  if (page.__draftTimer) clearTimeout(page.__draftTimer)
  page.__pendingDraft = { scope, value }
  pendingDraftOwners.add(page)
  page.__draftTimer = setTimeout(() => cancelDraft(page), 350)
}

function cancelDraft(page) {
  if (page.__draftTimer) clearTimeout(page.__draftTimer)
  page.__draftTimer = null
  const pending = page.__pendingDraft
  page.__pendingDraft = null
  pendingDraftOwners.delete(page)
  if (pending) writeDraft(pending.scope, pending.value)
}

module.exports = { deviceState, syncDevice, draftKey, readDraft, writeDraft, clearDraft, discardPendingDrafts, scheduleDraft, cancelDraft }
