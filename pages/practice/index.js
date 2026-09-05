const { deviceState, syncDevice } = require('../../utils/page')
const { fetchRouteInventory } = require('../../utils/inventory')
const { familyForCategoryStage, normalizeStemCategory, routesForSubjectStage, stemCategoryProfile, subjectsForCategory } = require('../../utils/stemCatalog')
const { IELTS_FEATURE_GROUPS, getIeltsFeature, ieltsWebUrl } = require('../../utils/ieltsCatalog')
const { routeById } = require('../../utils/stemRoutes')

const STEM_TOOLS = [
  { id: 'photo', label: '拍照问一题', detail: '拍照后裁剪', tone: 'photo' },
  { id: 'topics', label: '章节练习', detail: '按知识点练习', tone: 'topics' },
  { id: 'papers', label: '历年真题', detail: '选卷作答', tone: 'papers' },
  { id: 'exams', label: '模拟考试', detail: '计时、提交和复盘', tone: 'exams' },
  { id: 'progress', label: '学习进度', detail: '提交记录和下一步', tone: 'progress' },
  { id: 'notebook', label: '笔记本', detail: '整理错题与思路', tone: 'notebook' },
]

function categoryStages(category) {
  return stemCategoryProfile(category).stages.slice()
}

function subjectsForCategoryStage(category, stage) {
  return subjectsForCategory(category).filter((subject) => routesForSubjectStage(subject.code, stage).length > 0)
}

function normalizeCategory(value) {
  const candidate = String(value || '').toLowerCase()
  if (candidate === 'ielts') return 'ielts'
  if (candidate === 'stem') return 'alevel'
  return normalizeStemCategory(candidate)
}

function categoryPageCopy(category) {
  if (category === 'ielts') return { title: 'IELTSist 学习工作区', subtitle: '四项技能、整套模拟和学习资产都从这里进入。' }
  if (category === 'competition') return { title: '竞赛 / 入学考试工作区', subtitle: '选择独立题库路线，再开始一题一拍或完整练习。' }
  return { title: 'A-Level 学科工作区', subtitle: '选择学科、阶段和真实题库，再开始学习。' }
}

