const { deviceState, syncDevice, readDraft, scheduleDraft, clearDraft, cancelDraft } = require('../../utils/page')
const { runCoach } = require('../../utils/coach')
const { isAuthError } = require('../../utils/api')

const CONTEXTS = [
  { id: 'stem-photo', label: 'STEM photo', detail: '先拍题，再把证据交给 Coach。', page: '/pages/stem/capture', product: 'STEM Studio' },
  { id: 'listening', label: 'IELTS Listening', detail: '检查答案、单复数和听力陷阱。', page: '/pages/ielts/listening', product: 'IELTSist' },
  { id: 'reading', label: 'IELTS Reading', detail: '检查原文定位和证据链。', page: '/pages/ielts/reading', product: 'IELTSist' },
  { id: 'writing', label: 'IELTS Writing', detail: '按四项标准反馈；可打字或拍手写稿。', page: '/pages/ielts/writing', product: 'IELTSist' },
]

Page({
  data: deviceState({
    contexts: CONTEXTS,
    contextId: 'stem-photo',
    message: '',
    answer: '',
    warning: '',
    error: '',
    loading: false,
    coachStatus: '反馈状态待确认',
    canRetry: false,
    authRequired: false,
    draftStatus: '自动保存已开启',
    routeContext: {},
  }),
  onLoad(options) {
    this.__disposed = false
    const draft = readDraft('coach')
    const source = String(options && options.source || '').toLowerCase()
    const sourceContext = ['listening', 'reading', 'writing'].includes(source) ? source : ['stem-photo', 'capture', 'alevel', 'competition', 'papers', 'notebook', 'practice'].includes(source) ? 'stem-photo' : ''
    const next = {}
    const routeId = String(options && options.routeId || '').trim()
    const stage = String(options && options.stage || '').trim()
    const subjectCode = String(options && options.subjectCode || '').trim()
    if (routeId || stage || subjectCode) next.routeContext = { routeId, stage, subjectCode }
    if (sourceContext) next.contextId = sourceContext
    if (draft && typeof draft.message === 'string' && draft.message) { next.message = draft.message; next.draftStatus = '已恢复上次草稿' }
    if (Object.keys(next).length) this.setData(next)
  },
  onShow() {
    syncDevice(this)
    if (wx.getStorageSync('stemistSessionToken') && this.data.authRequired) this.setData({ authRequired: false, error: '' })
  },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true; cancelDraft(this) },
  chooseContext(event) {
    const contextId = String(event.currentTarget.dataset.context || '')
    if (!CONTEXTS.some((item) => item.id === contextId)) return
    this.setData({ contextId, answer: '', warning: '', error: '', authRequired: false })
  },
  onMessage(event) {
    const message = String(event.detail.value || '')
    this.setData({ message, error: '', authRequired: false, draftStatus: message ? '正在自动保存…' : '自动保存已开启' })
    scheduleDraft(this, 'coach', { message, contextId: this.data.contextId })
  },
  async submit() {
    const message = this.data.message.trim()
    if (this.data.loading) return
    if (!message) return this.setData({ error: '请先写下你想检查的步骤或问题。' })
    const selected = CONTEXTS.find((item) => item.id === this.data.contextId) || CONTEXTS[0]
    this.setData({ loading: true, error: '', canRetry: false, authRequired: false, answer: '', warning: '', coachStatus: '正在分析…' })
    try {
      const result = await runCoach({
        message,
        context: { product: selected.product, skill: selected.id, inputMode: 'text', stage: 'practice', source: 'stemist-miniprogram', ...(selected.id === 'stem-photo' ? this.data.routeContext : {}) },
      })
      if (this.__disposed) return
      const coachState = result.coachState || {}
      this.setData({ answer: result.answer || 'AI 返回了空结果，请重试。', warning: coachState.warning || '', coachStatus: coachState.label || '反馈状态待确认', draftStatus: '已提交 · 可继续追问' })
      wx.setStorageSync(`stemistSubmission:coach-${selected.id}`, { skill: selected.id, message, answer: result.answer || '', coachMode: result.mode || '', providerStatus: result.providerStatus || '', submittedAt: Date.now() })
      clearDraft('coach')
    } catch (error) {
      if (!this.__disposed) this.setData({ error: error.message || 'AI 暂时不可用，原始问题已保留。', canRetry: !isAuthError(error), authRequired: isAuthError(error), coachStatus: 'AI 暂不可用' })
    } finally { if (!this.__disposed) this.setData({ loading: false }) }
  },
  retry() { if (!this.data.loading) this.submit() },
  openContext(event) {
    const selected = CONTEXTS.find((item) => item.id === String(event.currentTarget.dataset.context || ''))
    if (selected) wx.navigateTo({ url: selected.page })
  },
  openAccount() { wx.navigateTo({ url: '/pages/account/auth' }) },
  clear() {
    if (this.data.loading) return
    clearDraft('coach')
    this.setData({ message: '', answer: '', warning: '', error: '', canRetry: false, authRequired: false, coachStatus: '反馈状态待确认', draftStatus: '已清空 · 自动保存已开启' })
  },
})
