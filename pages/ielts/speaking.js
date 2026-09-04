const { deviceState, syncDevice } = require('../../utils/page')
const { ieltsWebUrl } = require('../../utils/ieltsCatalog')

Page({
  data: deviceState({ webviewUrl: ieltsWebUrl('speaking', { source: 'mini-speaking' }), webviewState: 'loading', webviewError: '' }),
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onWebViewLoad() { this.setData({ webviewState: 'ready', webviewError: '' }) },
  onWebViewError() { this.setData({ webviewState: 'error', webviewError: 'Speaking 页面暂时无法打开，请检查业务域名和网络后重试。' }) },
  retryWebView() { this.setData({ webviewState: 'loading', webviewError: '', webviewUrl: `${this.data.webviewUrl.split('#')[0]}&retry=${Date.now()}#bank` }) },
  openBack() { wx.navigateBack() },
})
