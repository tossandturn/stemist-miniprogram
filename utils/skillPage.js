const { askCoach } = require('./api')
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
      loading: false,
      error: '',
      draftStatus: '自动保存已开启',
    }),

    onLoad() {
      const draft = readDraft(scope)
      if (draft && typeof draft.text === 'string' && draft.text) {
        this.setData({ text: draft.text, draftStatus: '已恢复上次草稿' })
      }
    },
    onShow() { syncDevice(this) },
    onResize() { syncDevice(this) },
    onUnload() { cancelDraft(this) },
    onInput(event) {
      const text = String(event.detail.value || '')
      this.setData({ text, error: '', draftStatus: text ? '正在自动保存…' : '自动保存已开启' })
      scheduleDraft(this, scope, { text })
    },
    async submit() {
      const text = this.data.text.trim()
      if (this.data.loading) return
      if (!text) return this.setData({ error: config.emptyError || '请先输入内容' })
      this.setData({ loading: true, error: '', answer: '' })
      try {
        const result = await askCoach({
          message: config.prompt(text),
          context: { product: 'IELTSist', skill: scope, inputMode: 'text', stage: 'practice', source: 'stemist-miniprogram' },
          imageDataUrls: [],
        })
        const answer = result.answer || result.message || 'AI 返回了空结果，请重试。'
        wx.setStorageSync(`stemistSubmission:${scope}`, { text, answer, submittedAt: Date.now() })
        clearDraft(scope)
        this.setData({ answer, draftStatus: '已提交 · 可继续追问' })
      } catch (error) {
        this.setData({ error: error.message || 'AI 请求失败，请稍后重试' })
      } finally { this.setData({ loading: false }) }
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
