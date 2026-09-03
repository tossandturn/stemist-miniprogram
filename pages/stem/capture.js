const { deviceState, syncDevice } = require('../../utils/page')

Page({
  data: deviceState({ busy: false, error: '' }),
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  goBack() { wx.navigateBack() },
  onLoad(options) {
    this.returnPage = options.returnPage === 'writing' ? 'writing' : 'stem'
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
        wx.setStorageSync('stemistCropReturn', { route: this.returnPage || 'stem', createdAt: Date.now() })
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
