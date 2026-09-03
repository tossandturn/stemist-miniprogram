const { deviceState, syncDevice } = require('../../utils/page')

Page({
  data: deviceState({ webviewUrl: 'https://ieltsist.com/?module=speaking#bank' }),
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  openBack() { wx.navigateBack() },
})
