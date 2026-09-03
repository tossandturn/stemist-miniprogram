const { deviceState, syncDevice } = require('../../utils/page')

Page({
  data: deviceState({}),
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  goBack() { wx.navigateBack() },
})
