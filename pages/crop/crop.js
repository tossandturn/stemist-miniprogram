const { deviceState, syncDevice } = require('../../utils/page')
const { computeCropRect, resizedCropSize } = require('../../utils/crop')

Page({
  data: deviceState({ src: '', x: 0, y: 0, scale: 1, busy: false, error: '', canvasWidth: 1, canvasHeight: 1 }),
  onLoad(options) { options = options || {}; this.setData({ src: options.src ? decodeURIComponent(options.src) : '' }) },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onMove(e) { this.setData({ x: e.detail.x, y: e.detail.y }) },
  onScale(e) { this.setData({ scale: e.detail.scale }) },
  confirm() {
    if (this.data.busy || !this.data.src) return
    this.setData({ busy: true, error: '' })
    wx.getImageInfo({
      src: this.data.src,
      success: (info) => {
        const query = wx.createSelectorQuery().in(this)
        query.select('.crop-content').boundingClientRect()
        query.select('.crop-box').boundingClientRect()
        query.exec((rects) => {
          const imageRect = rects && rects[0]
          const boxRect = rects && rects[1]
          if (!imageRect || !boxRect) {
            this.setData({ busy: false, error: '裁剪区域尚未准备好，请重试' })
            return
          }
          const crop = computeCropRect({ viewport: imageRect, box: boxRect, imageWidth: info.width, imageHeight: info.height })
          this.exportCrop(crop.sx, crop.sy, crop.sw, crop.sh)
        })
      },
      fail: (error) => this.setData({ busy: false, error: error.errMsg || '图片读取失败' }),
    })
  },
  exportCrop(sx, sy, sw, sh) {
    const output = resizedCropSize(sw, sh)
    const destWidth = output.width
    const destHeight = output.height
    this.setData({ canvasWidth: destWidth, canvasHeight: destHeight }, () => {
      const ctx = wx.createCanvasContext('cropCanvas', this)
      ctx.clearRect(0, 0, destWidth, destHeight)
      ctx.drawImage(this.data.src, sx, sy, sw, sh, 0, 0, destWidth, destHeight)
      ctx.draw(false, () => wx.canvasToTempFilePath({
        canvasId: 'cropCanvas',
        x: 0,
        y: 0,
        width: destWidth,
        height: destHeight,
        destWidth,
        destHeight,
        fileType: 'jpg',
        quality: 0.86,
        success: ({ tempFilePath }) => this.finish(tempFilePath),
        fail: (error) => this.setData({ busy: false, error: error.errMsg || '裁剪失败，请重试' }),
      }, this))
    })
  },
  finish(path) {
    const returnInfo = wx.getStorageSync('stemistCropReturn') || { route: 'stem' }
    if (returnInfo.route === 'writing') {
      wx.setStorageSync('stemistWritingPhoto', path)
      wx.navigateBack({ delta: 2 })
      return
    }
    wx.setStorageSync('stemistCoachContext', returnInfo.context || {})
    wx.setStorageSync('stemistCroppedImage', path)
    wx.redirectTo({ url: `/pages/stem/coach?src=${encodeURIComponent(path)}` })
  },
  cancel() { wx.navigateBack() },
})
