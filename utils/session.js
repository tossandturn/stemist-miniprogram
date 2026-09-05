const { discardPendingDrafts } = require('./page')
const PRIVATE_SCOPES = ['listening', 'reading', 'writing', 'stem-photo']

function clearLocalSession({ preserveDrafts = false } = {}) {
  wx.removeStorageSync('stemistSessionToken')
  wx.removeStorageSync('stemistUser')
  // A 401 clears only the expired identity. Preserve the in-progress photo,
  // crop context and pending sync so the learner can sign back in and retry
  // without taking the question again. Explicit logout still removes all
  // private evidence and drafts for shared-device safety.
  if (!preserveDrafts) {
    discardPendingDrafts()
    wx.removeStorageSync('stemistCameraReturn')
    wx.removeStorageSync('stemistCropReturn')
    wx.removeStorageSync('stemistRetakeContext')
    wx.removeStorageSync('stemistCroppedImage')
    wx.removeStorageSync('stemistCoachContext')
    wx.removeStorageSync('stemistWritingPhoto')
    wx.removeStorageSync('stemistPendingAttemptSync')
  }
  PRIVATE_SCOPES.forEach((scope) => {
    if (!preserveDrafts) wx.removeStorageSync(`stemistDraft:${scope}`)
    wx.removeStorageSync(`stemistSubmission:${scope}`)
  })
  // Notebook entries are account-private. Remove them on explicit logout so
  // a second learner using the same device cannot see the previous account's
  // notes. Drafts remain only when the caller explicitly requests preservation.
  if (!preserveDrafts) {
    const keys = wx.getStorageInfoSync ? (wx.getStorageInfoSync().keys || []) : []
    keys.filter((key) => /^stemist(?:Notebook|Draft|Submission):/.test(String(key))).forEach((key) => wx.removeStorageSync(key))
  }
}

module.exports = { clearLocalSession }
