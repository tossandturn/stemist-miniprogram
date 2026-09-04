Component({
  properties: {
    text: { type: String, value: '' },
    answer: { type: String, value: '' },
    warning: { type: String, value: '' },
    loading: { type: Boolean, value: false },
    error: { type: String, value: '' },
    placeholder: { type: String, value: '' },
    submitLabel: { type: String, value: '提交给 AI Coach' },
    contextTitle: { type: String, value: '你的记录' },
    contextText: { type: String, value: '' },
    draftStatus: { type: String, value: '自动保存已开启' },
    status: { type: String, value: '反馈状态待确认' },
    canRetry: { type: Boolean, value: false },
    authRequired: { type: Boolean, value: false },
  },
  methods: {
    onInput(event) { this.triggerEvent('input', { value: event.detail.value }) },
    onSubmit() { if (!this.data.loading) this.triggerEvent('submit') },
    onClear() { this.triggerEvent('clear') },
    onRetry() { if (!this.data.loading && this.data.canRetry) this.triggerEvent('retry') },
    onAccount() { this.triggerEvent('account') },
  },
})
