const { deviceState, syncDevice } = require('../../utils/page')
const { destinationById, resolveNavigation } = require('./registry.generated')
const { consumeAgentHandoff, queryFromRequest, requestFromOptions, requestFromQuery } = require('../../utils/agentHandoff')

function view(item) {
  return { kind: item.kind || 'destination', id: item.id, title: item.title, detail: item.detail, filters: item.filters || {}, stage: item.stage || '', routeId: item.routeId || '', routeLabel: item.routeLabel || '', pagePath: item.pagePath || '' }
}

Page({
  ...require('../../utils/share').public,
  entryPublic: true,
  data: deviceState({ state: 'loading', title: '选择学习入口', detail: '正在整理真实可用项…', request: {}, choices: [], destination: null, error: '' }),
  onLoad(options = {}) {
    this.__disposed = false
    const request = requestFromOptions(options)
    const pageId = typeof this.getPageId === 'function' ? this.getPageId() : 0
    const handoff = consumeAgentHandoff(getApp()?.globalData?.agentHandoffs, pageId)
    if (!request || (handoff && handoff.query !== queryFromRequest(request))) return this.fail('这个接力入口已失效，请返回重新选择。')
    if (handoff && !requestFromQuery(handoff.query)) return this.fail('这个接力入口无法验证，请返回重新选择。')
    return this.applyResolution(resolveNavigation(request))
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true },
  applyResolution(result) {
    if (!result || result.status === 'unsupported') return this.fail('暂时没有匹配的学习入口，请返回重新选择课程或任务。')
    if (result.status === 'ready') {
      const destination = destinationById(result.destination?.id)
      if (!destination) return this.fail('这个学习入口已更新，请返回重新选择。')
      this.setData({ state: 'ready', title: '入口已准备好', detail: '请确认后进入原生学习页面。', request: result.request || {}, choices: [], destination: view(destination), error: '' })
      return true
    }
    this.setData({ state: 'choose', title: '还需要你选择', detail: '选择最符合当前学习目标的一项。', request: result.request || {}, choices: result.choices.map(view), destination: null, error: '' })
    return true
  },
  chooseDestination(event) {
    const id = String(event?.currentTarget?.dataset?.destination || '')
    const choice = this.data.choices.find(item => item.id === id)
    if (!choice) return
    if (choice.kind === 'filter') return this.applyResolution(resolveNavigation({ ...this.data.request, ...choice.filters }))
    const destination = destinationById(id)
    if (!destination) return this.fail('这个学习入口已更新，请重新选择。')
    this.setData({ state: 'ready', title: '入口已准备好', detail: '请确认后进入原生学习页面。', choices: [], destination: view(destination), error: '' })
  },
  openDestination() {
    const id = String(this.data.destination?.id || '')
    const destination = destinationById(id)
    if (!destination || destination.pagePath !== this.data.destination?.pagePath) return this.fail('这个学习入口无法验证，请重新选择。')
    wx.navigateTo({ url: destination.pagePath, fail: () => { if (!this.__disposed) this.fail('页面暂时无法打开，请稍后重试。') } })
  },
  fail(message) {
    this.setData({ state: 'error', title: '入口未能打开', detail: '', request: {}, choices: [], destination: null, error: String(message || '请返回重试。') })
    return false
  },
})
