const { deviceState, syncDevice } = require('../../utils/page')
const { announcementViews, fetchAnnouncementManagement, fetchAnnouncements, ownerId, recordAnnouncementRead, unreadAnnouncementCount } = require('../../utils/announcements')

const filters = [{ id: 'all', label: '全部' }, { id: 'system', label: '系统' }, { id: 'feature', label: '更新' }, { id: 'learning', label: '学习' }, { id: 'service', label: '服务' }]

Page({
  data: deviceState({ loading: true, loadingMore: false, error: '', items: [], allItems: [], filters, activeFilter: 'all', expandedId: '', unreadCount: 0, canManage: false, total: 0, hasMore: false, nextOffset: null }),
  onLoad() { this.__disposed = false; this.__requestId = 0; this.__loaded = false; return this.loadAnnouncements() },
  onShow() { syncDevice(this); if (this.__loaded) this.loadAnnouncements() },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true; this.__requestId++ },
  filteredItems(items = this.data.allItems) {
    return this.data.activeFilter === 'all' ? items : items.filter((item) => item.category === this.data.activeFilter)
  },
  async loadAnnouncements({ append = false } = {}) {
    if (append && (!this.data.hasMore || this.data.loadingMore || this.data.loading)) return false
    const request = ++this.__requestId
    this.setData(append ? { loadingMore: true, error: '' } : { loading: true, error: '' })
    try {
      const managerRequest = wx.getStorageSync('stemistSessionToken') ? fetchAnnouncementManagement().catch(() => null) : Promise.resolve(null)
      const [result, manager] = await Promise.all([fetchAnnouncements({ limit: 30, offset: append ? this.data.nextOffset : 0 }), managerRequest])
      if (this.__disposed || request !== this.__requestId) return false
      const currentOwner = ownerId()
      const merged = append ? [...this.data.allItems, ...result.items] : result.items
      const allItems = announcementViews([...new Map(merged.map((item) => [item.id, item])).values()], currentOwner)
      this.setData({ allItems, items: this.filteredItems(allItems), unreadCount: unreadAnnouncementCount(allItems, currentOwner), canManage: manager?.canManage === true, total: Number(result.total) || allItems.length, hasMore: result.hasMore === true, nextOffset: Number.isInteger(result.nextOffset) ? result.nextOffset : null })
      return true
    } catch (error) {
      if (!this.__disposed && request === this.__requestId) this.setData(append ? { error: error?.message || '更多公告暂时无法读取，请稍后重试。' } : { error: error?.message || '公告暂时无法读取，请稍后重试。', allItems: [], items: [], unreadCount: 0, canManage: false, total: 0, hasMore: false, nextOffset: null })
      return false
    } finally {
      if (!this.__disposed && request === this.__requestId) { this.__loaded = true; this.setData(append ? { loadingMore: false } : { loading: false }) }
    }
  },
  retry() { return this.loadAnnouncements() },
  loadMore() { return this.loadAnnouncements({ append: true }) },
  chooseFilter(event) {
    const filter = String(event.currentTarget?.dataset?.filter || 'all')
    if (!filters.some((item) => item.id === filter) || filter === this.data.activeFilter) return
    this.setData({ activeFilter: filter, items: filter === 'all' ? this.data.allItems : this.data.allItems.filter((item) => item.category === filter) })
  },
  async openAnnouncement(event) {
    const id = String(event.currentTarget?.dataset?.id || '')
    const item = this.data.allItems.find((value) => value.id === id)
    if (!item) return
    if (this.data.expandedId === id) {
      this.setData({ expandedId: '' })
      return
    }
    await recordAnnouncementRead(item, ownerId())
    if (this.__disposed) return
    const allItems = announcementViews(this.data.allItems, ownerId())
    this.setData({ expandedId: id, allItems, items: this.data.activeFilter === 'all' ? allItems : allItems.filter((value) => value.category === this.data.activeFilter), unreadCount: unreadAnnouncementCount(allItems, ownerId()) })
  },
  openAction(event) {
    const item = this.data.allItems.find((value) => value.id === String(event.currentTarget?.dataset?.id || ''))
    if (!item?.action?.url) return
    wx.navigateTo({ url: item.action.url, fail: () => this.setData({ error: '暂时无法打开对应页面，请稍后重试。' }) })
  },
  openManage() { if (this.data.canManage) wx.navigateTo({ url: '/bundles/announcements/manage' }) },
  onShareAppMessage() { return { title: 'STEMist · 公告与更新', path: '/bundles/announcements/index', imageUrl: '/design-system/share-card.png' } },
  onShareTimeline() { return { title: 'STEMist · 公告与更新', query: '' } },
})
