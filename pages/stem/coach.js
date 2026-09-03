const { readAsJpegDataUrl } = require('../../utils/image')
const { askCoach } = require('../../utils/api')

Page({
  data: { imagePath: '', message: '', loading: false, error: '', answer: '' },
  onLoad(options) {
    const path = options.src ? decodeURIComponent(options.src) : wx.getStorageSync('stemistCroppedImage')
    this.setData({ imagePath: path || '' })
  },
  onMessage(event) { this.setData({ message: event.detail.value }) },
  async ask() {
    if (this.data.loading || !this.data.imagePath) return
    this.setData({ loading: true, error: '', answer: '' })
    try {
      const dataUrl = await readAsJpegDataUrl(this.data.imagePath)
      const result = await askCoach({
        message: this.data.message || '请阅读这道 STEM 题和我的答案，指出第一处问题，并给出一个下一步提示。',
        imageDataUrls: [dataUrl],
        context: { product: 'STEM', mode: 'photo-question', source: 'stemist-miniprogram' },
      })
      this.setData({ answer: result.answer || result.message || 'AI 返回了空结果，请重试。' })
    } catch (error) {
      this.setData({ error: error.message || 'AI 请求失败，请稍后重试' })
    } finally {
      this.setData({ loading: false })
    }
  },
  retake() { wx.redirectTo({ url: '/pages/stem/capture' }) },
})
