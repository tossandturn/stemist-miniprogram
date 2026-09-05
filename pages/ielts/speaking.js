const { deviceState, syncDevice } = require('../../utils/page')
const { ieltsWebUrl } = require('../../utils/ieltsCatalog')

Page({
  data: deviceState({ webviewUrl: ieltsWebUrl('speaking', { source: 'mini-speaking' }), webviewState: 'loading', webviewError: '' }),
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onWebViewLoad() { this.setData({ webviewState: 'ready', webviewError: '' }) },
  onWebViewError() { this.setData({ webviewUrl: '', webviewState: 'error', webviewError: '口语页面暂时无法打开，请检查网络后重试。' }) },
  retryWebView() { const url = ieltsWebUrl('speaking', { source: 'mini-speaking' }); this.setData({ webviewState: 'loading', webviewError: '', webviewUrl: `${url.split('#')[0]}&retry=${Date.now()}#bank` }) },
  openBack() { wx.navigateBack() },
})
