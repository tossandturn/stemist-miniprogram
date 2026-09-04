const { deviceState, syncDevice, scheduleDraft, cancelDraft } = require('../../utils/page')
const { getJson, requestJson } = require('../../utils/api')
const { STEM_ROUTES } = require('../../utils/stemRoutes')

const ROUTE_OPTIONS = STEM_ROUTES.map((route) => ({ ...route, pickerLabel: `${route.subjectLabel} · ${route.stage} · ${route.components}` }))

Page({
  data: deviceState({ routeId: 'cie-9702-as-physics', routeIndex: 0, note: '', saving: false, status: '本机自动保存已开启', error: '', routes: ROUTE_OPTIONS }),
  onLoad(options) {
    this.__disposed = false
    const requested = String(options && options.routeId || '')
    const routeIndex = Math.max(0, ROUTE_OPTIONS.findIndex((route) => route.routeId === requested || route.routeId === this.data.routeId))
    this.setData({ routeIndex, routeId: ROUTE_OPTIONS[routeIndex]?.routeId || this.data.routeId }, () => this.loadNote())
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true; cancelDraft(this) },
  chooseRoute(event) {
    const routeId = String(event.currentTarget.dataset.route || '')
    this.selectRoute(routeId)
  },
  chooseRoutePicker(event) {
    const route = ROUTE_OPTIONS[Number(event.detail.value)]
    if (route) this.selectRoute(route.routeId)
  },
  selectRoute(routeId) {
    if (!routeId) return
    const routeIndex = Math.max(0, ROUTE_OPTIONS.findIndex((route) => route.routeId === routeId))
    this.setData({ routeId, routeIndex, note: '', status: '正在读取这条路线的笔记…', error: '' }, () => this.loadNote())
  },
  loadNote() {
    const local = wx.getStorageSync(`stemistNotebook:${this.data.routeId}`)
    this.setData({ note: local && typeof local.body === 'string' ? local.body : '', status: local ? '已恢复本机笔记' : '本机自动保存已开启' })
    if (!wx.getStorageSync('stemistSessionToken')) return
    getJson(`/api/stem/notebook/notes?routeId=${encodeURIComponent(this.data.routeId)}`, { timeout: 8000 }).then((payload) => {
      if (this.__disposed) return
      const note = payload && payload.note
      if (note && !note.deleted && typeof note.body === 'string') {
        wx.setStorageSync(`stemistNotebook:${this.data.routeId}`, { body: note.body, updatedAt: note.updatedAt })
        this.setData({ note: note.body, status: '已从账号恢复' })
      }
    }).catch(() => { if (!this.__disposed) this.setData({ status: '本机已保存 · 云端稍后重试' }) })
  },
  onInput(event) {
    const note = String(event.detail.value || '')
    wx.setStorageSync(`stemistNotebook:${this.data.routeId}`, { body: note, updatedAt: Date.now() })
    this.setData({ note, status: note ? '正在自动保存…' : '本机自动保存已开启', error: '' })
    scheduleDraft(this, `notebook:${this.data.routeId}`, { body: note })
  },
  async save() {
    if (this.data.saving) return
    const note = this.data.note.trim()
    wx.setStorageSync(`stemistNotebook:${this.data.routeId}`, { body: note, updatedAt: Date.now() })
    if (!wx.getStorageSync('stemistSessionToken')) return this.setData({ status: '已保存到本机（登录后可同步）' })
    this.setData({ saving: true, error: '', status: '正在同步到账号…' })
    try {
      await requestJson(`/api/stem/notebook/notes/${encodeURIComponent(this.data.routeId)}`, { body: note }, { method: 'PUT', timeout: 8000 })
      if (!this.__disposed) this.setData({ status: '已同步到账号' })
    } catch (error) { if (!this.__disposed) this.setData({ status: '本机已保存', error: error.message || '云端同步失败，可稍后重试。' }) }
    finally { if (!this.__disposed) this.setData({ saving: false }) }
  },
  clear() {
    if (this.data.saving) return
    wx.showModal({ title: '清空这条笔记？', content: '只会清空当前路线的笔记，不会删除练习记录。', confirmText: '清空', success: ({ confirm }) => { if (!confirm) return; wx.removeStorageSync(`stemistNotebook:${this.data.routeId}`); this.setData({ note: '', status: '已清空本机笔记', error: '' }); if (wx.getStorageSync('stemistSessionToken')) requestJson(`/api/stem/notebook/notes/${encodeURIComponent(this.data.routeId)}`, undefined, { method: 'DELETE', timeout: 8000 }).catch(() => {}) } })
  },
})
