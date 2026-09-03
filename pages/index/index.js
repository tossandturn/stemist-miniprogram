Page({
  data: {
    user: null,
    ieltsCards: [
      { id: 'listening', title: 'Listening', detail: '听力题用文本框记录答案与复盘。' },
      { id: 'reading', title: 'Reading', detail: '阅读题用文本框提交定位、判断和答案。' },
      { id: 'writing', title: 'Writing', detail: '可以打字，也可以拍照上传手写作文。' },
      { id: 'speaking', title: 'Speaking', detail: '继续使用 IELTSist 的千问口语对话。' },
    ],
  },
  onShow() { this.setData({ user: wx.getStorageSync('stemistUser') || null }) },
  openAccount() { wx.navigateTo({ url: '/pages/account/auth' }) },
  openStem() { wx.navigateTo({ url: '/pages/stem/capture' }) },
  openIelts(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/ielts/${id}` })
  },
})
