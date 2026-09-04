const { deviceState, syncDevice } = require('../../utils/page')

Page({
  data: deviceState({ busy: false, ready: false, error: '', flash: 'auto', returnPage: 'stem', context: {}, coachSource: 'capture', category: 'alevel', family: 'exam', routeId: '', stage: '', subjectCode: '', hint: '把题目、图表和答案完整放进取景框。' }),
  onLoad() {
    const info = wx.getStorageSync('stemistCameraReturn') || {}
    wx.removeStorageSync('stemistCameraReturn')
    const returnPage = info.route === 'writing' ? 'writing' : 'stem'
    const hint = returnPage === 'writing' ? '保持纸张平整，拍清整页手写作文和题目。' : '把题目、图表和答案完整放进取景框。'
    const context = info.context || {}
    this.setData({ returnPage, context, coachSource: returnPage === 'writing' ? 'writing' : context.category === 'competition' ? 'competition' : 'alevel', category: returnPage === 'writing' ? 'ielts' : context.category || 'alevel', family: returnPage === 'writing' ? '' : context.family || 'exam', routeId: context.routeId || '', stage: context.stage || '', subjectCode: context.subjectCode || '', hint })
  },
  onReady() {
    try { this.__camera = typeof wx.createCameraContext === 'function' ? wx.createCameraContext() : null } catch { this.__camera = null }
    this.setData({ ready: true })
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onUnload() { this.__camera = null },
  onCameraError(event) {
    const raw = String(event && event.detail && event.detail.errMsg || '')
    if (/cancel|取消/i.test(raw)) {
      this.setData({ busy: false })
      return
    }
    if (/auth deny|permission|authorize|权限|拒绝/i.test(raw)) {
      this.setData({ error: '相机权限未开启，请允许相机后重试。' })
      if (wx.openSetting) wx.showModal({ title: '需要相机权限', content: '请在系统设置中允许 Stemist 使用相机。', confirmText: '去设置', cancelText: '稍后', success: ({ confirm }) => { if (confirm) wx.openSetting({}) } })
      return
    }
    this.setData({ error: '相机暂时无法打开；可以重试或返回上一页。' })
  },
  toggleFlash() {
    const values = ['auto', 'on', 'off']
    const next = values[(values.indexOf(this.data.flash) + 1) % values.length]
    this.setData({ flash: next })
  },
  takePhoto() {
    if (this.data.busy) return
    this.setData({ busy: true, error: '' })
    if (this.__camera && typeof this.__camera.takePhoto === 'function') {
      this.__camera.takePhoto({ quality: 'high', success: ({ tempImagePath }) => this.usePhoto(tempImagePath), fail: (error) => { this.setData({ busy: false }); this.onCameraError({ detail: error }) } })
      return
    }
    this.fallbackCamera()
  },
  fallbackCamera() {
    const success = ({ tempFiles, tempFilePaths }) => {
      const files = Array.isArray(tempFiles) ? tempFiles : (Array.isArray(tempFilePaths) ? tempFilePaths.map((tempFilePath) => ({ tempFilePath })) : [])
      this.usePhoto(files[0] && (files[0].tempFilePath || files[0].path))
    }
    const fail = (error) => { this.setData({ busy: false }); this.onCameraError({ detail: error }) }
    if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['camera'], camera: 'back', sizeType: ['compressed'], success, fail })
    } else if (typeof wx.chooseImage === 'function') {
      wx.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['camera'], success, fail })
    } else {
      fail({ errMsg: 'camera api unavailable' })
    }
  },
  usePhoto(path) {
    if (!path) { this.setData({ busy: false, error: '没有获得照片，原路线仍保留。请重新拍摄。' }); return }
    wx.setStorageSync('stemistCropReturn', { route: this.data.returnPage, context: this.data.context || {}, createdAt: Date.now() })
    wx.navigateTo({ url: `/pages/crop/crop?src=${encodeURIComponent(path)}`, fail: (error) => this.setData({ busy: false, error: error.errMsg || '无法打开裁剪页，请重试。' }) })
  },
  cancel() { wx.removeStorageSync('stemistCameraReturn'); wx.navigateBack() },
})
