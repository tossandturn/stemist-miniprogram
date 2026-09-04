const { deviceState, syncDevice } = require('../../utils/page')
const { PAPER_SUBJECTS, fetchPaperCatalog } = require('../../utils/paperCatalog')
const { familyForCategoryStage, normalizeStemCategory, stemCategoryProfile, subjectsForCategory } = require('../../utils/stemCatalog')

const STAGE_FILTERS = [
  { id: 'all', label: '全部阶段' },
  { id: 'igcse', label: 'IGCSE' },
  { id: 'as', label: 'AS' },
  { id: 'a2', label: 'A2' },
  { id: 'competition', label: '竞赛' },
  { id: 'admissions', label: '入学考试' },
]

function stageFiltersForCategory(category) {
  return category === 'competition'
    ? STAGE_FILTERS.filter((item) => ['all', 'competition', 'admissions'].includes(item.id))
    : STAGE_FILTERS.filter((item) => ['all', 'igcse', 'as', 'a2'].includes(item.id))
}

function displayStage(item) {
  if (item.stages.includes('igcse')) return 'IGCSE'
  if (item.stages.includes('as') && item.stages.includes('a2')) return 'AS · A2'
  if (item.stages.includes('as')) return 'AS'
  if (item.stages.includes('a2')) return 'A2'
  if (item.stages.includes('competition')) return '竞赛'
  if (item.stages.includes('admissions')) return '入学考试'
  return '目录'
}

function subjectsForEntry(category) {
  const allowed = new Set(subjectsForCategory(category).map((subject) => subject.code))
  return PAPER_SUBJECTS.filter((subject) => allowed.has(subject.code))
}

Page({
  data: deviceState({
    subjects: PAPER_SUBJECTS,
    category: 'alevel',
    categoryLabel: 'A-Level 学科',
    family: 'exam',
    stageFilters: stageFiltersForCategory('alevel'),
    subject: '9702',
    subjectIndex: 0,
    stageFilters: STAGE_FILTERS,
    stage: 'all',
    stageIndex: 0,
    query: '',
    loading: false,
    error: '',
    catalog: null,
    items: [],
    totalQuestionPapers: 0,
    pairedQuestionPapers: 0,
  }),
  onLoad(options) {
    this.__requestId = 0
    const category = normalizeStemCategory(options && options.category)
    const subjects = subjectsForEntry(category)
    const requested = String(options && options.subject || '')
    const defaultSubject = category === 'competition' ? (subjects[0]?.code || '') : (subjects.some((item) => item.code === '9702') ? '9702' : subjects[0]?.code || '')
    const subject = subjects.some((item) => item.code === requested) ? requested : defaultSubject
    const subjectIndex = Math.max(0, subjects.findIndex((item) => item.code === subject))
    this.setData({ category, categoryLabel: stemCategoryProfile(category).label, family: category === 'competition' ? 'competition' : 'exam', subjects, stageFilters: stageFiltersForCategory(category), subject, subjectIndex, stage: 'all', stageIndex: 0 }, () => this.loadCatalog(subject))
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onUnload() { this.__requestId += 1 },
  chooseSubject(event) {
    const fromPicker = event && event.detail && event.detail.value !== undefined
    const index = fromPicker ? Number(event.detail.value) : this.data.subjects.findIndex((item) => item.code === String(event.currentTarget.dataset.subject || ''))
    const subject = this.data.subjects[index]
    if (!subject) return
    this.setData({ subject: subject.code, subjectIndex: index, stage: 'all', stageIndex: 0, query: '' }, () => this.loadCatalog(subject.code))
  },
  chooseStage(event) {
    const index = Number(event && event.detail && event.detail.value !== undefined ? event.detail.value : 0)
    const stage = STAGE_FILTERS[index]?.id || 'all'
    this.setData({ stage, stageIndex: index, family: stage === 'admissions' ? 'admissions' : familyForCategoryStage(this.data.category, stage === 'competition' ? 'Competition' : 'AS') }, () => this.applyFilters())
  },
  onSearch(event) { this.setData({ query: String(event.detail.value || '') }, () => this.applyFilters()) },
  clearSearch() { this.setData({ query: '' }, () => this.applyFilters()) },
  loadCatalog(subject) {
    const requestId = ++this.__requestId
    this.setData({ loading: true, error: '', catalog: null, items: [] })
    fetchPaperCatalog(subject).then((catalog) => {
      if (requestId !== this.__requestId) return
      const activeItems = Array.isArray(catalog.items) ? catalog.items : []
      const pairedItems = activeItems.filter((item) => item.pairKey).length
      this.setData({ catalog, totalQuestionPapers: activeItems.length, pairedQuestionPapers: pairedItems }, () => this.applyFilters())
    }).catch((error) => { if (requestId === this.__requestId) this.setData({ error: error.message || '真题目录暂时无法读取。' }) }).finally(() => { if (requestId === this.__requestId) this.setData({ loading: false }) })
  },
  applyFilters() {
    const catalog = this.data.catalog
    if (!catalog) return
    const query = this.data.query.trim().toLowerCase()
    const stage = this.data.stage
    const items = catalog.items.filter((item) => {
      const stageMatch = stage === 'all' || item.stages.includes(stage)
      const text = `${item.file} ${item.year || ''} ${item.season} ${item.paperNumber} ${item.title}`.toLowerCase()
      return stageMatch && (!query || text.includes(query))
    }).sort((a, b) => (Number(b.year || 0) - Number(a.year || 0)) || b.file.localeCompare(a.file)).slice(0, 80).map((item) => ({ ...item, stageLabel: displayStage(item), pairLabel: item.pairKey ? 'QP/MS 已配对' : '暂无配对标记' }))
    this.setData({ items })
  },
  openPaper(event) {
    const item = this.data.items.find((candidate) => candidate.id === String(event.currentTarget.dataset.id || ''))
    if (!item) return
    const url = `https://stem.ieltsist.com/papers?category=${encodeURIComponent(this.data.category)}&subject=${encodeURIComponent(item.subject)}&paperId=${encodeURIComponent(item.id)}`
    wx.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}`, fail: (error) => this.setData({ error: error.errMsg || '无法打开完整试卷，请重试。' }) })
  },
})
