import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime, settle } from './helpers/mini-runtime.mjs'

const notice = {
  id: 'notice-feature-1',
  title: '公告中心已上线',
  summary: '课程更新、资料状态和服务通知会集中发布在这里。',
  body: '公告中心支持置顶、未读标记和安全的站内跳转。',
  category: 'feature',
  pinned: true,
  publishedAt: '2026-09-30T08:00:00.000Z',
  updatedAt: '2026-09-30T08:00:00.000Z',
  action: { label: '开始学习', url: '/pages/practice/index?category=alevel' },
}
const secondNotice = { ...notice, id: 'notice-feature-2', title: '第二条公告', summary: '即使第一条已读也要提示。', pinned: false }

const calls = []
let publicFetches = 0
const runtime = miniRuntime({
  modules: {
    'utils/api': {
      getJson: async (path, options) => {
        calls.push({ kind: 'get', path, options })
        if (path === '/api/ai/status') return { provider: 'qwen', coachEnabled: true }
        if (path.startsWith('/api/stem/announcements?')) {
          publicFetches += 1
          if (path.includes('offset=30')) return { schemaVersion: 'stem-announcements-v1', items: [secondNotice], total: 31, offset: 30, nextOffset: null, hasMore: false }
          if (publicFetches === 1) return { schemaVersion: 'stem-announcements-v1', items: [{ ...notice, readAt: '2026-09-30T08:01:00.000Z' }, secondNotice], total: 2, offset: 0, nextOffset: null, hasMore: false }
          return { schemaVersion: 'stem-announcements-v1', items: [notice], total: 31, offset: 0, nextOffset: 30, hasMore: true }
        }
        if (path === '/api/stem/announcements/manage') return { schemaVersion: 'stem-announcements-v1', canManage: true, items: [notice] }
        throw new Error(`Unexpected GET ${path}`)
      },
      requestJson: async (path, body, options) => {
        calls.push({ kind: 'request', path, body, options })
        if (path.endsWith('/read')) return { receipt: { announcementId: notice.id, readAt: '2026-09-30T08:01:00.000Z' } }
        if (path === '/api/stem/announcements') return { announcement: { ...notice, id: 'notice-created', status: body.status } }
        if (path === `/api/stem/announcements/${notice.id}`) return { announcement: { ...notice, ...body } }
        throw new Error(`Unexpected request ${path}`)
      },
    },
    'utils/wechatAuth': { ensureWeChatSession: async () => ({ user: { id: 'ielts:7' } }) },
  },
  wx: {
    showToast() {},
    showModal({ success }) { success({ confirm: true }) },
    pageScrollTo() {},
  },
})

runtime.storage.set('stemistSessionToken', 'fixture-token')
runtime.storage.set('stemistUser', { id: 'ielts:7', roles: ['school_admin'] })

const announcementService = runtime.load('utils/announcements')
assert.equal(announcementService.normalizeAnnouncement({ ...notice, action: { label: 'Bad', url: 'https://example.com' } }).action, null)
assert.equal(announcementService.isSafeAnnouncementRoute('/pages/practice/index?category=alevel'), true)
assert.equal(announcementService.isSafeAnnouncementRoute('/pages/../account/auth'), false)
assert.equal(announcementService.unreadAnnouncementCount([notice], 'ielts:7'), 1)

const home = runtime.page('pages/index/index')
home.onShow()
await settle()
await settle()
assert.equal(home.data.announcement.title, notice.title)
assert.equal(home.data.announcementUnread, true)
home.openAnnouncements()
assert.equal(runtime.calls.at(-1).url, '/bundles/announcements/index')

const board = runtime.page('bundles/announcements/index')
await board.onLoad()
assert.equal(board.data.items.length, 1)
assert.equal(board.data.items[0].unread, true)
assert.equal(board.data.canManage, true)
assert.equal(board.data.hasMore, true)
const publicLoadCount = calls.filter((call) => call.kind === 'get' && call.path.startsWith('/api/stem/announcements?')).length
board.onShow()
await settle()
await settle()
assert.ok(calls.filter((call) => call.kind === 'get' && call.path.startsWith('/api/stem/announcements?')).length > publicLoadCount, 'returning to the board must refresh published announcements')
await board.loadMore()
assert.equal(board.data.items.length, 2)
assert.equal(board.data.hasMore, false)
await board.openAnnouncement({ currentTarget: { dataset: { id: notice.id } } })
assert.equal(board.data.expandedId, notice.id)
assert.equal(board.data.items[0].unread, false)
assert.equal(announcementService.unreadAnnouncementCount([notice], 'ielts:7'), 0)
assert.equal(calls.some((call) => call.path === `/api/stem/announcements/${notice.id}/read`), true)
board.openAction({ currentTarget: { dataset: { id: notice.id } } })
assert.equal(runtime.calls.at(-1).url, notice.action.url)
board.openManage()
assert.equal(runtime.calls.at(-1).url, '/bundles/announcements/manage')

const manager = runtime.page('bundles/announcements/manage')
await manager.onLoad()
assert.equal(manager.data.canManage, true)
manager.setData({ 'draft.title': '维护通知', 'draft.summary': '今晚更新', 'draft.body': '公告内容', 'draft.category': 'service' })
await manager.saveAnnouncement({ currentTarget: { dataset: { status: 'published' } } })
const saved = [...calls].reverse().find((call) => call.kind === 'request' && call.path === '/api/stem/announcements')
assert.equal(saved.body.status, 'published')
assert.equal(saved.body.title, '维护通知')

const app = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'))
const announcementPackage = app.subPackages.find((item) => item.root === 'bundles/announcements')
assert.deepEqual(announcementPackage?.pages, ['index', 'manage'])
const homeMarkup = fs.readFileSync(new URL('../pages/index/index.wxml', import.meta.url), 'utf8')
assert.match(homeMarkup, /公告与更新/)
assert.match(homeMarkup, /openAnnouncements/)
const boardCss = fs.readFileSync(new URL('../bundles/announcements/index.wxss', import.meta.url), 'utf8')
const managerCss = fs.readFileSync(new URL('../bundles/announcements/manage.wxss', import.meta.url), 'utf8')
assert.match(boardCss, /announcement-filters button\{[^}]*min-height:44px/)
assert.match(boardCss, /safe-area-inset-bottom/)
assert.match(managerCss, /announcement-manager-card-actions button\{[^}]*min-height:44px/)
console.log('Announcement board: public reading, unread receipts, management route and safe actions passed.')
