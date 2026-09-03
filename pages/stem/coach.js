const { readAsJpegDataUrl } = require('../../utils/image')
const { askCoach } = require('../../utils/api')
const { deviceState, syncDevice } = require('../../utils/page')

Page({
  data: deviceState({ imagePath: '', message: '', loading: false, error: '', answer: '', context: {}, contextLabel: 'STEM route pending' }),
  onLoad(options) {
    options = options || {}
    const path = options.src ? decodeURIComponent(options.src) : wx.getStorageSync('stemistCroppedImage')
    const context = wx.getStorageSync('stemistCoachContext') || {}
    const label = context.subjectCode ? `${context.subject || context.subjectCode} · ${context.stage || 'stage pending'} · ${context.routeId || ''}` : 'STEM route pending'
    this.setData({ imagePath: path || '', context, contextLabel: label })
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onMessage(event) { this.setData({ message: event.detail.value, error: '' }) },
  async ask() {
    if (this.data.loading) return
    if (!this.data.imagePath) return this.setData({ error: '还没有题目照片，请先拍摄并裁剪' })
    this.setData({ loading: true, error: '', answer: '' })
    try {
      const dataUrl = await readAsJpegDataUrl(this.data.imagePath)
      const result = await askCoach({
        message: this.data.message.trim() || '请阅读这道 STEM 题和我的答案，指出第一处问题，并给出一个下一步提示。',
        imageDataUrls: [dataUrl],
        context: { ...this.data.context, stage: this.data.context.stage || 'practice' },
      })
      const answer = result.answer || result.message || 'AI 返回了空结果，请重试。'
      wx.setStorageSync('stemistSubmission:stem-photo', { skill: 'STEM AI Coach', routeId: this.data.context.routeId || '', answer, submittedAt: Date.now() })
      this.setData({ answer })
    } catch (error) { this.setData({ error: error.message || 'AI 请求失败，请稍后重试' }) }
    finally { this.setData({ loading: false }) }
  },
  retake() { wx.redirectTo({ url: '/pages/stem/capture' }) },
  goBack() { wx.navigateBack() },
})
