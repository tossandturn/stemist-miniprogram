// Synthetic presentation only. Never calls checkout, changes login storage or pays.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { call, evaluate, until } = require('./helpers/wechat-cli.cjs')
const outputIndex = process.argv.indexOf('--output')
const output = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1]) : path.resolve(__dirname, '../../qa-membership-native')
fs.mkdirSync(output, { recursive: true })
async function main() {
  const page = await call('automation_runtime_info', { action: 'currentPage' })
  if (page.currentPage?.path !== 'bundles/account/membership') await call('automation_navigate', { action: 'navigateTo', url: '/bundles/account/membership' })
  await until(function () { return getCurrentPages().at(-1)?.route === 'bundles/account/membership' }, 'Membership page')
  await call('automation_viewport_action', { action: 'pageScrollTo', scrollTop: 0 })
  await evaluate(function () { const p = getCurrentPages().at(-1); p._generation++; p.clearPoll(); p.setData({ loading: false, busy: false, loggedIn: true, checkoutEnabled: false, consent: false, plan: { id: 'all-access-month', title: '全功能月卡', priceFen: 2880, priceLabel: '28.80', durationDays: 30, autoRenew: false, currency: 'CNY' }, entitlement: { active: false }, error: '', orderError: '', phase: 'idle', orders: [], notice: '', checkoutNote: '微信支付正在开通，暂不收款。' }); return true })
  await call('simulator_screenshot', { path: path.join(output, 'membership-setup.png'), optimize: false, waitForSelector: '.member-price' })
  await evaluate(function () { const app = getApp(); app.__memberGeometry = null; const q = wx.createSelectorQuery(); q.select('.membership-card').boundingClientRect(); q.select('.member-cta').boundingClientRect(); q.select('.member-orders').boundingClientRect(); q.exec(rows => { app.__memberGeometry = { card: rows[0], cta: rows[1], orders: rows[2], viewport: wx.getWindowInfo() } }); return true })
  const geometry = await until(function () { const g = getApp().__memberGeometry; return g ? { card: g.card, cta: g.cta, orders: g.orders, width: g.viewport.windowWidth, height: g.viewport.windowHeight } : null }, 'Membership geometry')
  assert.ok(geometry.card && geometry.cta && geometry.orders)
  for (const rect of [geometry.card, geometry.cta, geometry.orders]) { assert.ok(rect.left >= -1); assert.ok(rect.right <= geometry.width + 1) }
  assert.ok(geometry.cta.height >= 44)
  assert.ok(geometry.cta.bottom <= geometry.height - 80, 'Purchase entry must be visible above bottom navigation in the first viewport')
  await call('automation_page_action', { action: 'setData', patch: JSON.stringify({ busy: true, phase: 'confirming', notice: '验收示例：正在确认订单，请勿重复付款。', pendingOrderId: 'DEMOORDER2026101401', pendingOrderShort: '2026101401' }) })
  await call('automation_viewport_action', { action: 'pageScrollTo', scrollTop: Math.max(0, geometry.cta.top - 130) })
  await call('simulator_screenshot', { path: path.join(output, 'membership-confirming.png'), optimize: false, waitForSelector: '.member-progress' })
  const report = { status: 'PASS', scope: 'Native WeChat simulator at actual viewport; synthetic data; not physical iPad or live payment', usesSyntheticPageData: true, paymentInvocations: 0, checkoutRequests: 0, scriptLoginStorageWrites: false, automaticAuthRefreshMayOccur: true, geometry }
  fs.writeFileSync(path.join(output, 'membership-native.json'), JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' })
  console.log(JSON.stringify(report))
  await evaluate(function () { delete getApp().__memberGeometry; const p = getCurrentPages().at(-1); p.setData({ busy: false, notice: '', pendingOrderId: '', pendingOrderShort: '', phase: 'idle' }); p.onShow(); return true })
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
