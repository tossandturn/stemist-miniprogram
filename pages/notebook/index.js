const { deviceState, syncDevice, scheduleDraft, cancelDraft } = require('../../utils/page')
const { getJson, requestJson } = require('../../utils/api')
const { STEM_ROUTES } = require('../../utils/stemRoutes')
const { categoryForRoute, familyForCategoryStage, normalizeStemCategory, stemCategoryProfile } = require('../../utils/stemCatalog')

const ROUTE_OPTIONS = STEM_ROUTES.map((route) => ({ ...route, pickerLabel: `${route.subjectLabel} · ${route.stage} · ${route.components}` }))

function routesForCategory(category) {
  const scope = normalizeStemCategory(category)
  return ROUTE_OPTIONS.filter((route) => categoryForRoute(route.routeId) === scope)
}

Page({
  data: deviceState({ category: 'alevel', categoryLabel: 'A-Level 学科', family: 'exam', routeId: 'cie-9702-as-physics', routeIndex: 0, stage: 'AS', subjectCode: '9702', note: '', saving: false, status: '本机自动保存已开启', error: '', routes: routesForCategory('alevel') }),
  onLoad(options) {
    this.__disposed = false
    this.__requestId = 0
    this.__editVersion = 0
    const requested = String(options && options.routeId || '')
    const inferredCategory = requested ? categoryForRoute(requested) : ''
    const category = normalizeStemCategory(options && options.category || inferredCategory || 'alevel')
    const routes = routesForCategory(category)
    const fallbackId = category === 'alevel' && routes.some((route) => route.routeId === 'cie-9702-as-physics') ? 'cie-9702-as-physics' : routes[0]?.routeId || ''
    const requestedIndex = routes.findIndex((route) => route.routeId === requested)
    const routeIndex = Math.max(0, requestedIndex >= 0 ? requestedIndex : routes.findIndex((route) => route.routeId === fallbackId))
    const route = routes[routeIndex]
    this.setData({ category, categoryLabel: stemCategoryProfile(category).label, family: familyForCategoryStage(category, route?.stage), routes, routeIndex, routeId: route?.routeId || '', stage: route?.stage || '', subjectCode: route?.subjectCode || '' }, () => this.loadNote())
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true; this.__requestId += 1; cancelDraft(this) },
  chooseRoute(event) {
    const routeId = String(event.currentTarget.dataset.route || '')
    this.selectRoute(routeId)
  },
  chooseRoutePicker(event) {
    const route = this.data.routes[Number(event.detail.value)]
    if (route) this.selectRoute(route.routeId)
  },
  selectRoute(routeId) {
    if (!routeId || this.data.saving) return
    const routeIndex = this.data.routes.findIndex((route) => route.routeId === routeId)
    if (routeIndex < 0) return
    cancelDraft(this)
    this.__editVersion += 1
    const route = this.data.routes[routeIndex]
    this.setData({ routeId, routeIndex, stage: route?.stage || '', subjectCode: route?.subjectCode || '', family: familyForCategoryStage(this.data.category, route?.stage), note: '', status: '正在读取这条路线的笔记…', error: '' }, () => this.loadNote())
  },
  loadNote() {
    const routeId = this.data.routeId
    const requestId = ++this.__requestId
    const editVersion = this.__editVersion
    const token = wx.getStorageSync('stemistSessionToken')
    const local = wx.getStorageSync(`stemistNotebook:${routeId}`)
    this.setData({ note: local && typeof local.body === 'string' ? local.body : '', status: local ? '已恢复本机笔记' : '本机自动保存已开启' })
    if (!token) return
    const current = () => !this.__disposed && requestId === this.__requestId && routeId === this.data.routeId && editVersion === this.__editVersion && token === wx.getStorageSync('stemistSessionToken')
    getJson(`/api/stem/notebook/notes?routeId=${encodeURIComponent(routeId)}`, { timeout: 8000 }).then((payload) => {
      if (!current()) return
      if (payload && payload.routeId && payload.routeId !== routeId) return
      const note = payload && payload.note
      if (local && local.dirty) { this.setData({ status: '本机有未同步笔记' }); return }
      if (note && (note.deleted || typeof note.body === 'string')) {
        const body = note.deleted ? '' : note.body
        wx.setStorageSync(`stemistNotebook:${routeId}`, { body, updatedAt: note.updatedAt, dirty: false })
        this.setData({ note: body, status: '已从账号恢复' })
      }
    }).catch(() => { if (current()) this.setData({ status: '本机笔记已保留 · 暂时无法读取云端' }) })
  },
  onInput(event) {
    const note = String(event.detail.value || '')
    this.__editVersion += 1
    wx.setStorageSync(`stemistNotebook:${this.data.routeId}`, { body: note, updatedAt: Date.now(), dirty: true })
    this.setData({ note, status: '已保存在本机', error: '' })
    scheduleDraft(this, `notebook:${this.data.routeId}`, { body: note })
  },
  async save() {
    if (this.data.saving) return
    const note = this.data.note.trim()
    const routeId = this.data.routeId
    const editVersion = this.__editVersion
    const token = wx.getStorageSync('stemistSessionToken')
    wx.setStorageSync(`stemistNotebook:${routeId}`, { body: note, updatedAt: Date.now(), dirty: true })
    if (!wx.getStorageSync('stemistSessionToken')) return this.setData({ status: '已保存到本机（登录后可同步）' })
    this.setData({ saving: true, error: '', status: '正在同步到账号…' })
    try {
      await requestJson(`/api/stem/notebook/notes/${encodeURIComponent(routeId)}`, { body: note }, { method: 'PUT', timeout: 8000 })
      if (!this.__disposed && routeId === this.data.routeId && token === wx.getStorageSync('stemistSessionToken') && editVersion === this.__editVersion) {
        wx.setStorageSync(`stemistNotebook:${routeId}`, { body: note, updatedAt: Date.now(), dirty: false })
        this.setData({ status: '已同步到账号' })
      }
    } catch (error) { if (!this.__disposed) this.setData({ status: '本机已保存', error: error.message || '云端同步失败，可稍后重试。' }) }
    finally { if (!this.__disposed) this.setData({ saving: false }) }
  },
  clear() {
    if (this.data.saving) return
    const routeId = this.data.routeId
    wx.showModal({ title: '清空这条笔记？', content: '当前路线的笔记将被清空，练习记录会保留。', confirmText: '清空', success: ({ confirm }) => {
      if (!confirm || this.__disposed || routeId !== this.data.routeId) return
      this.onInput({ detail: { value: '' } }); this.save()
    } })
  },
})
