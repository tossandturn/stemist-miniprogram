const { deviceState, syncDevice } = require('../../utils/page')
const { CATEGORIES, fetchAnnouncementManagement, isSafeAnnouncementRoute, saveAnnouncement } = require('../../utils/announcements')

const categoryOptions = Object.entries(CATEGORIES).map(([id, label]) => ({ id, label }))
const blankDraft = () => ({ title: '', summary: '', body: '', category: 'system', pinned: false, actionLabel: '', actionUrl: '', expiresAt: '' })

Page({
  ...require('../../utils/share'),
  data: deviceState({ loading: true, saving: false, canManage: false, error: '', status: '', items: [], categoryOptions, categoryIndex: 0, editingId: '', draft: blankDraft() }),
  onLoad() { this.__disposed = false; this.__items = []; return this.loadAnnouncements() },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true },
  async loadAnnouncements({ preserveStatus = false } = {}) {
    this.setData({ loading: true, error: '', ...(preserveStatus ? {} : { status: '' }) })
    try {
      const result = await fetchAnnouncementManagement()
      if (this.__disposed) return false
      this.__items = result.items
      this.setData({ canManage: true, items: result.items })
      return true
    } catch (error) {
      if (!this.__disposed) this.setData({ canManage: false, items: [], error: error?.message || '当前账号没有公告管理权限。' })
      return false
    } finally {
      if (!this.__disposed) this.setData({ loading: false })
    }
  },
  beginNew() { if (!this.data.saving) this.setData({ editingId: '', draft: blankDraft(), categoryIndex: 0, error: '', status: '正在新建公告。' }) },
  editAnnouncement(event) {
    if (this.data.saving) return
    const item = this.__items.find((value) => value.id === String(event.currentTarget?.dataset?.id || ''))
    if (!item) return
    const categoryIndex = Math.max(0, categoryOptions.findIndex((value) => value.id === item.category))
    this.setData({ editingId: item.id, draft: { title: item.title, summary: item.summary, body: item.body, category: item.category, pinned: item.pinned, actionLabel: item.action?.label || '', actionUrl: item.action?.url || '', expiresAt: item.expiresAt || '' }, categoryIndex, error: '', status: `正在编辑“${item.title}”。` })
    wx.pageScrollTo?.({ scrollTop: 0, duration: 180 })
  },
  updateField(event) {
    if (this.data.saving) return
    const field = String(event.currentTarget?.dataset?.field || '')
    if (!['title', 'summary', 'body', 'actionLabel', 'actionUrl', 'expiresAt'].includes(field)) return
    this.setData({ [`draft.${field}`]: String(event.detail?.value || ''), error: '', status: '' })
  },
  chooseCategory(event) {
    const index = Number(event.detail?.value)
    const option = categoryOptions[index]
    if (!option || this.data.saving) return
    this.setData({ categoryIndex: index, 'draft.category': option.id, error: '', status: '' })
  },
  togglePinned(event) { if (!this.data.saving) this.setData({ 'draft.pinned': event.detail?.value === true, error: '', status: '' }) },
  async saveAnnouncement(event) {
    if (this.data.saving || !this.data.canManage) return
    const status = event.currentTarget?.dataset?.status === 'published' ? 'published' : 'draft'
    const draft = { ...this.data.draft, status }
    if (!draft.title.trim() || !draft.body.trim()) return this.setData({ error: '请填写公告标题和正文。', status: '' })
    if ((draft.actionLabel.trim() || draft.actionUrl.trim()) && (!draft.actionLabel.trim() || !isSafeAnnouncementRoute(draft.actionUrl.trim()))) return this.setData({ error: '跳转仅支持已登记的小程序站内路径。', status: '' })
    this.setData({ saving: true, error: '', status: status === 'published' ? '正在发布公告…' : '正在保存草稿…' })
    try {
      await saveAnnouncement(this.data.editingId, draft)
      if (this.__disposed) return
      this.setData({ editingId: '', draft: blankDraft(), categoryIndex: 0, status: status === 'published' ? '公告已发布。' : '草稿已保存。' })
      await this.loadAnnouncements({ preserveStatus: true })
    } catch (error) {
      if (!this.__disposed) this.setData({ error: error?.message || '公告保存失败，请稍后重试。', status: '' })
    } finally {
      if (!this.__disposed) this.setData({ saving: false })
    }
  },
  archiveAnnouncement(event) {
    if (this.data.saving || !this.data.canManage) return
    const id = String(event.currentTarget?.dataset?.id || '')
    const item = this.__items.find((value) => value.id === id)
    if (!item) return
    wx.showModal({ title: '下线公告', content: `确定下线“${item.title}”吗？学生将不再看到它。`, success: async (result) => {
      if (!result.confirm || this.__disposed) return
      this.setData({ saving: true, error: '', status: '正在下线公告…' })
      try {
        await saveAnnouncement(id, { ...item, actionLabel: item.action?.label || '', actionUrl: item.action?.url || '', status: 'archived' })
        if (!this.__disposed) { this.setData({ status: '公告已下线。' }); await this.loadAnnouncements({ preserveStatus: true }) }
      } catch (error) {
        if (!this.__disposed) this.setData({ error: error?.message || '公告下线失败，请稍后重试。', status: '' })
      } finally { if (!this.__disposed) this.setData({ saving: false }) }
    } })
  },
  backToBoard() { if (!this.data.saving) wx.navigateBack({ fail: () => wx.redirectTo({ url: '/bundles/announcements/index' }) }) },
})
