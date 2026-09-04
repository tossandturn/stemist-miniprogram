const { deviceState, syncDevice } = require('../../utils/page')
const { categoryForSubject, familyForCategoryStage, normalizeStemCategory, routesForSubjectStage, stemCategoryProfile, subjectByCode, subjectsForCategory } = require('../../utils/stemCatalog')
const { routeById } = require('../../utils/stemRoutes')
const { fetchRouteInventory } = require('../../utils/inventory')

function subjectsForCategoryStage(category, stage) {
  return subjectsForCategory(category).filter((subject) => routesForSubjectStage(subject.code, stage).length > 0)
}

Page({
  data: deviceState({
    busy: false,
    error: '',
    returnPage: 'stem',
    isWriting: false,
    category: 'alevel',
    categoryLabel: 'A-Level 学科',
    family: 'exam',
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
    subjects: subjectsForCategory('alevel'),
    stages: stemCategoryProfile('alevel').stages,
  }),
  onLoad(options) {
    options = options || {}
    const isWriting = options.returnPage === 'writing'
    const saved = wx.getStorageSync('stemistRetakeContext') || null
    const savedCategory = saved && saved.category ? saved.category : (saved && saved.subjectCode ? categoryForSubject(saved.subjectCode) : '')
    const category = normalizeStemCategory(options.category || savedCategory || 'alevel')
    const profile = stemCategoryProfile(category)
    const stages = profile.stages.slice()
    const preferredStage = category === 'alevel' && stages.includes('AS') ? 'AS' : (stages[0] || '')
    const requestedStage = saved && stages.includes(saved.stage) ? saved.stage : preferredStage
    const subjects = subjectsForCategoryStage(category, requestedStage)
    const preferredCode = category === 'alevel' && subjects.some((subject) => subject.code === '9702') ? '9702' : subjects[0]?.code || ''
    const fallbackSubject = subjects.find((subject) => subject.code === preferredCode) || subjects[0] || null
    const savedSubject = saved && subjects.some((subject) => subject.code === String(saved.subjectCode || '')) ? subjects.find((subject) => subject.code === String(saved.subjectCode || '')) : fallbackSubject
    const initialRoutes = savedSubject ? routesForSubjectStage(savedSubject.code, requestedStage) : []
    const initialRoute = initialRoutes.find((route) => route.routeId === String(saved && saved.routeId || '')) || initialRoutes[0]
    this.setData({ returnPage: isWriting ? 'writing' : 'stem', isWriting, category, categoryLabel: profile.label, family: familyForCategoryStage(category, requestedStage), subjects, stages, subjectCode: savedSubject ? savedSubject.code : '', subjectLabel: savedSubject ? savedSubject.label : '', stage: requestedStage, routeOptions: initialRoutes, routeId: initialRoute ? initialRoute.routeId : '', selectedComponents: initialRoute ? initialRoute.components : '', canCapture: Boolean(initialRoute), inventory: null, inventoryTopics: [], showAllTopics: false, inventoryError: '' }, () => {
      if (isWriting) { wx.removeStorageSync('stemistRetakeContext'); return }
      wx.removeStorageSync('stemistRetakeContext')
      if (this.data.routeId) this.refreshInventory(this.data.routeId)
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
    const subjects = subjectsForCategoryStage(this.data.category, stage)
    const subject = subjects.some((item) => item.code === this.data.subjectCode) ? subjects.find((item) => item.code === this.data.subjectCode) : subjects[0]
    const routes = subject ? routesForSubjectStage(subject.code, stage) : []
    const route = routes[0]
    const routeId = route ? route.routeId : ''
    this.setData({ stage, family: familyForCategoryStage(this.data.category, stage), subjects, subjectCode: subject?.code || '', subjectLabel: subject?.label || '', routeOptions: routes, routeId, selectedComponents: route?.components || '', canCapture: Boolean(routes.length), inventory: null, inventoryTopics: [], showAllTopics: false, inventoryError: '', error: routes.length ? '' : '这个阶段暂时没有可用路线，请重新选择。' }, () => {
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
      category: this.data.category,
      family: this.data.family || familyForCategoryStage(this.data.category, this.data.stage),
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
