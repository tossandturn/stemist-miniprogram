const { askCoach } = require('../../utils/api')
const { readAsJpegDataUrl } = require('../../utils/image')
const { deviceState, syncDevice, readDraft, scheduleDraft, clearDraft, cancelDraft } = require('../../utils/page')

Page({
  data: deviceState({
    text: '', photoPath: '', taskType: 'Task 2', loading: false, error: '', answer: '', draftStatus: '自动保存已开启',
  }),
  onLoad() {
    const draft = readDraft('writing')
    if (draft && typeof draft.text === 'string' && draft.text) this.setData({ text: draft.text, draftStatus: '已恢复上次草稿' })
  },
  onShow() {
    syncDevice(this)
    const path = wx.getStorageSync('stemistWritingPhoto')
    if (path) { this.setData({ photoPath: path, error: '' }); wx.removeStorageSync('stemistWritingPhoto') }
  },
  onResize() { syncDevice(this) },
  onUnload() { cancelDraft(this) },
  onInput(event) {
    const text = String(event.detail.value || '')
    this.setData({ text, error: '', draftStatus: text ? '正在自动保存…' : '自动保存已开启' })
    scheduleDraft(this, 'writing', { text, taskType: this.data.taskType })
  },
  chooseTask(event) { this.setData({ taskType: event.currentTarget.dataset.task, error: '' }) },
  takePhoto() { wx.navigateTo({ url: '/pages/stem/capture?returnPage=writing' }) },
  async submit() {
    const text = this.data.text.trim()
    if (this.data.loading) return
    if (!text && !this.data.photoPath) return this.setData({ error: '请先输入作文或拍照上传' })
    this.setData({ loading: true, error: '', answer: '' })
    try {
      const imageDataUrls = this.data.photoPath ? [await readAsJpegDataUrl(this.data.photoPath)] : []
      const prompt = text || `请读取照片中的 IELTS ${this.data.taskType} 作文，并按四项标准评分，指出最重要的三处改进。`
      const result = await askCoach({ message: prompt, context: { product: 'IELTSist', skill: 'writing', taskType: this.data.taskType, mode: imageDataUrls.length ? 'photo' : 'typed', stage: 'practice', source: 'stemist-miniprogram' }, imageDataUrls })
      const answer = result.answer || result.message || 'AI 返回了空结果，请重试。'
      wx.setStorageSync('stemistSubmission:writing', { text, photoPath: this.data.photoPath, taskType: this.data.taskType, answer, submittedAt: Date.now() })
      clearDraft('writing')
      this.setData({ answer, draftStatus: '已提交 · 可继续追问' })
    } catch (error) { this.setData({ error: error.message || 'AI 评分失败，请稍后重试' }) }
    finally { this.setData({ loading: false }) }
  },
  clear() {
    if (this.data.loading) return
    clearDraft('writing')
    this.setData({ text: '', photoPath: '', answer: '', error: '', draftStatus: '已清空 · 自动保存已开启' })
  },
  openBack() { wx.navigateBack() },
})
