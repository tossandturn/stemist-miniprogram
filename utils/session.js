const PRIVATE_SCOPES = ['listening', 'reading', 'writing', 'stem-photo']

function clearLocalSession({ preserveDrafts = false } = {}) {
  wx.removeStorageSync('stemistSessionToken')
  wx.removeStorageSync('stemistUser')
  wx.removeStorageSync('stemistCropReturn')
  wx.removeStorageSync('stemistRetakeContext')
  wx.removeStorageSync('stemistCroppedImage')
  wx.removeStorageSync('stemistCoachContext')
  wx.removeStorageSync('stemistWritingPhoto')
  PRIVATE_SCOPES.forEach((scope) => {
    if (!preserveDrafts) wx.removeStorageSync(`stemistDraft:${scope}`)
    wx.removeStorageSync(`stemistSubmission:${scope}`)
  })
}

module.exports = { clearLocalSession }
