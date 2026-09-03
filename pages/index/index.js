const { deviceState, syncDevice } = require('../../utils/page')

Page({
  data: deviceState({
    user: null,
    activeTab: 'today',
    recentActivity: null,
    loopSteps: [
      { label: 'Discover', detail: '选择准确路线', state: 'ready' },
      { label: 'Practice', detail: '提交真实证据', state: 'next' },
      { label: 'Coach', detail: '看诊断与证据', state: 'locked' },
      { label: 'Retest', detail: '修正后再练', state: 'locked' },
    ],
    metrics: [
      { label: 'This week', value: '0', detail: 'completed attempts' },
      { label: 'Saved drafts', value: '0', detail: 'ready to resume' },
      { label: 'AI Coach', value: 'Ready', detail: 'evidence-led feedback' },
      { label: 'Next action', value: '1 photo', detail: 'one STEM question' },
    ],
    ieltsCards: [
      { id: 'listening', icon: '◉', title: 'Listening with AI', detail: 'Text answer, trap review and next practice.', meta: 'Text workspace', accent: 'listening' },
      { id: 'reading', icon: '▤', title: 'Reading with AI', detail: 'Evidence, location and answer reasoning.', meta: 'Text workspace', accent: 'reading' },
      { id: 'writing', icon: '✎', title: 'Writing with AI', detail: 'Type an essay or photograph handwritten work.', meta: 'Text or photo', accent: 'writing' },
      { id: 'speaking', icon: '◌', title: 'Speaking with AI', detail: 'The original IELTSist Qwen speaking examiner.', meta: 'Realtime voice', accent: 'speaking' },
    ],
  }),

  onShow() {
    syncDevice(this)
    const user = wx.getStorageSync('stemistUser') || null
    const drafts = ['listening', 'reading', 'writing'].reduce((count, key) => count + (wx.getStorageSync(`stemistDraft:${key}`) ? 1 : 0), 0)
    const submissions = ['stem-photo', 'writing', 'listening', 'reading'].map((key) => wx.getStorageSync(`stemistSubmission:${key}`)).filter(Boolean)
    const recentActivity = submissions.sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0))[0] || null
    const loopSteps = recentActivity
      ? [
        { label: 'Discover', detail: '路线已选择', state: 'ready' },
        { label: 'Practice', detail: '证据已提交', state: 'ready' },
        { label: 'Coach', detail: '反馈可查看', state: 'next' },
        { label: 'Retest', detail: '准备下一次', state: 'locked' },
      ]
      : [
        { label: 'Discover', detail: '选择准确路线', state: 'ready' },
        { label: 'Practice', detail: drafts ? '恢复草稿' : '提交真实证据', state: 'next' },
        { label: 'Coach', detail: '看诊断与证据', state: 'locked' },
        { label: 'Retest', detail: '修正后再练', state: 'locked' },
      ]
    this.setData({ user, recentActivity, loopSteps, 'metrics[1].value': String(drafts) })
  },
  onResize() { syncDevice(this) },

  openStem() { wx.navigateTo({ url: '/pages/stem/capture' }) },
  openAccount() { wx.navigateTo({ url: '/pages/account/auth' }) },
  openCoach() {
    wx.showActionSheet({
      itemList: ['STEM 拍题 Coach', 'Listening Coach', 'Reading Coach', 'Writing Coach'],
      success: ({ tapIndex }) => {
        const routes = ['/pages/stem/capture', '/pages/ielts/listening', '/pages/ielts/reading', '/pages/ielts/writing']
        if (routes[tapIndex]) wx.navigateTo({ url: routes[tapIndex] })
      },
    })
  },
  openIelts(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/ielts/${id}` })
  },
  selectTab(event) {
    const tab = event.currentTarget.dataset.tab
    if (tab === 'account') return this.openAccount()
    if (tab === 'practice' || tab === 'coach') return this.openCoach()
    this.setData({ activeTab: tab })
  },
})
