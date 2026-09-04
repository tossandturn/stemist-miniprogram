const { signIn, currentUser, signOut } = require('../../utils/auth')
const { deviceState, syncDevice } = require('../../utils/page')
const { ensureWeChatSession } = require('../../utils/wechatAuth')

Page({
  data: deviceState({ mode: 'login', username: '', password: '', loading: false, wechatLoading: false, error: '', user: null }),
  onShow() {
    syncDevice(this)
    const user = wx.getStorageSync('stemistSessionToken') ? currentUser() : null
    this.setData({ user: user || null })
    if (user && user.username) this.setData({ username: user.username })
  },
  onResize() { syncDevice(this) },
  goBack() { wx.navigateBack() },
  async loginWechat() {
    if (this.data.loading || this.data.wechatLoading) return
    this.setData({ wechatLoading: true, error: '' })
    try {
      const result = await ensureWeChatSession({ silent: false })
      this.setData({ user: result.user || currentUser() })
      wx.showToast({ title: '微信登录成功', icon: 'success' })
    } catch (error) {
      this.setData({ error: error.message || '微信登录暂时不可用，请稍后重试。' })
    } finally { this.setData({ wechatLoading: false }) }
  },
  openPrivacy() { wx.navigateTo({ url: '/pages/legal/privacy' }) },
  openIeltsAccount() { wx.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent('https://ieltsist.com/?module=account&from=stemist')}` }) },
  logout() {
    if (this.data.loading) return
    signOut()
    this.setData({ user: null, password: '', error: '', mode: 'login' })
    wx.showToast({ title: '已退出登录', icon: 'success' })
  },
  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value, error: '' }) },
  toggleMode() { this.setData({ mode: this.data.mode === 'login' ? 'register' : 'login', error: '' }) },
  async submit() {
    const username = this.data.username.trim().toLowerCase()
    const password = this.data.password
    if (this.data.loading) return
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return this.setData({ error: '用户名需为 3–24 位字母、数字或下划线' })
    if (password.length < 6 || password.length > 72) return this.setData({ error: '密码需为 6–72 个字符' })
    this.setData({ loading: true, error: '' })
    try {
      await signIn(username, password, this.data.mode)
      wx.showToast({ title: this.data.mode === 'login' ? '登录成功' : '注册成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 450)
    } catch (error) {
      this.setData({ error: error.message || '账号操作失败，请稍后重试' })
    } finally { this.setData({ loading: false }) }
  },
})
