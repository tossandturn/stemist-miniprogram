const { deviceState, syncDevice } = require('../../utils/page')
const { routeById } = require('../../utils/stemRoutes')
const { fetchRouteInventory } = require('../../utils/inventory')
const { selectionState, generatePractice, saveSession, recentSession } = require('../../utils/nativePractice')

Page({
  data: deviceState({ routeId: '', stage: '', subjectCode: '', title: '', loading: true, busy: false, error: '',
    topics: [], selected: [], components: [], componentOptions: [], counts: [], questionCount: 10, availableCount: 0, canStart: false, hint: '', recentId: '', recentLabel: '' }),
  onLoad(options = {}) {
    this.__disposed = false
    this.__loadId = 0
    const route = routeById(String(options.routeId || ''))
    if (!route || !['IGCSE', 'IG', 'AS', 'A2'].includes(route.stage)) {
      this.setData({ loading: false, error: '当前路线不支持章节组卷。' }); return
    }
    this.setData({ routeId: route.routeId, stage: route.stage, subjectCode: route.subjectCode, title: route.subjectLabel.startsWith(route.stage) ? route.subjectLabel : `${route.stage} ${route.subjectLabel}` })
    this.refresh()
  },
  onShow() {
    syncDevice(this)
    const recent = recentSession(this.data.routeId)
    this.setData({ recentId: recent?.id || '', recentLabel: recent ? `继续上次练习 · ${Object.keys(recent.answers).length}/${recent.questions.length} 题已拍照` : '' })
  },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true; this.__loadId++ },
  async refresh() {
    if (!this.data.routeId || this.data.busy) return
    const loadId = ++this.__loadId
    this.setData({ loading: true, error: '' })
    try {
      const inventory = await fetchRouteInventory(this.data.routeId)
      if (this.__disposed || loadId !== this.__loadId) return
      this.__inventory = inventory
      const components = this.data.components.filter(c => inventory.paperComponents.includes(c))
      this.setData({ components: components.length ? components : inventory.paperComponents, selected: this.data.selected.filter(id => inventory.topics.some(t => t.id === id)) })
      this.recompute()
    } catch { if (!this.__disposed && loadId === this.__loadId) this.setData({ error: '章节加载失败，请检查网络后重试。' }) }
    finally { if (!this.__disposed && loadId === this.__loadId) this.setData({ loading: false }) }
  },
  recompute() {
    const { selected, components } = this.data
    let count = this.data.questionCount
    let state = selectionState(this.__inventory, selected, components, count)
    if (!state.sizes.includes(count) && state.sizes.length) count = state.sizes[state.sizes.length - 1]
    state = selectionState(this.__inventory, selected, components, count)
    this.setData({ questionCount: count, availableCount: state.availableCount, canStart: state.canStart, hint: state.hint,
      topics: (this.__inventory?.topics || []).map(t => ({ id: t.id, code: t.code || '', name: t.name, count: state.topicCounts[t.id] || 0, selected: selected.includes(t.id) })),
      componentOptions: (this.__inventory?.paperComponents || []).map(c => ({ value: c, label: `P${c}`, selected: components.includes(c) })),
      counts: [6, 10, 15].map(n => ({ value: n, selected: n === count, disabled: !state.sizes.includes(n) })),
    })
  },
  toggleTopic(event) {
    if (this.data.busy || this.data.loading) return
    const id = event.currentTarget.dataset.id
    if (!this.__inventory?.topics.some(t => t.id === id)) return
    const selected = this.data.selected.includes(id) ? this.data.selected.filter(t => t !== id) : [...this.data.selected, id]
    this.setData({ selected, error: '' }); this.recompute()
  },
  toggleComponent(event) {
    if (this.data.busy || this.data.loading) return
    const c = Number(event.currentTarget.dataset.value)
    if (!this.__inventory?.paperComponents.includes(c)) return
    const components = this.data.components.includes(c) ? this.data.components.filter(v => v !== c) : [...this.data.components, c]
    this.setData({ components, error: '' }); this.recompute()
  },
  chooseCount(event) {
    if (this.data.busy) return
    const questionCount = Number(event.currentTarget.dataset.count)
    if (!this.data.counts.some(c => c.value === questionCount && !c.disabled)) return
    this.setData({ questionCount }); this.recompute()
  },
  async start() {
    if (this.data.busy || this.data.loading || !this.data.canStart) return
    this.setData({ busy: true, error: '' })
    const spec = { routeId: this.data.routeId, stage: this.data.stage, subjectCode: this.data.subjectCode,
      syllabusTopicIds: this.data.selected.slice(), components: this.data.components.slice(), questionCount: this.data.questionCount }
    try {
      const session = await generatePractice(spec)
      if (this.__disposed) return
      saveSession(session)
      this.setData({ recentId: session.id, recentLabel: `继续上次练习 · 0/${session.questions.length} 题已拍照` })
      this.openSession(session.id)
    } catch (error) { if (!this.__disposed) this.setData({ error: error.statusCode === 409 ? '所选章节的可用题目已变化，请刷新后重新选择。' : error.message || '组卷失败，选择已保留，请重试。' }) }
    finally { if (!this.__disposed) this.setData({ busy: false }) }
  },
  openSession(sessionId) { wx.navigateTo({ url: `/pages/stem/practice?sessionId=${encodeURIComponent(sessionId)}`, fail: () => this.setData({ error: '练习已保存，暂未打开。请点继续练习重试。' }) }) },
  resume() { if (this.data.recentId && !this.data.busy) this.openSession(this.data.recentId) },
})
