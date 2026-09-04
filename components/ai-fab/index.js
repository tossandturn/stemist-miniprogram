Component({
  properties: {
    source: { type: String, value: 'unknown' },
    mode: { type: String, value: 'fixed' },
    routeId: { type: String, value: '' },
    stage: { type: String, value: '' },
    subjectCode: { type: String, value: '' },
  },
  methods: {
    openCoach() {
      const params = [
        ['source', String(this.data.source || 'unknown').slice(0, 40)],
        ['routeId', String(this.data.routeId || '').slice(0, 120)],
        ['stage', String(this.data.stage || '').slice(0, 30)],
        ['subjectCode', String(this.data.subjectCode || '').slice(0, 20)],
      ].filter(([, value]) => value).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
      wx.navigateTo({
        url: `/pages/coach/index?${params}`,
        fail: () => wx.redirectTo({ url: '/pages/coach/index' }),
      })
    },
  },
})
