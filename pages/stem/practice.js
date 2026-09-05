const { deviceState, syncDevice } = require('../../utils/page')
const { readSession, saveSession, needsSignIn, questionView, epoch, markQuestion } = require('../../utils/nativePractice')
const { isAuthError } = require('../../utils/api')
const { routeById } = require('../../utils/stemRoutes')

Page({
  data: deviceState({ sessionId: '', routeId: '', stage: '', subjectCode: '', title: '', unavailableParts: 0, question: null, index: 0, total: 0,
    navItems: [], answeredCount: 0, photo: '', photoMissing: false, results: [], reviewComplete: false, reviewedCount: 0,
    busy: false, cameraBusy: false, status: '', error: '', authRequired: false }),
  onLoad(options = {}) {
    this.__disposed = false
    this.setData({ sessionId: String(options.sessionId || '') })
    this.refresh()
  },
  onShow() { syncDevice(this); this.setData({ cameraBusy: false }); this.refresh() },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true },
  refresh() {
    if (this.__disposed) return
    const session = readSession(this.data.sessionId)
    if (!session) {
      const authRequired = needsSignIn(this.data.sessionId)
      this.setData({ question: null, photo: '', results: [], navItems: [], authRequired, error: authRequired ? '练习和照片仍保存在本机。请登录原账号继续。' : '未找到可恢复的练习，请返回重新组卷。' }); return
    }
    const view = questionView(session, session.index)
    const label = routeById(session.routeId)?.subjectLabel || session.subjectCode
    // Updating feedback must not remount already-loaded question images.
    if (this.data.question?.id === view.question.id) {
      view.question.images = view.question.images.map(image => this.data.question.images.find(old => old.id === image.id) || image)
    }
    this.setData({ ...view, routeId: session.routeId, stage: session.stage, subjectCode: session.subjectCode, title: label.startsWith(session.stage) ? label : `${session.stage} ${label}`,
      photoMissing: view.photo === this.data.photo ? this.data.photoMissing : false,
      authRequired: this.data.authRequired && !wx.getStorageSync('stemistSessionToken') })
  },
  goQuestion(event) {
    if (this.data.busy) return
    const index = Number(event.currentTarget.dataset.index)
    const session = readSession(this.data.sessionId)
    if (!session || !Number.isInteger(index) || index < 0 || index >= session.questions.length) return
    try { session.index = index; saveSession(session); this.setData({ error: '', status: '', photoMissing: false }); this.refresh(); wx.pageScrollTo({ scrollTop: 0, duration: 0 }) }
    catch (error) { this.setData({ error: error.message }) }
  },
  imageLoaded(event) { this.setImageState(event, { loaded: true, failed: false }) },
  imageFailed(event) { this.setImageState(event, { loaded: false, failed: true }) },
  setImageState(event, state) {
    const imageId = event.currentTarget.dataset.id
    if (!this.data.question?.images.some(i => i.id === imageId)) return
    this.setData({ question: { ...this.data.question, images: this.data.question.images.map(i => i.id === imageId ? { ...i, ...state } : i) } })
  },
  retryImage(event) {
    const imageId = event.currentTarget.dataset.id
    const image = this.data.question?.images.find(i => i.id === imageId)
    if (!image) return
    const originalUrl = image.url
    this.setImageState(event, { url: '', loaded: false, failed: false })
    wx.nextTick(() => { if (!this.__disposed) this.setImageState(event, { url: originalUrl }) })
  },
  previewQuestion(event) {
    const images = this.data.question?.images || []
    const current = images.find(i => i.id === event.currentTarget.dataset.id)
    if (current?.url) wx.previewImage({ current: current.url, urls: images.map(i => i.url).filter(Boolean), fail: () => this.setData({ error: '原图暂未打开，请重试。' }) })
  },
  previewPhoto() { if (this.data.photo) wx.previewImage({ current: this.data.photo, urls: [this.data.photo] }) },
  photoFailed() { this.setData({ photoMissing: true, error: '本机照片未能读取，请重新拍摄。其他题的答案不受影响。' }) },
  capture() {
    if (this.data.busy || this.data.cameraBusy || !this.data.question) return
    this.setData({ cameraBusy: true, error: '' })
    wx.setStorageSync('stemistCameraReturn', { route: 'native-practice', context: {
      sessionId: this.data.sessionId, questionId: this.data.question.id, privacyEpoch: epoch(),
      category: 'alevel', family: 'exam', routeId: this.data.routeId, stage: this.data.stage, subjectCode: this.data.subjectCode,
    } })
    wx.navigateTo({ url: '/pages/stem/camera', fail: () => this.setData({ cameraBusy: false, error: '相机未能打开，请重试。' }) })
  },
  async submit() {
    if (this.data.busy || !this.data.photo || this.data.photoMissing || !this.data.question?.canMark) return
    this.setData({ busy: true, error: '', authRequired: false, status: '正在提交本题…' })
    try {
      await markQuestion(this.data.sessionId, this.data.question.id, status => {
        if (!this.__disposed) { this.setData({ status }); this.refresh() }
      })
      if (!this.__disposed) this.setData({ status: '批改结果已保存' })
    } catch (error) {
      if (!this.__disposed) this.setData({ error: isAuthError(error) ? '请登录后批改，拍好的照片会保留。' : error.message || '批改暂未完成，照片和已有反馈已保留。', authRequired: isAuthError(error), status: '尚未完成批改' })
    } finally { if (!this.__disposed) { this.setData({ busy: false }); this.refresh() } }
  },
  openAccount() { wx.navigateTo({ url: '/pages/account/auth' }) },
  backToTopics() { wx.navigateBack({ fail: () => wx.redirectTo({ url: `/pages/stem/topics?routeId=${encodeURIComponent(this.data.routeId)}` }) }) },
})
