const { discardPendingDrafts } = require('./page')
const PRIVATE_SCOPES = ['listening', 'reading', 'writing', 'speaking', 'stem-photo']

function clearLocalSession({ preserveDrafts = false } = {}) {
if(preserveDrafts){const id=wx.getStorageSync('stemistUser')?.id;if(id)wx.setStorageSync('stemistSessionMeta',{...(wx.getStorageSync('stemistSessionMeta')||{}),owner:String(id)})}
const speakingExport=wx.getStorageSync('stemistSpeakingExportPath')
const pendingWritingPhoto=wx.getStorageSync('stemistWritingPhoto')
const pendingStemPhoto=wx.getStorageSync('stemistCroppedImage')
const pendingCoachPhoto=wx.getStorageSync('stemistCoachPhoto')
const paperInputs=wx.getStorageSync('stemistWholePaperFiles')
wx.removeStorageSync('stemistSessionToken')
wx.removeStorageSync('stemistUser')
// Preserve on 401; erase owned drafts only on logout.
if (!preserveDrafts) {
wx.removeStorageSync('stemistNativeSessionCookie')
wx.removeStorageSync('stemistSessionMeta')
wx.removeStorageSync('stemistIeltsSessionState')
wx.setStorageSync('stemistPrivacyEpoch', (Number(wx.getStorageSync('stemistPrivacyEpoch')) || 0) + 1)
discardPendingDrafts()
wx.removeStorageSync('stemistWholePaperFiles')
wx.removeStorageSync('stemistCameraReturn')
wx.removeStorageSync('stemistCoachEntry')
wx.removeStorageSync('stemistCropReturn')
wx.removeStorageSync('stemistRetakeContext')
wx.removeStorageSync('stemistCroppedImage')
wx.removeStorageSync('stemistCroppedImageMeta')
wx.removeStorageSync('stemistCoachContext')
wx.removeStorageSync('stemistWritingPhoto')
wx.removeStorageSync('stemistWritingPhotoMeta')
wx.removeStorageSync('stemistCoachPhoto')
wx.removeStorageSync('stemistCoachPhotoMeta')
wx.removeStorageSync('stemistPendingAttemptSync')
}
PRIVATE_SCOPES.forEach((scope) => {
if (!preserveDrafts) wx.removeStorageSync(`stemistDraft:${scope}`)
wx.removeStorageSync(`stemistSubmission:${scope}`)
})
if (!preserveDrafts) {
const keys = wx.getStorageInfoSync ? (wx.getStorageInfoSync().keys || []) : []
const privatePhotos = keys.filter(key => /^stemistNative(?:Practice|Paper):/.test(key)).flatMap(key => Object.values(wx.getStorageSync(key)?.answers || {}).map(answer => answer.photo).filter(Boolean))
const writingPhotos=keys.filter(key=>/^stemistDraft:/.test(key)).flatMap(key=>{const draft=wx.getStorageSync(key)||{};return [draft.photoPath,...(draft.items||[]).map(item=>item.photo)].filter(Boolean)}).concat(pendingWritingPhoto||[],pendingStemPhoto||[])
keys.filter((key) => /^stemist(?:Notebook|Draft|Submission|NativePractice|NativeRecent|NativePaper|IeltsObjective|IeltsSpeaking|IeltsExam|VocabProgress|SavedWord|RecordIndex|Goal|CoachTurns):/.test(String(key))).forEach((key) => wx.removeStorageSync(key))
if (wx.env?.USER_DATA_PATH && wx.getFileSystemManager) {
try {
const fs = wx.getFileSystemManager()
const inputFolder=wx.env.USER_DATA_PATH+'/whole-paper-inputs/'
for(const f of Array.isArray(paperInputs)?paperInputs:[])if(typeof f?.path==='string'&&f.path.startsWith(inputFolder)&&/^paper-[a-z0-9-]+\.(pdf|jpg|png|webp)$/.test(f.path.slice(inputFolder.length)))fs.unlink({filePath:f.path,fail(){}})
const folder=wx.env.USER_DATA_PATH+'/marking-reports/'
const reports=wx.getStorageSync('stemistPaperReports')
for(const p of Array.isArray(reports)?reports:[])if(typeof p==='string'&&p.startsWith(folder)&&/^整卷批改_[\w\u4e00-\u9fff-]+_(作答原卷|批改报告)\.pdf$/.test(p.slice(folder.length)))fs.unlink({filePath:p,fail(){}})
wx.removeStorageSync('stemistPaperReports')
for(const folder of ['native-practice','native-paper']){
const directory=`${wx.env.USER_DATA_PATH}/${folder}`
privatePhotos.filter(path => String(path).startsWith(`${directory}/`) && /^mini-(?:set|paper)-[a-z0-9-]+\.jpg$/.test(String(path).slice(directory.length + 1))).forEach(filePath => fs.unlink({ filePath, fail() {} }))
}
if(speakingExport===`${wx.env.USER_DATA_PATH}/ielts-speaking-transcript.txt`)fs.unlink({filePath:speakingExport,fail(){}})
const writingDirectory=`${wx.env.USER_DATA_PATH}/native-writing/`
writingPhotos.filter(path=>String(path).startsWith(writingDirectory)&&/^writing-[a-z0-9-]+\.jpg$/.test(String(path).slice(writingDirectory.length))).forEach(filePath=>fs.unlink({filePath,fail(){}}))
const coachDirectory=`${wx.env.USER_DATA_PATH}/native-coach/`
if(String(pendingCoachPhoto||'').startsWith(coachDirectory)&&/^coach-[a-z0-9-]+\.jpg$/.test(String(pendingCoachPhoto).slice(coachDirectory.length)))fs.unlink({filePath:pendingCoachPhoto,fail(){}})
} catch { /* A device without stored photos has nothing to remove. */ }
}
wx.removeStorageSync('stemistSpeakingExportPath')
}
}

function adoptOwner(nextOwner,nativeCookie=''){
const priorOwner=String(wx.getStorageSync('stemistSessionMeta')?.owner||''),owner=String(nextOwner||'')
if(!priorOwner||!owner||priorOwner===owner)return false
clearLocalSession()
if(/^[a-zA-Z0-9_-]{32,128}$/.test(String(nativeCookie||'')))wx.setStorageSync('stemistNativeSessionCookie',nativeCookie)
return true
}

module.exports = { clearLocalSession,adoptOwner }
