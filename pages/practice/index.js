const { deviceState, syncDevice } = require('../../utils/page')
const { fetchRouteInventory } = require('../../utils/inventory')
const { routesForSubjectStage, subjectsForCategory } = require('../../utils/stemCatalog')

const IELTS_SKILLS = [
  { id: 'listening', label: 'Listening', detail: '文本答案、陷阱与下一步练习', tone: 'listening' },
  { id: 'reading', label: 'Reading', detail: '原文定位、证据链和判断', tone: 'reading' },
  { id: 'writing', label: 'Writing', detail: '打字或拍一页手写作文', tone: 'writing' },
  { id: 'speaking', label: 'Speaking', detail: 'IELTSist 实时口语 examiner', tone: 'speaking' },
]

const ENTRY_CATEGORIES = [
  { id: 'alevel', label: 'A-Level 学科', detail: 'IGCSE · AS · A2 路线' },
  { id: 'ielts', label: 'IELTS', detail: '四项技能 · IELTSist' },
  { id: 'competition', label: '竞赛 / 入学', detail: 'BPhO · AMC 12 · ESAT · TMUA' },
]

const STEM_TOOLS = [
  { id: 'photo', label: '拍题并交给 AI', detail: '拍照、裁剪、获得逐步反馈', tone: 'photo' },
  { id: 'topics', label: 'Topic 练习', detail: '章节、真题来源和学习内容', tone: 'topics' },
  { id: 'papers', label: '完整真题', detail: 'QP / MS 配对目录和原卷', tone: 'papers' },
  { id: 'exams', label: '模拟考试', detail: '计时、提交和复盘', tone: 'exams' },
  { id: 'progress', label: '学习进度', detail: '提交记录和下一步', tone: 'progress' },
  { id: 'notebook', label: 'Notebook', detail: '按路线保存私人复盘', tone: 'notebook' },
]

function categoryStages(category) {
  return category === 'competition' ? ['Competition', 'Admissions'] : ['IGCSE', 'AS', 'A2']
}

function normalizeCategory(value) {
  const candidate = String(value || '').toLowerCase()
  if (candidate === 'stem' || candidate === 'alevel') return 'alevel'
  if (candidate === 'competition' || candidate === 'admissions') return 'competition'
  return candidate === 'ielts' ? 'ielts' : 'alevel'
}

Page({
  data: deviceState({
    activeCategory: 'alevel',
    entryCategories: ENTRY_CATEGORIES,
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
    ieltsSkills: IELTS_SKILLS,
    stemTools: STEM_TOOLS,
    error: '',
  }),

  onLoad(options) {
    this.__requestId = 0
    const activeCategory = normalizeCategory(options && options.category)
    const subjects = subjectsForCategory(activeCategory)
    const preferredCode = subjects.some((item) => item.code === this.data.subjectCode) ? this.data.subjectCode : subjects[0]?.code || ''
    const stages = activeCategory === 'ielts' ? [] : categoryStages(activeCategory)
    const stage = stages.includes(this.data.stage) ? this.data.stage : stages[0] || ''
    const routeOptions = preferredCode && stage ? routesForSubjectStage(preferredCode, stage) : []
    const route = routeOptions[0]
    this.setData({ activeCategory, subjects, stages, subjectCode: preferredCode, subjectLabel: subjects.find((item) => item.code === preferredCode)?.label || '', stage, routeOptions, routeId: route?.routeId || '', inventory: null, inventoryTopics: [], inventoryError: '' }, () => { if (activeCategory !== 'ielts' && route) this.refreshInventory(route.routeId) })
  },
  onShow() { syncDevice(this); if (this.data.activeCategory !== 'ielts') this.refreshInventory(this.data.routeId) },
  onResize() { syncDevice(this) },
  onUnload() { this.__requestId += 1 },

  chooseCategory(event) {
    const activeCategory = normalizeCategory(event.currentTarget.dataset.category)
    const subjects = subjectsForCategory(activeCategory)
    const subject = subjects[0]
    const stages = activeCategory === 'ielts' ? [] : categoryStages(activeCategory)
    const stage = stages[0] || ''
    const routeOptions = subject && stage ? routesForSubjectStage(subject.code, stage) : []
    const route = routeOptions[0]
    this.setData({ activeCategory, subjects, stages, subjectCode: subject?.code || '', subjectLabel: subject?.label || '', stage, routeOptions, routeId: route?.routeId || '', inventory: null, inventoryTopics: [], inventoryError: '', error: '' }, () => { if (activeCategory !== 'ielts' && route) this.refreshInventory(route.routeId) })
  },
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
    const routes = routesForSubjectStage(this.data.subjectCode, stage)
    const route = routes[0]
    this.setData({ stage, routeOptions: routes, routeId: route ? route.routeId : '', inventory: null, inventoryTopics: [], inventoryError: '', error: route ? '' : '这个阶段暂没有可用路线，请换一个学科。' }, () => { if (route) this.refreshInventory(route.routeId) })
  },
  chooseRoute(event) {
    const routeId = String(event.currentTarget.dataset.route || '')
    if (!routeId) return
    this.setData({ routeId, inventory: null, inventoryTopics: [], inventoryError: '', error: '' }, () => this.refreshInventory(routeId))
  },
  refreshInventory(routeId) {
    if (routeId && typeof routeId === 'object') routeId = routeId.currentTarget?.dataset?.routeId
    const id = String(routeId || '').trim()
    if (!id || this.data.activeCategory === 'ielts') return
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
    wx.setStorageSync('stemistRetakeContext', { subjectCode: this.data.subjectCode, subject: this.data.subjectLabel, stage: this.data.stage, routeId: this.data.routeId })
    wx.navigateTo({ url: '/pages/stem/capture', fail: (error) => this.setData({ error: error.errMsg || '无法打开 STEM 拍题，请重试。' }) })
  },
  openIelts(event) {
    const skill = String(event.currentTarget.dataset.skill || '')
    if (!IELTS_SKILLS.some((item) => item.id === skill)) return
    wx.navigateTo({ url: `/pages/ielts/${skill}` })
  },
  openCoach() { wx.navigateTo({ url: '/pages/coach/index' }) },
  openPapers() { wx.navigateTo({ url: `/pages/papers/index?subject=${encodeURIComponent(this.data.subjectCode)}` }) },
  openFullStudio() {
    const url = this.data.activeCategory === 'ielts'
      ? 'https://ieltsist.com/?from=stemist'
      : `https://stem.ieltsist.com/today?routeId=${encodeURIComponent(this.data.routeId || '')}&stage=${encodeURIComponent(this.data.stage || '')}&from=stemist`
    wx.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}`, fail: (error) => this.setData({ error: error.errMsg || '完整学习空间暂时无法打开。' }) })
  },
  openStemTool(event) {
    const tool = String(event.currentTarget.dataset.tool || '')
    if (tool === 'photo') return this.openStem()
    if (tool === 'papers') return this.openPapers()
    if (tool === 'progress') return wx.navigateTo({ url: '/pages/progress/index' })
    if (tool === 'notebook') return wx.navigateTo({ url: '/pages/notebook/index' })
    const tab = tool === 'exams' ? 'exams' : 'topics'
    const url = `https://stem.ieltsist.com/practice?tab=${tab}&routeId=${encodeURIComponent(this.data.routeId || '')}&stage=${encodeURIComponent(this.data.stage || '')}&from=stemist`
    wx.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}`, fail: (error) => this.setData({ error: error.errMsg || '学习功能暂时无法打开。' }) })
  },
})
