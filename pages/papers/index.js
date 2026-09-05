const { deviceState, syncDevice } = require('../../utils/page')
const { PAPER_SUBJECTS, fetchPaperCatalog } = require('../../utils/paperCatalog')
const { normalizeStemCategory, subjectsForCategory, categoryForSubject } = require('../../utils/stemCatalog')
const { STEM_ROUTES } = require('../../utils/stemRoutes')

const PAGE_SIZE = 30
const STAGE_FILTERS = [{ id: 'all', label: '全部阶段' }, { id: 'igcse', label: 'IGCSE' }, { id: 'as', label: 'AS' }, { id: 'a2', label: 'A2' }]
function scopes(category) {
  const codes = subjectsForCategory(category).map(item => item.code)
  return PAPER_SUBJECTS.filter(item => codes.includes(item.code))
}
function stageLabel(item) { return item.stages.map(stage => ({ as: 'AS', a2: 'A2', igcse: 'IGCSE', competition: '竞赛', admissions: '入学考试' })[stage]).filter(Boolean).join(' · ') }
function paperRoute(item, selectedStage) {
  const routes = STEM_ROUTES.filter(route => route.subjectCode === item.subject && item.stages.includes(route.stage.toLowerCase()))
  const matched = routes.filter(route => !item.routeIds.length || item.routeIds.includes(route.routeId))
  return matched.find(route => route.stage.toLowerCase() === selectedStage) || matched[0] || routes[0] || null
}
Page({
  data: deviceState({
    category: 'alevel', categoryLabel: '学科真题', showStageFilter: true, subjects: scopes('alevel'),
    subject: '9702', subjectIndex: 0, stageFilters: STAGE_FILTERS, stage: 'all', stageIndex: 0,
    query: '', loading: false, error: '', catalog: null, items: [], totalQuestionPapers: 0,
    pairedQuestionPapers: 0, matchCount: 0, hasMore: false, pdfBusy: '', routeId: '', family: 'exam',
  }),
  onLoad(options = {}) {
    this.__requestId = 0; this.__limit = PAGE_SIZE; this.__disposed = false
    const requested = String(options.subject || '')
    const category = normalizeStemCategory(options.category || (requested ? categoryForSubject(requested) : 'alevel'))
    const subjects = scopes(category)
    const subject = subjects.find(item => item.code === requested) || subjects[0]
    this.setData({ category, categoryLabel: category === 'competition' ? '竞赛与入学真题' : '学科真题', showStageFilter: category !== 'competition', subjects, subject: subject.code, subjectIndex: subjects.indexOf(subject) })
    this.loadCatalog(subject.code)
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true; this.__requestId += 1 },
  chooseSubject(event) {
    const index = event.detail?.value !== undefined ? Number(event.detail.value) : this.data.subjects.findIndex(item => item.code === event.currentTarget?.dataset?.subject)
    const subject = this.data.subjects[index]
    if (!subject) return
    this.__limit = PAGE_SIZE
    this.setData({ subject: subject.code, subjectIndex: index, stage: 'all', stageIndex: 0, query: '' })
    this.loadCatalog(subject.code)
  },
  chooseStage(event) {
    const index = Number(event.detail?.value)
    const option = this.data.stageFilters[index]
    if (!option || !this.data.showStageFilter) return
    this.__limit = PAGE_SIZE
    this.setData({ stage: option.id, stageIndex: index }); this.applyFilters()
  },
  onSearch(event) { this.__limit = PAGE_SIZE; this.setData({ query: String(event.detail.value || '') }); this.applyFilters() },
  clearSearch() { this.__limit = PAGE_SIZE; this.setData({ query: '' }); this.applyFilters() },
  retry() { this.loadCatalog(this.data.subject) },
  async loadCatalog(subject) {
    const requestId = ++this.__requestId
    const scopeRoute = STEM_ROUTES.find(route => route.subjectCode === subject)
    this.setData({ loading: true, error: '', catalog: null, items: [], matchCount: 0, hasMore: false, totalQuestionPapers: 0, pairedQuestionPapers: 0, routeId: scopeRoute?.routeId || '', family: scopeRoute?.stage === 'Admissions' ? 'admissions' : this.data.category === 'competition' ? 'competition' : 'exam' })
    try {
      const catalog = await fetchPaperCatalog(subject)
      if (this.__disposed || requestId !== this.__requestId) return
      this.setData({ catalog, totalQuestionPapers: catalog.items.length, pairedQuestionPapers: catalog.items.filter(item => item.markScheme).length })
      this.applyFilters()
    } catch { if (!this.__disposed && requestId === this.__requestId) this.setData({ error: '真题暂时无法加载，请重试。' }) }
    finally { if (!this.__disposed && requestId === this.__requestId) this.setData({ loading: false }) }
  },
  applyFilters() {
    if (!this.data.catalog) return
    const query = this.data.query.trim().toLowerCase()
    const all = this.data.catalog.items.filter(item => (this.data.stage === 'all' || item.stages.includes(this.data.stage)) && (!query || (item.file+' '+item.title+' '+item.year+' '+item.season).toLowerCase().includes(query)))
      .sort((a,b) => (Number(b.year || 0)-Number(a.year || 0)) || b.file.localeCompare(a.file))
    const items = all.slice(0, this.__limit || PAGE_SIZE).map(item => ({ ...item, stageLabel: stageLabel(item), displayTitle: item.file.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '), pairLabel: item.markScheme ? '含参考答案' : '' }))
    this.setData({ items, matchCount: all.length, hasMore: all.length > items.length })
  },
  loadMore() { this.__limit = (this.__limit || PAGE_SIZE) + PAGE_SIZE; this.applyFilters() },
  onReachBottom() { if (this.data.hasMore) this.loadMore() },
  openPaper(event) {
    const item = this.data.items.find(candidate => candidate.id === String(event.currentTarget.dataset.id || ''))
    if (!item) return
    const route = paperRoute(item, this.data.stage)
    if (!route) return this.setData({ error: '这份试卷暂时无法开始练习。' })
    const url = 'https://stem.ieltsist.com/papers?course='+encodeURIComponent(item.subject)+'&routeId='+encodeURIComponent(route.routeId)+'&stage='+encodeURIComponent(route.stage)+'&paperId='+encodeURIComponent(item.id)+'&paperMode=past-paper-practice&from=stemist'
    wx.navigateTo({ url: '/pages/webview/index?url='+encodeURIComponent(url), fail: () => this.setData({ error: '练习暂时无法打开，请重试。' }) })
  },
  openPdf(event) {
    const item = this.data.items.find(candidate => candidate.id === String(event.currentTarget.dataset.id || ''))
    const document = event.currentTarget.dataset.kind === 'ms' ? item?.markScheme : item
    if (!document || this.data.pdfBusy) return
    const url = String(document.localUrl || '')
    if (!url.startsWith('/local-pdf/'+item.subject+'/') || /\.\.|[?#]/.test(url)) return this.setData({ error: '试卷文件暂不可用。' })
    this.setData({ pdfBusy: item.id, error: '' })
    wx.downloadFile({
      url: 'https://stem.ieltsist.com'+url, timeout: 30000,
      success: (result) => {
        if (this.__disposed) return
        if (result.statusCode !== 200) { this.setData({ pdfBusy: '', error: '试卷下载失败，请重试。' }); return }
        wx.openDocument({ filePath: result.tempFilePath, fileType: 'pdf', showMenu: true,
          fail: () => { if (!this.__disposed) this.setData({ error: 'PDF 暂时无法打开，请重试。' }) },
          complete: () => { if (!this.__disposed) this.setData({ pdfBusy: '' }) } })
      },
      fail: () => { if (!this.__disposed) this.setData({ pdfBusy: '', error: '试卷下载失败，请检查网络。' }) },
    })
  },
})
