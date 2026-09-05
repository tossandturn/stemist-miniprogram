const { runCoach } = require('./coach')
const { isAuthError } = require('./api')
const { deviceState, syncDevice, readDraft, scheduleDraft, clearDraft, cancelDraft } = require('./page')
const { ieltsWebUrl } = require('./ieltsCatalog')

function makeTextSkillPage(config) {
  const scope = String(config.skill)
  return {
    data: deviceState({
      skill: scope,
      eyebrow: config.eyebrow,
      title: config.title,
      subtitle: config.subtitle,
      contextTitle: config.contextTitle,
      contextText: config.contextText,
      placeholder: config.placeholder,
      submitLabel: config.submitLabel || '提交给 AI Coach',
      text: '',
      answer: '',
      warning: '',
      coachStatus: '',
      loading: false,
      error: '',
      draftStatus: '自动保存已开启',
      canRetry: false,
      authRequired: false,
      fullWorkspaceUrl: ieltsWebUrl(scope, { source: `mini-${scope}` }),
    }),

    onLoad() {
      this.__disposed = false
      const draft = readDraft(scope)
      if (draft && typeof draft.text === 'string' && draft.text) {
        this.setData({ text: draft.text, draftStatus: '已恢复上次草稿' })
      }
    },
    onShow() {
      syncDevice(this)
      if (wx.getStorageSync('stemistSessionToken') && this.data.authRequired) this.setData({ authRequired: false, error: '' })
    },
    onResize() { syncDevice(this) },
    onUnload() { this.__disposed = true; cancelDraft(this) },
    onInput(event) {
      const text = String(event.detail.value || '')
      this.setData({ text, error: '', authRequired: false, draftStatus: text ? '正在自动保存…' : '自动保存已开启' })
      scheduleDraft(this, scope, { text })
    },
    async submit() {
      const text = this.data.text.trim()
      if (this.data.loading) return
      if (!text) return this.setData({ error: config.emptyError || '请先输入内容' })
      this.__lastText = text
      this.setData({ loading: true, error: '', answer: '', warning: '', canRetry: false, authRequired: false, coachStatus: '正在分析…' })
      try {
        const result = await runCoach({
          message: config.prompt(text),
          context: { product: 'IELTSist', skill: scope, inputMode: 'text', stage: 'practice', source: 'stemist-miniprogram' },
          imageDataUrls: [],
        })
        if (this.__disposed) return
        const answer = result.answer || 'AI 返回了空结果，请重试。'
        wx.setStorageSync(`stemistSubmission:${scope}`, { category: 'ielts', skill: scope, text, answer, coachMode: result.mode || '', providerStatus: result.providerStatus || '', submittedAt: Date.now() })
        const receivedAi = result.mode === 'ai' && result.providerStatus === 'connected'
        if (receivedAi) clearDraft(scope)
        const coachState = result.coachState || {}
        this.setData({ answer, warning: coachState.warning || '', canRetry: !receivedAi, coachStatus: coachState.label || '反馈状态待确认', draftStatus: receivedAi ? '反馈已收到' : '草稿已保留' })
      } catch (error) {
        if (!this.__disposed) this.setData({ error: error.message || 'AI 暂时不可用，原始内容已保留。', canRetry: !isAuthError(error), authRequired: isAuthError(error), coachStatus: 'AI 暂不可用' })
      } finally { if (!this.__disposed) this.setData({ loading: false }) }
    },
    retry() { if (!this.data.loading && (this.data.text || this.__lastText)) this.submit() },
    clear() {
      if (this.data.loading) return
      clearDraft(scope)
      this.setData({ text: '', answer: '', warning: '', error: '', canRetry: false, authRequired: false, coachStatus: '', draftStatus: '已清空' })
    },
    openBack() { wx.navigateBack() },
    openFullWorkspace() {
      const url = this.data.fullWorkspaceUrl
      if (!url) return
      wx.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}`, fail: (error) => this.setData({ error: error.errMsg || '完整 IELTSist 工作区暂时无法打开。' }) })
    },
    openAccount() { wx.navigateTo({ url: '/pages/account/auth' }) },
  }
}

module.exports = { makeTextSkillPage }
