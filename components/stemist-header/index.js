Component({
  properties: {
    eyebrow: { type: String, value: 'STEMIST' },
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    actionText: { type: String, value: '' },
    compact: { type: Boolean, value: false },
  },
  methods: { onAction() { this.triggerEvent('action') } },
})
