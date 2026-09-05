const { deviceState, syncDevice } = require('../../utils/page')
const { getJson } = require('../../utils/api')
const { localLearningSummary, mergeLearningRecords, remoteLearningRecords } = require('../../utils/learningSummary')
const { categoryForRoute, familyForCategoryStage } = require('../../utils/stemCatalog')

function scopeLabel(record = {}) {
  if (record.category === 'competition' || ['competition', 'admissions'].includes(record.family)) return '竞赛 / 入学考试'
  if (record.category === 'alevel' || record.category === 'stem' || record.family === 'exam') return 'A-Level 学科'
  return 'IELTSist'
}

function decorateRecords(records = []) {
  return records.map((record) => ({ ...record, scopeLabel: scopeLabel(record), scopeRoute: record.routeId ? ` · ${record.routeId}` : '' }))
}

Page({
  data: deviceState({
    localCount: 0,
    weekCount: 0,
    draftCount: 0,
    records: [],
    remoteAttempts: [],
    remoteState: 'idle',
    remoteError: '',
    error: '',
  }),
  onLoad() { this.__disposed = false; this.__requestId = 0 },
  onShow() { syncDevice(this); this.refresh() },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true; this.__requestId += 1 },
  refresh() {
    const requestId = ++this.__requestId
    const summary = localLearningSummary()
    const records = decorateRecords(summary.submissions)
    this.setData({ records: records.slice(0, 8), localCount: records.length, weekCount: summary.completedThisWeek, draftCount: summary.draftCount, remoteState: wx.getStorageSync('stemistSessionToken') ? 'loading' : 'signed-out', remoteError: '' })
    if (!wx.getStorageSync('stemistSessionToken')) return
    getJson('/api/stem/attempts', { timeout: 8000 }).then((payload) => {
      if (this.__disposed || requestId !== this.__requestId) return
      const attempts = Array.isArray(payload && payload.attempts) ? payload.attempts : []
      const remote = remoteLearningRecords(attempts)
      const merged = decorateRecords(mergeLearningRecords(records, remote))
      const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000
      this.setData({ records: merged.slice(0, 8), localCount: merged.length, weekCount: merged.filter((item) => item.timestamp >= weekStart).length, remoteAttempts: remote.slice(0, 8), remoteState: 'ready' })
    }).catch((error) => { if (!this.__disposed && requestId === this.__requestId) this.setData({ remoteState: 'error', remoteError: error.message || '学习记录暂时无法读取。' }) })
  },
  openNotebook() { wx.navigateTo({ url: '/pages/notebook/index' }) },
  continueLearning() {
    const latest = this.data.records[0]
    if (latest && (latest.category === 'ielts' || /^(?:listening|reading|writing|speaking|ielts)/i.test(String(latest.skill || '')))) {
      wx.navigateTo({ url: '/pages/practice/index?category=ielts' })
      return
    }
    if (latest && latest.routeId) {
      const category = latest.category || categoryForRoute(latest.routeId)
      if (category === 'competition') { wx.navigateTo({ url: '/pages/papers/index?category=competition' }); return }
      wx.setStorageSync('stemistRetakeContext', { category, family: latest.family || familyForCategoryStage(category, latest.stage || 'AS'), routeId: latest.routeId, stage: latest.stage || 'AS', subjectCode: latest.subjectCode || '9702', subject: latest.subject || 'Physics' })
    }
    wx.navigateTo({ url: '/pages/practice/index?category=alevel' + (latest?.routeId ? '&routeId='+encodeURIComponent(latest.routeId) : '') })
  },
})
