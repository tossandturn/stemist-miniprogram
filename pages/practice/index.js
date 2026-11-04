const { deviceState, syncDevice } = require('../../utils/page')
const { fetchRouteInventory } = require('../../utils/inventory')
const { familyForCategoryStage, normalizeStemCategory, routesForSubjectStage, stemCategoryProfile, subjectsForCategory } = require('../../utils/stemCatalog')
const { IELTS_FEATURE_GROUPS, getIeltsFeature } = require('../../utils/ieltsCatalog')
const { routeById } = require('../../utils/stemRoutes')

const STEM_TOOLS = [
  { id: 'papers', label: '历年真题', detail: '选卷作答', tone: 'papers' },
  { id: 'topics', label: '章节练习', detail: '按知识点练习', tone: 'topics' },
  { id: 'current', label: '当前章节', detail: '继续上次章节练习', tone: 'current' },
  { id: 'exams', label: '模拟考试', detail: '计时、提交和复盘', tone: 'exams' },
]
const EXAM_BOARDS=[{id:'cie',label:'CIE',detail:'Cambridge International'},{id:'edexcel',label:'Edexcel',detail:'Pearson 国际 A-Level'},{id:'oxfordaqa',label:'AQA',detail:'OxfordAQA 国际 A-Level'}]

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
  ...require('../../utils/share').public,
  data: deviceState({
    activeCategory: 'alevel',
    examBoards:EXAM_BOARDS,examBoard:'cie',boardSubject:'physics',boardSubjects:[{id:'physics',label:'物理'},{id:'maths',label:'数学'},{id:'further-maths',label:'进阶数学'}],
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
    const requestedBoard=EXAM_BOARDS.find(item=>item.id===options?.board)?.id||'cie'
    if(activeCategory==='alevel'&&requestedBoard!=='cie'){const boardSubject=this.data.boardSubjects.find(s=>s.id===options?.boardSubject)?.id||'physics';this.setData({activeCategory,examBoard:requestedBoard,boardSubject,routeId:'',inventory:null,inventoryTopics:[]});return}
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
  onShow() { syncDevice(this); if (this.data.activeCategory === 'alevel' && this.data.examBoard==='cie' && !this.data.inventoryLoading && !this.data.inventory) this.refreshInventory(this.data.routeId) },
  onResize() { syncDevice(this) },
  onUnload() { this.__requestId += 1 },
  chooseBoard(event){const board=String(event.currentTarget?.dataset?.board||'');if(!EXAM_BOARDS.some(item=>item.id===board)||board===this.data.examBoard)return;this.__requestId++;this.setData({examBoard:board,inventory:null,inventoryTopics:[],inventoryLoading:false,inventoryError:'',error:''});if(board==='cie'){const route=routesForSubjectStage(this.data.subjectCode,this.data.stage)[0];this.setData({routeId:route?.routeId||''});if(route)this.refreshInventory(route.routeId)}else this.setData({routeId:''})},
  chooseBoardSubject(event){const subject=String(event.currentTarget?.dataset?.subject||'');if(this.data.boardSubjects.some(item=>item.id===subject))this.setData({boardSubject:subject,error:''})},

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
    if (!id || this.data.activeCategory !== 'alevel' || this.data.examBoard!=='cie') return
    const requestId = ++this.__requestId
    this.setData({ inventoryLoading: true, inventoryError: '' })
    fetchRouteInventory(id).then((inventory) => {
      if (requestId !== this.__requestId) return
      if (!inventory) throw new Error('empty')
      this.setData({ inventory, inventoryTopics: inventory.topics.slice(0, 4) })
    }).catch(() => {
      if (requestId !== this.__requestId) return
      this.setData({ inventory: null, inventoryTopics: [], inventoryError: '章节状态暂未加载，可先进入历年真题，或稍后重试。' })
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
    this.setData({error:'暂时无法打开，请返回重试。'})
  },
  openCoach() { wx.navigateTo({ url: '/pages/coach/index?source=alevel&category=alevel&routeId='+encodeURIComponent(this.data.routeId)+'&stage='+encodeURIComponent(this.data.stage)+'&subjectCode='+encodeURIComponent(this.data.subjectCode) }) },
  openPapers() { wx.navigateTo({ url: `/pages/papers/index?category=${encodeURIComponent(this.data.activeCategory)}&subject=${encodeURIComponent(this.data.subjectCode)}&routeId=${encodeURIComponent(this.data.routeId)}&stage=${encodeURIComponent(this.data.stage)}` }) },
  openFullStudio() {
    if (this.data.activeCategory === 'ielts') {
      return wx.navigateTo({url:'/pages/ielts/home'})
    }
    wx.navigateTo({url:'/pages/progress/index'})
  },
  openStemTool(event) {
    const tool = String(event.currentTarget.dataset.tool || '')
    if(!STEM_TOOLS.some(item=>item.id===tool))return
    if(this.data.examBoard!=='cie'){
      if(tool==='papers')return wx.navigateTo({url:'/bundles/curricula/index?board='+this.data.examBoard+'&course='+this.data.examBoard+'-ial-'+this.data.boardSubject})
      return this.setData({error:'该考试局的章节与模拟练习正在核对，暂不混用 CIE 题库。你可以先查看历年真题目录。'})
    }
    if (tool === 'papers') return this.openPapers()
    if (tool === 'topics') return wx.navigateTo({ url: `/pages/stem/topics?routeId=${encodeURIComponent(this.data.routeId)}`, fail: () => this.setData({ error: '章节练习未能打开，请重试。' }) })
    if (tool === 'current') {const recent=require('../../utils/nativePractice').recentSession(this.data.routeId);return wx.navigateTo({url:recent?.id?'/pages/stem/practice?sessionId='+encodeURIComponent(recent.id):'/pages/stem/topics?routeId='+encodeURIComponent(this.data.routeId)})}
    if(tool==='exams')return wx.navigateTo({url:'/pages/papers/index?category='+encodeURIComponent(this.data.activeCategory)+'&subject='+encodeURIComponent(this.data.subjectCode)+'&routeId='+encodeURIComponent(this.data.routeId)+'&stage='+encodeURIComponent(this.data.stage)+'&mode=exam-simulation'})
  },
})
