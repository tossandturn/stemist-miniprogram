const { runCoach } = require('../../utils/coach')
const { readAsJpegDataUrl } = require('../../utils/image')
const { deviceState, syncDevice, readDraft, scheduleDraft, clearDraft, cancelDraft } = require('../../utils/page')
const { isAuthError } = require('../../utils/api')

Page({
  data: deviceState({
    text: '', prompt: '', photoPath: '', taskType: 'Task 2', loading: false, error: '', canRetry: false, authRequired: false, answer: '', warning: '', coachStatus: '反馈状态待确认', draftStatus: '自动保存已开启',
  }),
  onLoad() {
    this.__disposed = false
    const draft = readDraft('writing')
    if (draft && (draft.text || draft.prompt || draft.photoPath)) this.setData({ text: draft.text || '', prompt: draft.prompt || '', photoPath: draft.photoPath || '', taskType: draft.taskType || 'Task 2', draftStatus: '已恢复上次草稿' })
  },
  onShow() {
    syncDevice(this)
    if (wx.getStorageSync('stemistSessionToken') && this.data.authRequired) this.setData({ authRequired: false, error: '' })
    const path = wx.getStorageSync('stemistWritingPhoto')
    if (path) { this.setData({ photoPath: path, error: '', draftStatus: '手写照片已加入草稿' }); scheduleDraft(this, 'writing', { text: this.data.text, prompt: this.data.prompt, taskType: this.data.taskType, photoPath: path }); wx.removeStorageSync('stemistWritingPhoto') }
  },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true; cancelDraft(this) },
  onInput(event) {
    const text = String(event.detail.value || '')
    this.setData({ text, error: '', authRequired: false, draftStatus: text ? '正在自动保存…' : '自动保存已开启' })
    scheduleDraft(this, 'writing', { text, prompt: this.data.prompt, taskType: this.data.taskType, photoPath: this.data.photoPath })
  },
  onPromptInput(event) {
    const prompt = String(event.detail.value || '')
    this.setData({ prompt, error: '', authRequired: false, draftStatus: prompt ? '正在自动保存…' : '自动保存已开启' })
    scheduleDraft(this, 'writing', { text: this.data.text, prompt, taskType: this.data.taskType, photoPath: this.data.photoPath })
  },
  chooseTask(event) { const taskType = event.currentTarget.dataset.task; this.setData({ taskType, error: '' }); scheduleDraft(this, 'writing', { text: this.data.text, prompt: this.data.prompt, taskType, photoPath: this.data.photoPath }) },
  takePhoto() {
    if (this.data.loading) return
    wx.navigateTo({
      url: '/pages/stem/capture?returnPage=writing',
      fail: (error) => this.setData({ error: error.errMsg || '无法打开拍照页，请重试' }),
    })
  },
  async submit() {
    const text = this.data.text.trim()
    if (this.data.loading) return
    if (!text && !this.data.photoPath) return this.setData({ error: '请先输入作文或拍照上传' })
    this.setData({ loading: true, error: '', canRetry: false, authRequired: false, answer: '', warning: '', coachStatus: '正在分析…' })
    try {
      const imageDataUrls = this.data.photoPath ? [await readAsJpegDataUrl(this.data.photoPath)] : []
      const prompt = this.data.prompt.trim()
      const message = text
        ? `IELTS ${this.data.taskType} 题目：\n${prompt || '(题目未提供，请只做语言层面反馈，不要宣称完整 Task 评分。)'}\n\n学生作文：\n${text}`
        : `请读取照片中的 IELTS ${this.data.taskType} 题目与手写作文，并按四项标准评分；如果题目或文字看不清，请明确要求重拍。`
      const result = await runCoach({ message, context: { product: 'IELTSist', skill: 'writing', taskType: this.data.taskType, promptProvided: Boolean(prompt), mode: imageDataUrls.length ? 'photo' : 'typed' }, imageDataUrls })
      if (this.__disposed) return
      const answer = result.answer || 'AI 返回了空结果，请重试。'
      wx.setStorageSync('stemistSubmission:writing', { text, prompt, photoPath: this.data.photoPath, taskType: this.data.taskType, answer, coachMode: result.mode || '', providerStatus: result.providerStatus || '', submittedAt: Date.now() })
      clearDraft('writing')
      const coachState = result.coachState || {}
      this.setData({ answer, warning: coachState.warning || '', coachStatus: coachState.label || '反馈状态待确认', draftStatus: '已提交 · 可继续追问' })
    } catch (error) { if (!this.__disposed) this.setData({ error: error.message || 'AI 暂时不可用，原始作文已保留。', canRetry: !isAuthError(error), authRequired: isAuthError(error), coachStatus: 'AI 暂不可用' }) }
    finally { if (!this.__disposed) this.setData({ loading: false }) }
  },
  retry() { if (!this.data.loading) this.submit() },
  openAccount() { wx.navigateTo({ url: '/pages/account/auth' }) },
  clear() {
    if (this.data.loading) return
    clearDraft('writing')
    wx.removeStorageSync('stemistWritingPhoto')
    this.setData({ text: '', prompt: '', photoPath: '', answer: '', warning: '', error: '', canRetry: false, authRequired: false, coachStatus: '反馈状态待确认', draftStatus: '已清空 · 自动保存已开启' })
  },
  openBack() { wx.navigateBack() },
})
