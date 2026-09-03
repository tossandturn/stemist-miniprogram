const { deviceState, syncDevice } = require('../../utils/page')
const { routesForSubjectStage } = require('../../utils/stemRoutes')

const SUBJECTS = [
  { code: '9702', label: 'Physics', short: '物理' },
  { code: '9709', label: 'Mathematics', short: '数学' },
  { code: '9700', label: 'Biology', short: '生物' },
  { code: '9701', label: 'Chemistry', short: '化学' },
  { code: '0625', label: 'IGCSE Physics', short: 'IGCSE 物理' },
  { code: '0580', label: 'IGCSE Mathematics', short: 'IGCSE 数学' },
  { code: 'bpho', label: 'BPhO', short: 'BPhO' },
  { code: 'esat', label: 'ESAT', short: 'ESAT' },
  { code: 'tmua', label: 'TMUA', short: 'TMUA' },
  { code: 'amc12', label: 'AMC 12', short: 'AMC 12' },
]
const STAGES = ['IGCSE', 'AS', 'A2', 'Competition', 'Admissions']

Page({
  data: deviceState({
    busy: false,
    error: '',
    returnPage: 'stem',
    isWriting: false,
    subjectCode: '9702',
    subjectLabel: 'Physics',
    stage: 'AS',
    routeId: 'cie-9702-as-physics',
    routeOptions: routesForSubjectStage('9702', 'AS'),
    subjects: SUBJECTS,
    stages: STAGES,
  }),
  onLoad(options) {
    options = options || {}
    const isWriting = options.returnPage === 'writing'
    this.setData({ returnPage: isWriting ? 'writing' : 'stem', isWriting })
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  goBack() { wx.navigateBack() },
  chooseSubject(event) {
    const code = event.currentTarget.dataset.code
    const subject = SUBJECTS.find((item) => item.code === code)
    if (subject) {
      const routes = routesForSubjectStage(subject.code, this.data.stage)
      this.setData({ subjectCode: subject.code, subjectLabel: subject.label, routeOptions: routes, routeId: routes[0] ? routes[0].routeId : '', error: '' })
    }
  },
  chooseStage(event) {
    const stage = event.currentTarget.dataset.stage
    const routes = routesForSubjectStage(this.data.subjectCode, stage)
    this.setData({ stage, routeOptions: routes, routeId: routes[0] ? routes[0].routeId : '', error: '' })
  },
  chooseRoute(event) { this.setData({ routeId: event.currentTarget.dataset.route, error: '' }) },
  captureContext() {
    if (this.data.isWriting) return { product: 'IELTSist', skill: 'writing', mode: 'photo', stage: 'practice' }
    const routes = routesForSubjectStage(this.data.subjectCode, this.data.stage)
    const selectedRoute = routes.find((route) => route.routeId === this.data.routeId) || routes[0]
    return {
      product: 'STEM Studio',
      skill: 'stem-photo',
      subjectCode: this.data.subjectCode,
      subject: this.data.subjectLabel,
      stage: this.data.stage,
      qualification: this.data.stage === 'IGCSE' ? 'IGCSE' : (this.data.stage === 'Competition' || this.data.stage === 'Admissions' ? this.data.stage : 'Cambridge A Level'),
      routeId: selectedRoute ? selectedRoute.routeId : '',
      paperComponents: selectedRoute ? selectedRoute.components : '',
      mode: 'photo-question',
      source: 'stemist-miniprogram',
    }
  },
  takePhoto() {
    if (this.data.busy) return
    this.setData({ busy: true, error: '' })
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      sizeType: ['compressed'],
      success: ({ tempFiles }) => {
        const path = tempFiles && tempFiles[0] && tempFiles[0].tempFilePath
        if (!path) {
          this.setData({ error: '没有获得照片，请重试' })
          return
        }
        wx.setStorageSync('stemistCropReturn', { route: this.data.returnPage, context: this.captureContext(), createdAt: Date.now() })
        wx.navigateTo({
          url: `/pages/crop/crop?src=${encodeURIComponent(path)}`,
          fail: (error) => this.setData({ error: error.errMsg || '无法打开裁剪页，请重试' }),
        })
      },
      fail: (error) => this.setData({ error: error.errMsg || '相机打开失败，请检查相机权限' }),
      complete: () => this.setData({ busy: false }),
    })
  },
})
