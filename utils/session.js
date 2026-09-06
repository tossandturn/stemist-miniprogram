const { discardPendingDrafts } = require('./page')
const PRIVATE_SCOPES = ['listening', 'reading', 'writing', 'speaking', 'stem-photo']

function clearLocalSession({ preserveDrafts = false } = {}) {
  const speakingExport=wx.getStorageSync('stemistSpeakingExportPath')
  const pendingWritingPhoto=wx.getStorageSync('stemistWritingPhoto')
  const pendingStemPhoto=wx.getStorageSync('stemistCroppedImage')
  wx.removeStorageSync('stemistSessionToken')
  wx.removeStorageSync('stemistUser')
  // A 401 clears only the expired identity. Preserve the in-progress photo,
  // crop context and pending sync so the learner can sign back in and retry
  // without taking the question again. Explicit logout still removes all
  // private evidence and drafts for shared-device safety.
  if (!preserveDrafts) {
    wx.removeStorageSync('stemistNativeSessionCookie')
    wx.removeStorageSync('stemistSessionMeta')
    wx.removeStorageSync('stemistIeltsSessionState')
    wx.setStorageSync('stemistPrivacyEpoch', (Number(wx.getStorageSync('stemistPrivacyEpoch')) || 0) + 1)
    discardPendingDrafts()
    wx.removeStorageSync('stemistCameraReturn')
    wx.removeStorageSync('stemistCoachEntry')
    wx.removeStorageSync('stemistCropReturn')
    wx.removeStorageSync('stemistRetakeContext')
    wx.removeStorageSync('stemistCroppedImage')
    wx.removeStorageSync('stemistCroppedImageMeta')
    wx.removeStorageSync('stemistCoachContext')
    wx.removeStorageSync('stemistWritingPhoto')
    wx.removeStorageSync('stemistWritingPhotoMeta')
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
    const privatePhotos = keys.filter(key => /^stemistNative(?:Practice|Paper):/.test(key)).flatMap(key => Object.values(wx.getStorageSync(key)?.answers || {}).map(answer => answer.photo).filter(Boolean))
    const writingPhotos=keys.filter(key=>/^stemistDraft:/.test(key)).flatMap(key=>{const draft=wx.getStorageSync(key)||{};return [draft.photoPath,...(draft.items||[]).map(item=>item.photo)].filter(Boolean)}).concat(pendingWritingPhoto||[],pendingStemPhoto||[])
    keys.filter((key) => /^stemist(?:Notebook|Draft|Submission|NativePractice|NativeRecent|NativePaper|IeltsObjective|IeltsSpeaking|IeltsExam|VocabProgress|SavedWord|RecordIndex|Goal|CoachTurns):/.test(String(key))).forEach((key) => wx.removeStorageSync(key))
    // Only our app-private answer copies are deleted; original camera files
    // and unrelated folders are never touched.
    if (wx.env?.USER_DATA_PATH && wx.getFileSystemManager) {
      try {
        const fs = wx.getFileSystemManager()
        for(const folder of ['native-practice','native-paper']){
          const directory=`${wx.env.USER_DATA_PATH}/${folder}`
          privatePhotos.filter(path => String(path).startsWith(`${directory}/`) && /^mini-(?:set|paper)-[a-z0-9-]+\.jpg$/.test(String(path).slice(directory.length + 1))).forEach(filePath => fs.unlink({ filePath, fail() {} }))
        }
        if(speakingExport===`${wx.env.USER_DATA_PATH}/ielts-speaking-transcript.txt`)fs.unlink({filePath:speakingExport,fail(){}})
        const writingDirectory=`${wx.env.USER_DATA_PATH}/native-writing/`
        writingPhotos.filter(path=>String(path).startsWith(writingDirectory)&&/^writing-[a-z0-9-]+\.jpg$/.test(String(path).slice(writingDirectory.length))).forEach(filePath=>fs.unlink({filePath,fail(){}}))
      } catch { /* A device without stored photos has nothing to remove. */ }
    }
    wx.removeStorageSync('stemistSpeakingExportPath')
  }
}

module.exports = { clearLocalSession }
