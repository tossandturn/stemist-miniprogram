const { deviceState, syncDevice } = require('../../utils/page')
const { getJson } = require('../../utils/api')
const { localLearningSummary, mergeLearningRecords, remoteLearningRecords } = require('../../utils/learningSummary')

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
    const records = summary.submissions
    this.setData({ records: records.slice(0, 8), localCount: records.length, weekCount: summary.completedThisWeek, draftCount: summary.draftCount, remoteState: wx.getStorageSync('stemistSessionToken') ? 'loading' : 'signed-out', remoteError: '' })
    if (!wx.getStorageSync('stemistSessionToken')) return
    getJson('/api/stem/attempts', { timeout: 8000 }).then((payload) => {
      if (this.__disposed || requestId !== this.__requestId) return
      const attempts = Array.isArray(payload && payload.attempts) ? payload.attempts : []
      const remote = remoteLearningRecords(attempts)
      const merged = mergeLearningRecords(records, remote)
      const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000
      this.setData({ records: merged.slice(0, 8), localCount: merged.length, weekCount: merged.filter((item) => item.timestamp >= weekStart).length, remoteAttempts: remote.slice(0, 8), remoteState: 'ready' })
    }).catch((error) => { if (!this.__disposed && requestId === this.__requestId) this.setData({ remoteState: 'error', remoteError: error.message || '学习记录暂时无法读取。' }) })
  },
  openNotebook() { wx.navigateTo({ url: '/pages/notebook/index' }) },
  continueLearning() {
    const latest = this.data.records[0]
    if (latest && latest.routeId) {
      wx.setStorageSync('stemistRetakeContext', { routeId: latest.routeId, stage: latest.stage || 'AS', subjectCode: latest.subjectCode || '9702', subject: latest.subject || 'Physics' })
    }
    wx.navigateTo({ url: '/pages/practice/index' })
  },
})
