const { readAsJpegDataUrl } = require('../../utils/image')
const { runCoach } = require('../../utils/coach')
const { syncStemPhotoAttempt } = require('../../utils/attemptSync')
const { deviceState, syncDevice } = require('../../utils/page')

Page({
  data: deviceState({ imagePath: '', message: '', loading: false, error: '', answer: '', warning: '', coachStatus: '反馈状态待确认', syncStatus: '', syncFailed: false, syncing: false, context: {}, contextLabel: 'STEM route pending' }),
  onLoad(options) {
    this.__disposed = false
    options = options || {}
    let path = wx.getStorageSync('stemistCroppedImage')
    try { if (options.src) path = decodeURIComponent(options.src) } catch { path = '' }
    const context = wx.getStorageSync('stemistCoachContext') || {}
    const label = context.subjectCode ? `${context.subject || context.subjectCode} · ${context.stage || 'stage pending'} · ${context.routeId || ''}` : 'STEM route pending'
    this.setData({ imagePath: path || '', context, contextLabel: label })
  },
  onUnload() { this.__disposed = true },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onMessage(event) { this.setData({ message: event.detail.value, error: '' }) },
  async ask() {
    if (this.data.loading) return
    if (!this.data.imagePath) return this.setData({ error: '还没有题目照片，请先拍摄并裁剪' })
    this.setData({ loading: true, error: '', answer: '', warning: '', syncStatus: '', syncFailed: false, syncing: false, coachStatus: '正在分析…' })
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
      this.__pendingSync = { context: this.data.context, answer, coachMode: result.mode || '', providerStatus: result.providerStatus || '' }
      let syncStatus = ''
      let syncWarning = ''
      try {
        const synced = await syncStemPhotoAttempt(this.__pendingSync)
        syncStatus = synced && synced.skipped ? '' : '已同步到 STEM 学习记录'
        if (synced && synced.skipped) this.__pendingSync = null
      } catch {
        syncStatus = '反馈已显示 · 学习记录同步失败，可稍后重试'
        syncWarning = '本次 Coach 反馈已显示，但尚未写入云端学习记录。'
      }
      if (this.__disposed) return
      wx.setStorageSync('stemistSubmission:stem-photo', { skill: 'STEM AI Coach', routeId: this.data.context.routeId || '', answer, coachMode: result.mode || '', providerStatus: result.providerStatus || '', syncStatus, submittedAt: Date.now() })
      this.setData({ answer, warning: [coachState.warning || '', syncWarning].filter(Boolean).join('\n'), coachStatus: coachState.label || '反馈状态待确认', syncStatus, syncFailed: Boolean(syncWarning) })
    } catch (error) { if (!this.__disposed) this.setData({ error: error.message || 'AI 请求失败，请稍后重试' }) }
    finally { if (!this.__disposed) this.setData({ loading: false }) }
  },
  async retrySync() {
    if (this.data.loading || this.data.syncing || !this.__pendingSync) return
    this.setData({ syncing: true, syncStatus: '正在同步学习记录…' })
    try {
      await syncStemPhotoAttempt(this.__pendingSync)
      this.__pendingSync = null
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
