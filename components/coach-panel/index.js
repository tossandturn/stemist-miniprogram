Component({
  properties: {
    message: { type: String, value: '' },
    answer: { type: String, value: '' },
    warning: { type: String, value: '' },
    status: { type: String, value: '反馈状态待确认' },
    loading: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    placeholder: { type: String, value: '告诉 AI Coach 你想检查什么（可选）' },
    submitLabel: { type: String, value: '提交给 AI Coach' },
    helper: { type: String, value: 'AI Coach 会基于当前证据给出下一步建议。' },
    error: { type: String, value: '' },
    canRetry: { type: Boolean, value: false },
    authRequired: { type: Boolean, value: false },
  },
  methods: {
    onInput(event) { this.triggerEvent('input', { value: event.detail.value }) },
    onSubmit() { if (!this.data.disabled && !this.data.loading) this.triggerEvent('submit') },
    onRetry() { if (!this.data.disabled && !this.data.loading && this.data.canRetry) this.triggerEvent('retry') },
    onAccount() { this.triggerEvent('account') },
  },
})
