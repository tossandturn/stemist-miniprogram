const { deviceState, syncDevice } = require('../../utils/page')
const { getJson } = require('../../utils/api')
const { localLearningSummary } = require('../../utils/learningSummary')
const { ensureWeChatSession } = require('../../utils/wechatAuth')
const { announcementViews, fetchAnnouncements, ownerId } = require('../../utils/announcements')
const { loadProductConfig, readProductConfigSnapshot, resolveProductAction } = require('../../utils/productConfig')
const ENTRY_POINTS = [
{id:'alevel',title:'A-Level 学科',detail:'IGCSE · AS · A2',tone:'alevel',url:'/pages/practice/index?category=alevel'},
{id:'ap',title:'AP',detail:'历年真题',tone:'ap',url:'/bundles/curricula/index?board=ap'},
{id:'ib',title:'IB',detail:'历年真题',tone:'ib',url:'/bundles/curricula/index?board=ib'},
{id:'ielts',title:'IELTS',detail:'听说读写 · 模考 · 词汇',tone:'ielts',url:'/pages/practice/index?category=ielts'},
{id:'competition',title:'竞赛 / 入学考试',detail:'BPhO · AMC · ESAT · TMUA 真题',tone:'competition',url:'/pages/papers/index?category=competition'},
{id:'calculator',title:'Casio 计算器',detail:'科学计算 · 历史记录',tone:'calculator',url:'/pages/calculator/index'},
]
const ENTRY_URLS=Object.freeze(ENTRY_POINTS.reduce((routes,item)=>{routes[item.id]=item.url;return routes},{}))
Page({
...require('../../utils/share').public,
data: deviceState({
user: null,
aiStatus: '正在检查 AI…',
homeHeading: '今天想学什么？',
entryPoints: ENTRY_POINTS,
secondaryLinks: [{id:'university-directory',label:'大学排名与官网',action:{kind:'page',target:'university-directory'}}],
entryLoading: '',
entryError: '',
wechatLoading: false,
recentActivity: null,
summary: { completedThisWeek: 0, draftCount: 0, submissionCount: 0 },
announcement: null,
announcementUnread: false,
announcementLoading: false,
announcementError: false,
}),
onShow() {
this.__disposed = false
syncDevice(this)
const productSnapshot=readProductConfigSnapshot();this.applyProductConfig(productSnapshot)
this.refreshProductConfig()
const token = wx.getStorageSync('stemistSessionToken')
const user = token ? (wx.getStorageSync('stemistUser') || null) : null
const summary = localLearningSummary()
const drafts = summary.draftCount
const recentActivity = token ? summary.recentActivity : null
this.setData({
user,
aiStatus: token ? '检查中…' : '登录后使用 AI',
recentActivity,
summary: { completedThisWeek: token ? summary.completedThisWeek : 0, draftCount: drafts, submissionCount: token ? summary.submissions.length : 0 },
})
this.loadAnnouncementPreview()
if (!token && !this.__wechatAutoAttempted) {
this.__wechatAutoAttempted = true
ensureWeChatSession({ silent: true }).then((result) => {
if (this.__disposed || !result || !result.user) return
const latest = localLearningSummary()
this.setData({ user: result.user, aiStatus: '微信已登录 · AI 可用', summary: { completedThisWeek: latest.completedThisWeek, draftCount: latest.draftCount, submissionCount: latest.submissions.length } });this.loadAnnouncementPreview()
}).catch(() => {})
}
getJson('/api/ai/status', { timeout: 6000 }).then((status) => {
if (this.__disposed) return
const connected = Boolean(status && status.provider && status.coachEnabled)
const hasToken = Boolean(wx.getStorageSync('stemistSessionToken'))
this.setData({ aiStatus: connected ? (hasToken ? 'AI 已连接' : 'AI 服务已就绪 · 请先微信登录') : 'AI 暂不可用' })
}).catch(() => { if (!this.__disposed) this.setData({ aiStatus: 'AI 暂不可用' }) })
},
onUnload() { this.__disposed = true;this.__productConfigRequest=(this.__productConfigRequest||0)+1 },
onResize() { syncDevice(this) },
applyProductConfig(result){
const config=result&&result.config
if(!config||!config.home)return
this.__productConfig=config
const entryPoints=Array.from(config.home.entries,item=>({id:item.id,title:item.title,detail:item.detail,tone:item.tone})),secondaryLinks=Array.from(config.home.secondary,item=>({id:item.id,label:item.label,action:{...item.action}}))
this.setData({homeHeading:config.home.heading,entryPoints,secondaryLinks})
},
async refreshProductConfig(){
const request=(this.__productConfigRequest||0)+1;this.__productConfigRequest=request
const result=await loadProductConfig()
if(this.__disposed||request!==this.__productConfigRequest)return false
this.applyProductConfig(result);return true
},
async loadAnnouncementPreview() {
const request = (this.__announcementRequest || 0) + 1
this.__announcementRequest = request
this.setData({ announcementLoading: true, announcementError: false })
try {
const result = await fetchAnnouncements({ limit: 2 })
if (this.__disposed || request !== this.__announcementRequest) return
const currentOwner = ownerId()
const items = announcementViews(result.items, currentOwner)
this.setData({ announcement: items[0] || null, announcementUnread: items.some((item) => item.unread) })
} catch {
if (!this.__disposed && request === this.__announcementRequest) this.setData({ announcement: null, announcementUnread: false, announcementError: true })
} finally { if (!this.__disposed && request === this.__announcementRequest) this.setData({ announcementLoading: false }) }
},
async loginWechat() {
if (this.data.wechatLoading) return
if (wx.getStorageSync('stemistSessionToken')) return wx.navigateTo({ url: '/pages/account/auth' })
this.setData({ wechatLoading: true, entryError: '' })
try {
const result = await ensureWeChatSession({ silent: false })
this.setData({ user: result.user || null, aiStatus: result.user ? 'AI 已连接' : '登录后使用 AI' })
if (result.user) wx.showToast({ title: '微信登录成功', icon: 'success' })
} catch {
this.setData({ entryError: '微信登录暂时不可用；可以先浏览入口，提交 AI 前再到 Account 重试。' })
} finally { this.setData({ wechatLoading: false }) }
},
openEntry(event) {
const id = String(event.currentTarget.dataset.entry || '')
const url = ENTRY_URLS[id]
if (!url || this.data.entryLoading) return
this.setData({ entryLoading: id, entryError: '' })
ensureWeChatSession({ silent: true }).then((result) => {
if (this.__disposed || !result || !result.user) return
this.setData({ user: result.user, aiStatus: '微信已登录 · AI 可用' })
}).catch(() => {
if (!this.__disposed) this.setData({ entryError: '' })
})
wx.navigateTo({ url, fail: () => this.setData({ entryError: '暂时无法打开，请重试。' }), complete: () => this.setData({ entryLoading: '' }) })
},
openSecondary(event){
const id=String(event.currentTarget?.dataset?.secondary||''),item=this.data.secondaryLinks.find(link=>link.id===id),resolved=item&&this.__productConfig?resolveProductAction(this.__productConfig,item.action):null
if(!resolved)return wx.showToast({title:'这个入口暂不可用',icon:'none'})
if(resolved.kind==='navigate')return wx.navigateTo({url:resolved.url,fail:()=>wx.showToast({title:'暂时无法打开',icon:'none'})})
if(resolved.kind==='copy')wx.setClipboardData({data:resolved.url,success:()=>{if(!this.__disposed)wx.showToast({title:'链接已复制',icon:'success'})},fail:()=>{if(!this.__disposed)wx.showToast({title:'复制失败，请重试',icon:'none'})}})
},
openStem() { wx.navigateTo({ url: '/pages/stem/capture' }) },
openPractice() { wx.navigateTo({ url: '/pages/practice/index' }) },
openPapers() { wx.navigateTo({ url: '/pages/papers/index' }) },
openAccount() { wx.navigateTo({ url: '/pages/account/auth' }) },
openCoach() { wx.navigateTo({ url: '/bundles/coach/index' }) },
openAnnouncements() { wx.navigateTo({ url: '/bundles/announcements/index' }) },
openIelts(event) {
const id = event.currentTarget.dataset.id
wx.navigateTo({ url: `/pages/ielts/${id}` })
},
})
