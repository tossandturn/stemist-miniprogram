Page({
  data: { src: '', x: 0, y: 0, scale: 1, busy: false, error: '', canvasWidth: 1, canvasHeight: 1 },
  onLoad(options) { this.setData({ src: options.src ? decodeURIComponent(options.src) : '' }) },
  onMove(e) { this.setData({ x: e.detail.x, y: e.detail.y }) },
  onScale(e) { this.setData({ scale: e.detail.scale }) },
  confirm() {
    if (this.data.busy || !this.data.src) return
    this.setData({ busy: true, error: '' })
    wx.getImageInfo({
      src: this.data.src,
      success: (info) => {
        const query = wx.createSelectorQuery().in(this)
        query.select('.crop-image').boundingClientRect()
        query.select('.crop-box').boundingClientRect()
        query.exec((rects) => {
          const imageRect = rects?.[0]
          const boxRect = rects?.[1]
          if (!imageRect || !boxRect) {
            this.setData({ busy: false, error: '裁剪区域尚未准备好，请重试' })
            return
          }
          // aspectFit uses the smaller ratio; include the movable-view translation
          // and scale so the exported pixels match what the student sees.
          const fitScale = Math.min(imageRect.width / info.width, imageRect.height / info.height)
          const renderedWidth = info.width * fitScale * this.data.scale
          const renderedHeight = info.height * fitScale * this.data.scale
          const imageCenterX = imageRect.left + imageRect.width / 2 + Number(this.data.x || 0)
          const imageCenterY = imageRect.top + imageRect.height / 2 + Number(this.data.y || 0)
          const offsetX = imageCenterX - renderedWidth / 2
          const offsetY = imageCenterY - renderedHeight / 2
          const sourceScale = fitScale * Math.max(0.01, Number(this.data.scale || 1))
          const sx = Math.min(Math.max(0, info.width - 1), Math.max(0, Math.round((boxRect.left - offsetX) / sourceScale)))
          const sy = Math.min(Math.max(0, info.height - 1), Math.max(0, Math.round((boxRect.top - offsetY) / sourceScale)))
          const sw = Math.min(info.width - sx, Math.max(1, Math.round(boxRect.width / sourceScale)))
          const sh = Math.min(info.height - sy, Math.max(1, Math.round(boxRect.height / sourceScale)))
          this.exportCrop(sx, sy, sw, sh, info)
        })
      },
      fail: (error) => this.setData({ busy: false, error: error.errMsg || '图片读取失败' }),
    })
  },
  exportCrop(sx, sy, sw, sh, info) {
    const destWidth = Math.max(1, Math.min(sw, 1600))
    const destHeight = Math.max(1, Math.min(sh, 1600))
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
    wx.setStorageSync('stemistCroppedImage', path)
    wx.redirectTo({ url: `/pages/stem/coach?src=${encodeURIComponent(path)}` })
  },
  cancel() { wx.navigateBack() },
})
