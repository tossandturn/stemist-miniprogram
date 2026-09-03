const { runCoach } = require('./coach')
const { deviceState, syncDevice, readDraft, scheduleDraft, clearDraft, cancelDraft } = require('./page')

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
      coachStatus: '反馈状态待确认',
      loading: false,
      error: '',
      draftStatus: '自动保存已开启',
    }),

    onLoad() {
      this.__disposed = false
      const draft = readDraft(scope)
      if (draft && typeof draft.text === 'string' && draft.text) {
        this.setData({ text: draft.text, draftStatus: '已恢复上次草稿' })
      }
    },
    onShow() { syncDevice(this) },
    onResize() { syncDevice(this) },
    onUnload() { this.__disposed = true; cancelDraft(this) },
    onInput(event) {
      const text = String(event.detail.value || '')
      this.setData({ text, error: '', draftStatus: text ? '正在自动保存…' : '自动保存已开启' })
      scheduleDraft(this, scope, { text })
    },
    async submit() {
      const text = this.data.text.trim()
      if (this.data.loading) return
      if (!text) return this.setData({ error: config.emptyError || '请先输入内容' })
      this.setData({ loading: true, error: '', answer: '', warning: '', coachStatus: '正在分析…' })
      try {
        const result = await runCoach({
          message: config.prompt(text),
          context: { product: 'IELTSist', skill: scope, inputMode: 'text', stage: 'practice', source: 'stemist-miniprogram' },
          imageDataUrls: [],
        })
        if (this.__disposed) return
        const answer = result.answer || 'AI 返回了空结果，请重试。'
        wx.setStorageSync(`stemistSubmission:${scope}`, { text, answer, coachMode: result.mode || '', providerStatus: result.providerStatus || '', submittedAt: Date.now() })
        clearDraft(scope)
        const coachState = result.coachState || {}
        this.setData({ answer, warning: coachState.warning || '', coachStatus: coachState.label || '反馈状态待确认', draftStatus: '已提交 · 可继续追问' })
      } catch (error) {
        if (!this.__disposed) this.setData({ error: error.message || 'AI 请求失败，请稍后重试' })
      } finally { if (!this.__disposed) this.setData({ loading: false }) }
    },
    clear() {
      if (this.data.loading) return
      clearDraft(scope)
      this.setData({ text: '', answer: '', error: '', draftStatus: '已清空 · 自动保存已开启' })
    },
    openBack() { wx.navigateBack() },
    openAccount() { wx.navigateTo({ url: '/pages/account/auth' }) },
  }
}

module.exports = { makeTextSkillPage }
