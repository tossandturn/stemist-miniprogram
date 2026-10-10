const { deviceState, syncDevice } = require('../../utils/page')
const { configuredPage, loadProductConfig, readProductConfigSnapshot, resolveProductAction } = require('../../utils/productConfig')

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const requestedId = value => {
  const clean = String(value || '').trim()
  return ID_PATTERN.test(clean) ? clean : ''
}

Page({
  data: deviceState({ state: 'loading', title: '内容加载中', sections: [], error: '', source: '' }),
  onLoad(options = {}) {
    this.__disposed = false
    this.__requestGeneration = 0
    this.__pageId = requestedId(options.id)
    this.__config = null
    if (!this.__pageId) {
      this.setData({ state: 'unknown', title: '内容暂不可用', sections: [], error: '这个内容页面不存在或链接无效。' })
      return Promise.resolve(false)
    }
    const snapshot = readProductConfigSnapshot()
    const page = configuredPage(snapshot.config, this.__pageId)
    if (page) this.applyPage(page, snapshot)
    else this.setData({ state: 'loading', title: '内容加载中', sections: [], error: '', source: '' })
    return this.refreshConfig({ preserveReady: Boolean(page) })
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true; this.__requestGeneration++ },
  applyPage(page, result) {
    this.__config = result.config
    this.setData({ state: 'ready', title: page.title, sections: page.sections, error: '', source: result.source || '' })
    if (typeof wx.setNavigationBarTitle === 'function') wx.setNavigationBarTitle({ title: page.title })
  },
  async refreshConfig({ preserveReady = false } = {}) {
    const generation = ++this.__requestGeneration
    if (!preserveReady) this.setData({ state: 'loading', title: '内容加载中', sections: [], error: '' })
    try {
      const result = await loadProductConfig()
      if (this.__disposed || generation !== this.__requestGeneration) return false
      const page = configuredPage(result.config, this.__pageId)
      if (!page) {
        this.__config = result.config
        if(result.unavailable)this.setData({ state: 'error', title: '暂时无法加载', sections: [], error: '网络连接失败，请稍后重试。', source: result.source || '' })
        else this.setData({ state: 'unknown', title: '内容暂不可用', sections: [], error: '这个内容页面暂不可用，可能尚未发布或已停止提供。', source: result.source || '' })
        return false
      }
      this.applyPage(page, result)
      return true
    } catch {
      if (this.__disposed || generation !== this.__requestGeneration) return false
      if (!preserveReady || this.data.state !== 'ready') this.setData({ state: 'error', title: '暂时无法加载', sections: [], error: '网络连接失败，请稍后重试。' })
      return false
    }
  },
  retry() { return this.refreshConfig() },
  openLink(event) {
    if (this.data.state !== 'ready' || !this.__config) return
    const sectionId = requestedId(event?.currentTarget?.dataset?.section), itemId = requestedId(event?.currentTarget?.dataset?.item)
    const section = this.data.sections.find(item => item.id === sectionId && item.type === 'links')
    const item = section?.items?.find(value => value.id === itemId)
    const resolved = item ? resolveProductAction(this.__config, item.action) : null
    if (!resolved) return wx.showToast?.({ title: '这个入口暂不可用', icon: 'none' })
    if (resolved.kind === 'navigate') return wx.navigateTo({ url: resolved.url, fail: () => wx.showToast?.({ title: '暂时无法打开', icon: 'none' }) })
    if (resolved.kind === 'copy') wx.setClipboardData({
      data: resolved.url,
      success: () => { if (!this.__disposed) wx.showToast?.({ title: '链接已复制', icon: 'success' }) },
      fail: () => { if (!this.__disposed) wx.showToast?.({ title: '复制失败，请重试', icon: 'none' }) },
    })
  },
  onShareAppMessage() {
    const page=this.__config&&configuredPage(this.__config,this.__pageId)
    if (this.data.state !== 'ready' || !page) return { title: 'STEMist', path: '/pages/index/index', imageUrl: '/design-system/share-card.png' }
    return { title: `STEMist · ${page.title}`, path: `/bundles/configured/index?id=${encodeURIComponent(page.id)}`, imageUrl: '/design-system/share-card.png' }
  },
  onShareTimeline() {
    const value = this.onShareAppMessage()
    return { title: value.title, query: value.path.split('?')[1] || '' }
  },
})
