const { askCoach } = require('../../utils/api')
const { readAsJpegDataUrl } = require('../../utils/image')
Page({
  data: { text: '', photoPath: '', loading: false, error: '', answer: '' },
  onInput(e) { this.setData({ text: e.detail.value }) },
  takePhoto() { wx.navigateTo({ url: '/pages/stem/capture?returnPage=writing' }) },
  async submit() {
    if (this.data.loading || (!this.data.text.trim() && !this.data.photoPath)) return this.setData({ error: '请先输入作文或拍照上传' })
    this.setData({ loading: true, error: '', answer: '' })
    try {
      const imageDataUrls = this.data.photoPath ? [await readAsJpegDataUrl(this.data.photoPath)] : []
      const r = await askCoach({ message: this.data.text.trim() || '请读取照片中的 IELTS 作文并按四项标准评分，指出最重要的三处改进。', context: { product: 'IELTSist', skill: 'writing', mode: imageDataUrls.length ? 'photo' : 'typed' }, imageDataUrls })
      this.setData({ answer: r.answer || r.message || 'AI 返回了空结果' })
    } catch (e) { this.setData({ error: e.message || 'AI 评分失败，请稍后重试' }) } finally { this.setData({ loading: false }) }
  },
  onShow() { const path = wx.getStorageSync('stemistWritingPhoto'); if (path) { this.setData({ photoPath: path }); wx.removeStorageSync('stemistWritingPhoto') } },
})