Page({
  data: deviceState({
    activeCategory: 'alevel',
    categoryProfile: stemCategoryProfile('alevel'),
    family: 'exam',
    pageTitle: categoryPageCopy('alevel').title,
    pageSubtitle: categoryPageCopy('alevel').subtitle,
    subjectCode: '9702',
    subjectLabel: 'Physics',
    stage: 'AS',
    routeId: 'cie-9702-as-physics',
    routeOptions: routesForSubjectStage('9702', 'AS'),
    subjects: subjectsForCategory('alevel'),
    stages: categoryStages('alevel'),
    inventory: null,
    inventoryTopics: [],
    inventoryLoading: false,
    inventoryError: '',
    ieltsGroups: IELTS_FEATURE_GROUPS.filter(group => group.id !== 'full').map(group => ({ ...group, features: group.features.filter(item => item.id !== 'coach') })),
    stemTools: STEM_TOOLS,
    error: '',
  }),

  onLoad(options) {
    this.__requestId = 0
    const activeCategory = normalizeCategory(options && options.category)
    if (activeCategory === 'competition') {
      this.setData({ activeCategory })
      wx.redirectTo({ url: '/pages/papers/index?category=competition' })
      return
    }
    const requestedRoute = routeById(String(options?.routeId || ''))
    const restoredRoute = requestedRoute && subjectsForCategory(activeCategory).some(item => item.code === requestedRoute.subjectCode) ? requestedRoute : null
    const stages = activeCategory === 'ielts' ? [] : categoryStages(activeCategory)
    const stage = activeCategory === 'ielts' ? '' : (restoredRoute?.stage || (stages.includes(this.data.stage) ? this.data.stage : stages[0] || ''))
    const subjects = activeCategory === 'ielts' ? [] : subjectsForCategoryStage(activeCategory, stage)
    const preferredCode = restoredRoute?.subjectCode || (subjects.some((item) => item.code === this.data.subjectCode) ? this.data.subjectCode : subjects[0]?.code || '')
    const routeOptions = preferredCode && stage ? routesForSubjectStage(preferredCode, stage) : []
    const route = routeOptions.find(item => item.routeId === restoredRoute?.routeId) || routeOptions[0]
    const copy = categoryPageCopy(activeCategory)
    this.setData({ activeCategory, categoryProfile: activeCategory === 'ielts' ? null : stemCategoryProfile(activeCategory), family: activeCategory === 'ielts' ? '' : familyForCategoryStage(activeCategory, stage), pageTitle: copy.title, pageSubtitle: copy.subtitle, subjects, stages, subjectCode: preferredCode, subjectLabel: subjects.find((item) => item.code === preferredCode)?.label || '', stage, routeOptions, routeId: route?.routeId || '', inventory: null, inventoryTopics: [], inventoryError: '' }, () => { if (activeCategory !== 'ielts' && route) this.refreshInventory(route.routeId) })
  },
  onShow() { syncDevice(this); if (this.data.activeCategory === 'alevel' && !this.data.inventoryLoading && !this.data.inventory) this.refreshInventory(this.data.routeId) },
  onResize() { syncDevice(this) },
  onUnload() { this.__requestId += 1 },

  chooseSubject(event) {
    const subject = this.data.subjects.find((item) => item.code === String(event.currentTarget.dataset.code || ''))
    if (!subject) return
    const routes = routesForSubjectStage(subject.code, this.data.stage)
    const route = routes[0]
    this.setData({ subjectCode: subject.code, subjectLabel: subject.label, routeOptions: routes, routeId: route ? route.routeId : '', inventory: null, inventoryTopics: [], inventoryError: '', error: route ? '' : '这个学科暂没有可用路线，请换一个阶段。' }, () => { if (route) this.refreshInventory(route.routeId) })
  },
  chooseStage(event) {
    const stage = String(event.currentTarget.dataset.stage || '')
    if (!this.data.stages.includes(stage)) return
    const subjects = subjectsForCategoryStage(this.data.activeCategory, stage)
    const subject = subjects.some((item) => item.code === this.data.subjectCode) ? subjects.find((item) => item.code === this.data.subjectCode) : subjects[0]
    const routes = subject ? routesForSubjectStage(subject.code, stage) : []
    const route = routes[0]
    this.setData({ stage, family: familyForCategoryStage(this.data.activeCategory, stage), subjects, subjectCode: subject?.code || '', subjectLabel: subject?.label || '', routeOptions: routes, routeId: route ? route.routeId : '', inventory: null, inventoryTopics: [], inventoryError: '', error: route ? '' : '这个阶段暂没有可用路线，请换一个学科。' }, () => { if (route) this.refreshInventory(route.routeId) })
  },
  chooseRoute(event) {
    const routeId = String(event.currentTarget.dataset.route || '')
    if (!this.data.routeOptions.some(route => route.routeId === routeId)) return
    this.setData({ routeId, inventory: null, inventoryTopics: [], inventoryError: '', error: '' }, () => this.refreshInventory(routeId))
  },
  refreshInventory(routeId) {
    if (routeId && typeof routeId === 'object') routeId = routeId.currentTarget?.dataset?.routeId
    const id = String(routeId || '').trim()
    if (!id || this.data.activeCategory !== 'alevel') return
    const requestId = ++this.__requestId
    this.setData({ inventoryLoading: true, inventoryError: '' })
    fetchRouteInventory(id).then((inventory) => {
      if (requestId !== this.__requestId) return
      if (!inventory) throw new Error('empty')
      this.setData({ inventory, inventoryTopics: inventory.topics.slice(0, 4) })
    }).catch(() => {
      if (requestId !== this.__requestId) return
      this.setData({ inventory: null, inventoryTopics: [], inventoryError: '题库状态暂不可用；仍可拍题，提交后由 Coach 分析。' })
    }).finally(() => { if (requestId === this.__requestId) this.setData({ inventoryLoading: false }) })
  },
  openStem() {
    wx.setStorageSync('stemistRetakeContext', { category: this.data.activeCategory, family: this.data.family || familyForCategoryStage(this.data.activeCategory, this.data.stage), subjectCode: this.data.subjectCode, subject: this.data.subjectLabel, stage: this.data.stage, routeId: this.data.routeId })
    wx.navigateTo({ url: '/pages/stem/capture', fail: () => this.setData({ error: '无法打开拍照页，请返回重试。' }) })
  },
  openIelts(event) {
    const skill = String(event && event.currentTarget && event.currentTarget.dataset && (event.currentTarget.dataset.skill || event.currentTarget.dataset.feature) || '')
    this.openIeltsFeature({ currentTarget: { dataset: { feature: skill } } })
  },
  openIeltsFeature(event) {
    const id = String(event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.feature || '')
    const feature = getIeltsFeature(id)
    if (!feature) return
    if (feature.nativePage) {
      wx.navigateTo({ url: feature.nativePage, fail: () => this.setData({ error: '暂时无法打开，请返回重试。' }) })
      return
    }
    const url = ieltsWebUrl(feature.id, { source: `mini-${feature.id}` })
    if (!url) return
    wx.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}`, fail: () => this.setData({ error: '暂时无法打开，请返回重试。' }) })
  },
  openCoach() { wx.navigateTo({ url: '/pages/coach/index?source=alevel&category=alevel&routeId='+encodeURIComponent(this.data.routeId)+'&stage='+encodeURIComponent(this.data.stage)+'&subjectCode='+encodeURIComponent(this.data.subjectCode) }) },
  openPapers() { wx.navigateTo({ url: `/pages/papers/index?category=${encodeURIComponent(this.data.activeCategory)}&subject=${encodeURIComponent(this.data.subjectCode)}` }) },
  openFullStudio() {
    if (this.data.activeCategory === 'ielts') {
      const url = ieltsWebUrl('full-workspace', { source: 'mini-full' })
      return wx.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}`, fail: () => this.setData({ error: '暂时无法打开，请返回重试。' }) })
    }
    const profile = this.data.categoryProfile || stemCategoryProfile(this.data.activeCategory)
    const family = familyForCategoryStage(this.data.activeCategory, this.data.stage)
    const url = `https://stem.ieltsist.com/today?routeId=${encodeURIComponent(this.data.routeId || '')}&stage=${encodeURIComponent(this.data.stage || '')}&category=${encodeURIComponent(this.data.activeCategory)}&family=${encodeURIComponent(family || profile.family)}&from=stemist`
    wx.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}`, fail: () => this.setData({ error: '暂时无法打开，请返回重试。' }) })
  },
  openStemTool(event) {
    const tool = String(event.currentTarget.dataset.tool || '')
    if (tool === 'photo') return this.openStem()
    if (tool === 'papers') return this.openPapers()
    if (tool === 'progress') return wx.navigateTo({ url: '/pages/progress/index' })
    if (tool === 'notebook') return wx.navigateTo({ url: `/pages/notebook/index?category=${encodeURIComponent(this.data.activeCategory)}&routeId=${encodeURIComponent(this.data.routeId || '')}` })
    const tab = tool === 'exams' ? 'exams' : 'topics'
    const profile = this.data.categoryProfile || stemCategoryProfile(this.data.activeCategory)
    const family = familyForCategoryStage(this.data.activeCategory, this.data.stage)
    const url = `https://stem.ieltsist.com/practice?tab=${tab}&routeId=${encodeURIComponent(this.data.routeId || '')}&stage=${encodeURIComponent(this.data.stage || '')}&category=${encodeURIComponent(this.data.activeCategory)}&family=${encodeURIComponent(family || profile.family)}&from=stemist`
    wx.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}`, fail: () => this.setData({ error: '暂时无法打开，请返回重试。' }) })
  },
})
