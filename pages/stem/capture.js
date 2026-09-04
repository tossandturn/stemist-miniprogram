const { deviceState, syncDevice } = require('../../utils/page')
const { routesForSubjectStage, STEM_SUBJECTS, STEM_STAGES, subjectByCode } = require('../../utils/stemCatalog')
const { routeById } = require('../../utils/stemRoutes')
const { fetchRouteInventory } = require('../../utils/inventory')

Page({
  data: deviceState({
    busy: false,
    error: '',
    returnPage: 'stem',
    isWriting: false,
    subjectCode: '9702',
    subjectLabel: 'Physics',
    stage: 'AS',
    routeId: 'cie-9702-as-physics',
    selectedComponents: 'P1 + P2 + P3',
    routeOptions: routesForSubjectStage('9702', 'AS'),
    canCapture: true,
    inventory: null,
    inventoryTopics: [],
    showAllTopics: false,
    inventoryLoading: false,
    inventoryError: '',
    subjects: STEM_SUBJECTS,
    stages: STEM_STAGES,
  }),
  onLoad(options) {
    options = options || {}
    const isWriting = options.returnPage === 'writing'
    this.setData({ returnPage: isWriting ? 'writing' : 'stem', isWriting }, () => {
      if (isWriting) return
      const saved = wx.getStorageSync('stemistRetakeContext') || null
      wx.removeStorageSync('stemistRetakeContext')
      if (!saved || !saved.subjectCode) {
        this.refreshInventory(this.data.routeId)
        return
      }
      const subject = subjectByCode(saved.subjectCode)
      const stage = STEM_STAGES.indexOf(saved.stage) >= 0 ? saved.stage : this.data.stage
      const routes = subject ? routesForSubjectStage(subject.code, stage) : this.data.routeOptions
      const routeId = routes.some((route) => route.routeId === saved.routeId) ? saved.routeId : (routes[0] ? routes[0].routeId : '')
      this.setData({ subjectCode: subject ? subject.code : this.data.subjectCode, subjectLabel: subject ? subject.label : this.data.subjectLabel, stage, routeOptions: routes, routeId, selectedComponents: routeById(routeId)?.components || '', canCapture: Boolean(routeId), inventory: null, inventoryTopics: [], showAllTopics: false, inventoryError: '' }, () => {
        if (routeId) this.refreshInventory(routeId)
      })
    })
  },
  onShow() {
    syncDevice(this)
    // A successful capture hides this page while the crop page is open. Reset
    // the guard when the user comes back so a cancelled crop can be retried.
    if (this.data.busy) this.setData({ busy: false })
  },
  onUnload() { this.__inventoryRequestId = (this.__inventoryRequestId || 0) + 1 },
  onResize() { syncDevice(this) },
  goBack() { wx.navigateBack() },
  chooseSubject(event) {
    const code = event.currentTarget.dataset.code
    const subject = subjectByCode(code)
    if (subject) {
      const routes = routesForSubjectStage(subject.code, this.data.stage)
      const route = routes[0]
      const routeId = route ? route.routeId : ''
      this.setData({ subjectCode: subject.code, subjectLabel: subject.label, routeOptions: routes, routeId, selectedComponents: route?.components || '', canCapture: Boolean(routes.length), inventory: null, inventoryTopics: [], showAllTopics: false, inventoryError: '', error: routes.length ? '' : '该学科没有这个阶段的有效路线，请重新选择。' }, () => {
        if (routeId) this.refreshInventory(routeId)
      })
    }
  },
  chooseStage(event) {
    const stage = event.currentTarget.dataset.stage
    const routes = routesForSubjectStage(this.data.subjectCode, stage)
    const route = routes[0]
    const routeId = route ? route.routeId : ''
    this.setData({ stage, routeOptions: routes, routeId, selectedComponents: route?.components || '', canCapture: Boolean(routes.length), inventory: null, inventoryTopics: [], showAllTopics: false, inventoryError: '', error: routes.length ? '' : '该学科没有这个阶段的有效路线，请重新选择。' }, () => {
      if (routeId) this.refreshInventory(routeId)
    })
  },
  chooseRoute(event) {
    const routeId = String(event.currentTarget.dataset.route || '')
    this.setData({ routeId, selectedComponents: routeById(routeId)?.components || '', canCapture: Boolean(routeId), inventory: null, inventoryTopics: [], showAllTopics: false, inventoryError: '', error: '' }, () => this.refreshInventory(routeId))
  },
  refreshInventory(routeId) {
    if (routeId && typeof routeId === 'object') routeId = routeId.currentTarget?.dataset?.routeId
    if (this.data.isWriting || !routeId) return
    const requestId = (this.__inventoryRequestId || 0) + 1
    this.__inventoryRequestId = requestId
    this.setData({ inventoryLoading: true, inventoryError: '' })
    fetchRouteInventory(routeId)
      .then((inventory) => {
        if (this.__inventoryRequestId !== requestId) return
        if (!inventory) {
          this.setData({ inventory: null, inventoryTopics: [], inventoryError: '题库状态暂时不可用；仍可拍照，Coach 会按当前路线分析。' })
          return
        }
        this.setData({ inventory, inventoryTopics: inventory.topics.slice(0, 6), showAllTopics: false })
      })
      .catch(() => {
        if (this.__inventoryRequestId !== requestId) return
        // Inventory is informative and must never block the one-question
        // camera flow. Keep the capture CTA available when the API is down.
        this.setData({ inventory: null, inventoryError: '题库状态暂时不可用；仍可拍照，Coach 会按当前路线分析。' })
      })
      .finally(() => {
        if (this.__inventoryRequestId === requestId) this.setData({ inventoryLoading: false })
      })
  },
  toggleTopics() {
    if (!this.data.inventory) return
    this.setData({ showAllTopics: !this.data.showAllTopics, inventoryTopics: this.data.showAllTopics ? this.data.inventory.topics.slice(0, 6) : this.data.inventory.topics })
  },
  cameraFailure(error) {
    const raw = String(error && error.errMsg || '')
    if (/auth deny|permission|authorize/i.test(raw)) {
      wx.showModal({
        title: '需要相机权限',
        content: '请在系统设置中允许 Stemist 使用相机，然后回来重试。',
        confirmText: '去设置',
        cancelText: '稍后',
        success: ({ confirm }) => { if (confirm && wx.openSetting) wx.openSetting({}) },
      })
      this.setData({ error: '相机权限未开启，请允许后重试。' })
      return
    }
    this.setData({ error: '相机暂时无法打开，请重试。' })
  },
  captureContext() {
    if (this.data.isWriting) return { product: 'IELTSist', skill: 'writing', mode: 'photo', stage: 'practice' }
    const routes = routesForSubjectStage(this.data.subjectCode, this.data.stage)
    const selectedRoute = routes.find((route) => route.routeId === this.data.routeId) || routes[0]
    return {
      product: 'STEM Studio',
      skill: 'stem-photo',
      subjectCode: this.data.subjectCode,
      subject: this.data.subjectLabel,
      stage: this.data.stage,
      qualification: this.data.stage === 'IGCSE' ? 'IGCSE' : (this.data.stage === 'Competition' || this.data.stage === 'Admissions' ? this.data.stage : 'Cambridge A Level'),
      routeId: selectedRoute ? selectedRoute.routeId : '',
      paperComponents: selectedRoute ? selectedRoute.components : '',
      mode: 'photo-question',
      source: 'stemist-miniprogram',
    }
  },
  takePhoto() {
    if (this.data.busy) return
    if (!this.data.isWriting && (!this.data.routeId || !this.data.canCapture)) {
      this.setData({ error: '请先选择一个有效的 STEM 学科、阶段和路线。' })
      return
    }
    this.setData({ busy: true, error: '' })
    wx.setStorageSync('stemistCameraReturn', { route: this.data.returnPage, context: this.captureContext(), createdAt: Date.now() })
    wx.navigateTo({
      url: '/pages/stem/camera',
      fail: (error) => this.setData({ busy: false, error: error.errMsg || '无法打开相机，请重试' }),
    })
  },
})
