const { askCoach } = require('../../utils/api')
const { readAsJpegDataUrl } = require('../../utils/image')
const { deviceState, syncDevice, readDraft, scheduleDraft, clearDraft, cancelDraft } = require('../../utils/page')

Page({
  data: deviceState({
    text: '', prompt: '', photoPath: '', taskType: 'Task 2', loading: false, error: '', answer: '', draftStatus: '自动保存已开启',
  }),
  onLoad() {
    const draft = readDraft('writing')
    if (draft && (draft.text || draft.prompt)) this.setData({ text: draft.text || '', prompt: draft.prompt || '', taskType: draft.taskType || 'Task 2', draftStatus: '已恢复上次草稿' })
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
    scheduleDraft(this, 'writing', { text, prompt: this.data.prompt, taskType: this.data.taskType })
  },
  onPromptInput(event) {
    const prompt = String(event.detail.value || '')
    this.setData({ prompt, error: '', draftStatus: prompt ? '正在自动保存…' : '自动保存已开启' })
    scheduleDraft(this, 'writing', { text: this.data.text, prompt, taskType: this.data.taskType })
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
      const prompt = this.data.prompt.trim()
      const message = text
        ? `IELTS ${this.data.taskType} 题目：\n${prompt || '(题目未提供，请只做语言层面反馈，不要宣称完整 Task 评分。)'}\n\n学生作文：\n${text}`
        : `请读取照片中的 IELTS ${this.data.taskType} 题目与手写作文，并按四项标准评分；如果题目或文字看不清，请明确要求重拍。`
      const result = await askCoach({ message, context: { product: 'IELTSist', skill: 'writing', taskType: this.data.taskType, promptProvided: Boolean(prompt), mode: imageDataUrls.length ? 'photo' : 'typed', stage: 'practice', source: 'stemist-miniprogram' }, imageDataUrls })
      const answer = result.answer || result.message || 'AI 返回了空结果，请重试。'
      wx.setStorageSync('stemistSubmission:writing', { text, prompt, photoPath: this.data.photoPath, taskType: this.data.taskType, answer, submittedAt: Date.now() })
      clearDraft('writing')
      this.setData({ answer, draftStatus: '已提交 · 可继续追问' })
    } catch (error) { this.setData({ error: error.message || 'AI 评分失败，请稍后重试' }) }
    finally { this.setData({ loading: false }) }
  },
  clear() {
    if (this.data.loading) return
    clearDraft('writing')
    this.setData({ text: '', prompt: '', photoPath: '', answer: '', error: '', draftStatus: '已清空 · 自动保存已开启' })
  },
  openBack() { wx.navigateBack() },
})
