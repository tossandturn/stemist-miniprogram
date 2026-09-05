const { deviceState, syncDevice } = require('../../utils/page')
const { getJson } = require('../../utils/api')
const { localLearningSummary } = require('../../utils/learningSummary')
const { ensureWeChatSession } = require('../../utils/wechatAuth')

const ENTRY_POINTS = [
  { id: 'alevel', title: 'A-Level 学科', detail: 'IGCSE · AS · A2', tag: 'STEM STUDIO', tone: 'alevel', url: '/pages/practice/index?category=alevel' },
  { id: 'ielts', title: 'IELTS', detail: '听说读写 · 模考 · 词汇', tag: 'IELTSIST', tone: 'ielts', url: '/pages/practice/index?category=ielts' },
  { id: 'competition', title: '竞赛 / 入学考试', detail: 'BPhO · AMC · ESAT · TMUA 真题', tag: 'STEM STUDIO', tone: 'competition', url: '/pages/papers/index?category=competition' },
  { id: 'calculator', title: 'Casio 计算器', detail: '科学计算 · 历史记录', tag: 'STEM TOOL', tone: 'calculator', url: '/pages/calculator/index' },
]

Page({
  data: deviceState({
    user: null,
    aiStatus: '正在检查 AI…',
    entryPoints: ENTRY_POINTS,
    entryLoading: '',
    entryError: '',
    wechatLoading: false,
    recentActivity: null,
    summary: { completedThisWeek: 0, draftCount: 0, submissionCount: 0 },
  }),

  onShow() {
    this.__disposed = false
    syncDevice(this)
    const token = wx.getStorageSync('stemistSessionToken')
    const user = token ? (wx.getStorageSync('stemistUser') || null) : null
    const summary = localLearningSummary()
    const drafts = summary.draftCount
    const recentActivity = token ? summary.recentActivity : null
    this.setData({
      user,
      aiStatus: token ? '检查中…' : '登录后使用 AI',
      recentActivity,
      summary: { completedThisWeek: token ? summary.completedThisWeek : 0, draftCount: drafts, submissionCount: token ? summary.submissions.length : 0 },
    })
    if (!token && !this.__wechatAutoAttempted) {
      this.__wechatAutoAttempted = true
      ensureWeChatSession({ silent: true }).then((result) => {
        if (this.__disposed || !result || !result.user) return
        const latest = localLearningSummary()
        this.setData({ user: result.user, aiStatus: '微信已登录 · AI 可用', summary: { completedThisWeek: latest.completedThisWeek, draftCount: latest.draftCount, submissionCount: latest.submissions.length } })
      }).catch(() => {})
    }
    getJson('/api/ai/status', { timeout: 6000 }).then((status) => {
      if (this.__disposed) return
      const connected = Boolean(status && status.provider && status.coachEnabled)
      const hasToken = Boolean(wx.getStorageSync('stemistSessionToken'))
      this.setData({ aiStatus: connected ? (hasToken ? 'AI 已连接' : 'AI 服务已就绪 · 请先微信登录') : 'AI 暂不可用' })
    }).catch(() => { if (!this.__disposed) this.setData({ aiStatus: 'AI 暂不可用' }) })
  },
  onUnload() { this.__disposed = true },
  onResize() { syncDevice(this) },
  async loginWechat() {
    if (this.data.wechatLoading) return
    if (wx.getStorageSync('stemistSessionToken')) return wx.navigateTo({ url: '/pages/account/auth' })
    this.setData({ wechatLoading: true, entryError: '' })
    try {
      const result = await ensureWeChatSession({ silent: false })
      this.setData({ user: result.user || null, aiStatus: result.user ? 'AI 已连接' : '登录后使用 AI' })
      if (result.user) wx.showToast({ title: '微信登录成功', icon: 'success' })
    } catch {
      this.setData({ entryError: '微信登录暂时不可用；可以先浏览入口，提交 AI 前再到 Account 重试。' })
    } finally { this.setData({ wechatLoading: false }) }
  },
  openEntry(event) {
    const id = String(event.currentTarget.dataset.entry || '')
    const entry = ENTRY_POINTS.find((item) => item.id === id)
    if (!entry || this.data.entryLoading) return
    this.setData({ entryLoading: id, entryError: '' })
    // Do not make a student wait on a slow code2session exchange. The card
    // opens immediately while the same in-flight login continues in the
    // background; AI/remote writes still enforce the real session server-side.
    ensureWeChatSession({ silent: true }).then((result) => {
      if (this.__disposed || !result || !result.user) return
      this.setData({ user: result.user, aiStatus: '微信已登录 · AI 可用' })
    }).catch(() => {
      if (!this.__disposed) this.setData({ entryError: '' })
    })
    wx.navigateTo({ url: entry.url, fail: () => this.setData({ entryError: '暂时无法打开，请重试。' }), complete: () => this.setData({ entryLoading: '' }) })
  },

  openStem() { wx.navigateTo({ url: '/pages/stem/capture' }) },
  openPractice() { wx.navigateTo({ url: '/pages/practice/index' }) },
  openPapers() { wx.navigateTo({ url: '/pages/papers/index' }) },
  openAccount() { wx.navigateTo({ url: '/pages/account/auth' }) },
  openCoach() { wx.navigateTo({ url: '/pages/coach/index' }) },
  openIelts(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/ielts/${id}` })
  },
})
