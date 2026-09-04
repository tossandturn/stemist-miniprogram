const { readAsJpegDataUrl } = require('../../utils/image')
const { runCoach } = require('../../utils/coach')
const { nextAttemptId, syncStemPhotoAttempt } = require('../../utils/attemptSync')
const { deviceState, syncDevice } = require('../../utils/page')
const { isAuthError } = require('../../utils/api')

Page({
  data: deviceState({ imagePath: '', message: '', loading: false, error: '', canRetry: false, authRequired: false, answer: '', warning: '', coachStatus: '反馈状态待确认', syncStatus: '', syncFailed: false, syncing: false, context: {}, contextLabel: '等待题目范围' }),
  onLoad(options) {
    this.__disposed = false
    options = options || {}
    let path = wx.getStorageSync('stemistCroppedImage')
    try { if (options.src) path = decodeURIComponent(options.src) } catch { path = '' }
    const context = wx.getStorageSync('stemistCoachContext') || {}
    const scope = context.category === 'competition' ? '竞赛 / 入学考试' : context.category === 'alevel' ? 'A-Level 学科' : ''
    const label = context.subjectCode ? `${scope ? `${scope} · ` : ''}${context.subject || context.subjectCode} · ${context.stage || '阶段待定'}${context.paperComponents ? ` · ${context.paperComponents}` : ''}` : '等待题目范围'
    const pendingSync = wx.getStorageSync('stemistPendingAttemptSync') || null
    this.__pendingSync = pendingSync
    this.setData({ imagePath: path || '', context, contextLabel: label, syncFailed: Boolean(pendingSync), syncStatus: pendingSync ? '上次反馈尚未同步' : '' })
  },
  onUnload() { this.__disposed = true },
  onShow() {
    syncDevice(this)
    if (wx.getStorageSync('stemistSessionToken') && this.data.authRequired) this.setData({ authRequired: false, error: '' })
  },
  onResize() { syncDevice(this) },
  onMessage(event) { this.setData({ message: event.detail.value, error: '', authRequired: false }) },
  async ask() {
    if (this.data.loading) return
    if (!this.data.imagePath) return this.setData({ error: '还没有题目照片，请先拍摄并裁剪' })
    this.setData({ loading: true, error: '', canRetry: false, authRequired: false, answer: '', warning: '', syncStatus: '', syncFailed: false, syncing: false, coachStatus: '正在分析…' })
    try {
      const dataUrl = await readAsJpegDataUrl(this.data.imagePath)
      if (this.__disposed) return
      const result = await runCoach({
        message: this.data.message.trim() || '请阅读这道 STEM 题和我的答案，指出第一处问题，并给出一个下一步提示。',
        imageDataUrls: [dataUrl],
        context: { ...this.data.context, stage: this.data.context.stage || 'practice' },
      })
      if (this.__disposed) return
      const answer = result.answer || 'AI 返回了空结果，请重试。'
      const coachState = result.coachState || {}
      this.__coachWarning = coachState.warning || ''
      this.__pendingSync = { attemptId: nextAttemptId(), context: this.data.context, answer, coachMode: result.mode || '', providerStatus: result.providerStatus || '' }
      wx.setStorageSync('stemistPendingAttemptSync', this.__pendingSync)
      let syncStatus = ''
      let syncWarning = ''
      let syncedAttemptId = ''
      try {
        const synced = await syncStemPhotoAttempt(this.__pendingSync)
        if (synced && synced.skipped) {
          syncStatus = '反馈已显示 · 登录后可同步学习记录'
          syncWarning = '本次 Coach 反馈已保存在本机；登录后可重新同步。'
        } else {
          syncStatus = '已同步到 STEM 学习记录'
          syncedAttemptId = String(synced && (synced.clientAttemptId || synced.attempt?.attemptId) || this.__pendingSync.attemptId || '')
          this.__pendingSync = null
          wx.removeStorageSync('stemistPendingAttemptSync')
        }
      } catch {
        syncStatus = '反馈已显示 · 学习记录同步失败，可稍后重试'
        syncWarning = '本次 Coach 反馈已显示，但尚未写入云端学习记录。'
      }
      if (this.__disposed) return
      wx.setStorageSync('stemistSubmission:stem-photo', { skill: 'STEM AI Coach', category: this.data.context.category || '', family: this.data.context.family || '', routeId: this.data.context.routeId || '', stage: this.data.context.stage || '', subjectCode: this.data.context.subjectCode || '', subject: this.data.context.subject || '', answer, attemptId: syncedAttemptId || this.__pendingSync?.attemptId || '', coachMode: result.mode || '', providerStatus: result.providerStatus || '', syncStatus, submittedAt: Date.now() })
      this.setData({ answer, warning: [coachState.warning || '', syncWarning].filter(Boolean).join('\n'), coachStatus: coachState.label || '反馈状态待确认', syncStatus, syncFailed: Boolean(syncWarning) })
    } catch (error) { if (!this.__disposed) this.setData({ error: error.message || 'AI 暂时不可用，原始照片已保留。', canRetry: !isAuthError(error), authRequired: isAuthError(error), coachStatus: 'AI 暂不可用' }) }
    finally { if (!this.__disposed) this.setData({ loading: false }) }
  },
  retry() { if (!this.data.loading) this.ask() },
  openAccount() { wx.navigateTo({ url: '/pages/account/auth' }) },
  async retrySync() {
    if (this.data.loading || this.data.syncing || !this.__pendingSync) return
    this.setData({ syncing: true, syncStatus: '正在同步学习记录…' })
    try {
      const synced = await syncStemPhotoAttempt(this.__pendingSync)
      const previous = wx.getStorageSync('stemistSubmission:stem-photo') || {}
      wx.setStorageSync('stemistSubmission:stem-photo', { ...previous, attemptId: String(synced && (synced.clientAttemptId || synced.attempt?.attemptId) || this.__pendingSync.attemptId || ''), syncStatus: '已同步到 STEM 学习记录' })
      this.__pendingSync = null
      wx.removeStorageSync('stemistPendingAttemptSync')
      this.setData({ syncing: false, syncFailed: false, syncStatus: '已同步到 STEM 学习记录', warning: this.__coachWarning || '' })
    } catch {
      this.setData({ syncing: false, syncFailed: true, syncStatus: '反馈已显示 · 学习记录同步仍失败，请稍后重试' })
    }
  },
  retake() {
    wx.setStorageSync('stemistRetakeContext', this.data.context || {})
    wx.redirectTo({ url: '/pages/stem/capture' })
  },
  goBack() { wx.navigateBack() },
})
