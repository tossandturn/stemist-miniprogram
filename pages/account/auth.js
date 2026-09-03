const { signIn, currentUser } = require('../../utils/auth')
const { deviceState, syncDevice } = require('../../utils/page')

Page({
  data: deviceState({ mode: 'login', username: '', password: '', loading: false, error: '' }),
  onShow() {
    syncDevice(this)
    const user = currentUser()
    if (user && user.username) this.setData({ username: user.username })
  },
  onResize() { syncDevice(this) },
  goBack() { wx.navigateBack() },
  openPrivacy() { wx.navigateTo({ url: '/pages/legal/privacy' }) },
  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value, error: '' }) },
  toggleMode() { this.setData({ mode: this.data.mode === 'login' ? 'register' : 'login', error: '' }) },
  async submit() {
    const username = this.data.username.trim()
    const password = this.data.password
    if (this.data.loading) return
    if (username.length < 3 || password.length < 6) return this.setData({ error: '用户名至少 3 个字符，密码至少 6 个字符' })
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
