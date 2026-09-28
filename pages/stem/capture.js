const { deviceState, syncDevice } = require('../../utils/page')
const { categoryForSubject, familyForCategoryStage, normalizeStemCategory, routesForSubjectStage, stemCategoryProfile, subjectByCode, subjectsForCategory } = require('../../utils/stemCatalog')
const { routeById } = require('../../utils/stemRoutes')
const { fetchRouteInventory } = require('../../utils/inventory')
const owner=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0

function subjectsForCategoryStage(category, stage) {
  return subjectsForCategory(category).filter((subject) => routesForSubjectStage(subject.code, stage).length > 0)
}

function scopeState(category,saved=null){
  const profile=stemCategoryProfile(category),stages=profile.stages.slice(),preferredStage=category==='alevel'&&stages.includes('AS')?'AS':stages[0]||''
  const stage=saved&&stages.includes(saved.stage)?saved.stage:preferredStage,subjects=subjectsForCategoryStage(category,stage)
  const preferredCode=category==='alevel'&&subjects.some(subject=>subject.code==='9702')?'9702':subjects[0]?.code||''
  const fallback=subjects.find(subject=>subject.code===preferredCode)||subjects[0]||null
  const subject=saved&&subjects.some(item=>item.code===String(saved.subjectCode||''))?subjects.find(item=>item.code===String(saved.subjectCode||'')):fallback
  const routes=subject?routesForSubjectStage(subject.code,stage):[],route=routes.find(item=>item.routeId===String(saved?.routeId||''))||routes[0]
  return{category,categoryLabel:profile.label,family:familyForCategoryStage(category,stage),subjects,stages,subjectCode:subject?.code||'',subjectLabel:subject?.label||'',stage,routeOptions:routes,routeId:route?.routeId||'',selectedComponents:route?.components||'',canCapture:Boolean(route)}
}

Page({
  onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
  data: deviceState({
    busy: false,
    scopeExpanded: false,
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
    this.__disposed=false;this.__owner=owner();this.__epoch=epoch();this.__requestedCategory=String(options.category||'')
    const isWriting = options.returnPage === 'writing'
    const saved = wx.getStorageSync('stemistRetakeContext') || null
    const savedCategory = saved && saved.category ? saved.category : (saved && saved.subjectCode ? categoryForSubject(saved.subjectCode) : '')
    const category = normalizeStemCategory(options.category || savedCategory || 'alevel')
    this.setData({ returnPage: isWriting ? 'writing' : 'stem', isWriting,...scopeState(category,saved), inventory: null, inventoryTopics: [], showAllTopics: false, inventoryError: '' }, () => {
      if (isWriting) { wx.removeStorageSync('stemistRetakeContext'); return }
      wx.removeStorageSync('stemistRetakeContext')
      if (this.data.routeId) this.refreshInventory(this.data.routeId)
    })
  },
  onShow() {
    syncDevice(this)
    if(!this.current()){this.resetIdentity();return}
    // A successful capture hides this page while the crop page is open. Reset
    // the guard when the user comes back so a cancelled crop can be retried.
    if (this.data.busy) this.setData({ busy: false })
  },
  onUnload() { this.__disposed=true;this.__inventoryRequestId = (this.__inventoryRequestId || 0) + 1 },
  current(){return !this.__disposed&&this.__owner===owner()&&this.__epoch===epoch()},
  resetIdentity(){
    this.__inventoryRequestId=(this.__inventoryRequestId||0)+1;this.__owner=owner();this.__epoch=epoch();wx.removeStorageSync('stemistRetakeContext')
    const state=scopeState(normalizeStemCategory(this.__requestedCategory||'alevel'))
    this.setData({...state,busy:false,scopeExpanded:false,inventory:null,inventoryTopics:[],showAllTopics:false,inventoryLoading:false,inventoryError:'',error:'账号已变化，已重置为当前账号的默认拍摄路线。'},()=>{if(!this.data.isWriting&&this.data.routeId)this.refreshInventory(this.data.routeId)})
  },
  onResize() { syncDevice(this) },
  goBack() { wx.navigateBack() },
  toggleScope() { if(this.current())this.setData({ scopeExpanded: !this.data.scopeExpanded }) },
  chooseSubject(event) {
    if(!this.current())return
    const code = event.currentTarget.dataset.code
    const subject = this.data.subjects.find(item => item.code === code)
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
    if(!this.current())return
    const stage = event.currentTarget.dataset.stage
    if (!this.data.stages.includes(stage)) return
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
    if(!this.current())return
    const routeId = String(event.currentTarget.dataset.route || '')
    if (!this.data.routeOptions.some(item => item.routeId === routeId)) return
    this.setData({ routeId, selectedComponents: routeById(routeId)?.components || '', canCapture: Boolean(routeId), inventory: null, inventoryTopics: [], showAllTopics: false, inventoryError: '', error: '' }, () => this.refreshInventory(routeId))
  },
  refreshInventory(routeId) {
    if (routeId && typeof routeId === 'object') routeId = routeId.currentTarget?.dataset?.routeId
    if (!this.current() || this.data.isWriting || !routeId) return
    const requestId = (this.__inventoryRequestId || 0) + 1
    this.__inventoryRequestId = requestId
    this.setData({ inventoryLoading: true, inventoryError: '' })
    fetchRouteInventory(routeId)
      .then((inventory) => {
        if (!this.current() || this.__inventoryRequestId !== requestId) return
        if (!inventory) {
          this.setData({ inventory: null, inventoryTopics: [], inventoryError: '题库状态暂时不可用；仍可拍照，Coach 会按当前路线分析。' })
          return
        }
        this.setData({ inventory, inventoryTopics: inventory.topics.slice(0, 6), showAllTopics: false })
      })
      .catch(() => {
        if (!this.current() || this.__inventoryRequestId !== requestId) return
        // Inventory is informative and must never block the one-question
        // camera flow. Keep the capture CTA available when the API is down.
        this.setData({ inventory: null, inventoryError: '题库状态暂时不可用；仍可拍照，Coach 会按当前路线分析。' })
      })
      .finally(() => {
        if (this.current() && this.__inventoryRequestId === requestId) this.setData({ inventoryLoading: false })
      })
  },
  toggleTopics() {
    if (!this.current()||!this.data.inventory) return
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
    if (!this.current()||this.data.busy) return
    if (!this.data.isWriting && (!this.data.routeId || !this.data.canCapture)) {
      this.setData({ error: '请先选择一个有效的 STEM 学科、阶段和路线。' })
      return
    }
    this.setData({ busy: true, error: '' })
    wx.setStorageSync('stemistCameraReturn', { route: this.data.returnPage, context: this.captureContext(), createdAt: Date.now() })
    wx.navigateTo({
      url: '/pages/stem/camera',
      fail: () => this.setData({ busy: false, error: '无法打开相机，请返回重试。' }),
    })
  },
})
