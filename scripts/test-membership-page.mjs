import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime, deferred, settle } from './helpers/mini-runtime.mjs'

const plan = { id: 'all-access-month', title: '全功能月卡', priceFen: 2880, priceLabel: '28.80', currency: 'CNY', durationDays: 30, autoRenew: false }
let enabled = false, creates = 0, invoked = 0, reads = 0, pending = null, gate
let state = 'pending', listedOrders = []
const expired = { active: false, planId: '', startsAt: null, expiresAt: null }
const order = { id: 'MEMBER202610140000001', status: 'pending', priceFen: 2880, priceLabel: '28.80', currency: 'CNY', durationDays: 30, planId: plan.id }
const runtime = miniRuntime({ modules: { 'bundles/account/membershipData': {
  context: () => ({ owner: String(runtime.storage.get('stemistUser')?.id || 'guest'), epoch: 0 }),
  assertContext: expected => { if (expected.owner !== runtime.storage.get('stemistUser')?.id) throw new Error('账号已变化') },
  fetchCatalog: async () => ({ plan, commerce: { checkoutEnabled: enabled }, enforcement: { enabled: false } }),
  fetchStatus: async () => ({ entitlement: expired }),
  fetchOrders: async () => ({ orders: listedOrders, hasMore: false }),
  fetchOrder: async () => { reads++; return { order: { ...order, status: state }, entitlement: state === 'fulfilled' ? { ...expired, active: true, expiresAt: new Date(Date.now() + 86400000).toISOString() } : expired } },
  createOrder: async () => { creates++; if (gate) await gate.promise; return { order, payment: {} } },
  invokePayment: async () => { invoked++; return { submitted: true } },
  newIdempotencyKey: () => 'membership-fixture-key', readPending: () => pending,
  rememberPending: value => { pending = value }, forgetPending: () => { pending = null },
} }, wx: { login: options => options.success({ code: 'fixture-code' }), showToast() {}, getSystemInfoSync: () => ({ platform: 'android', windowWidth: 390, windowHeight: 844, deviceType: 'phone' }) } })
runtime.storage.set('stemistUser', { id: 'ielts:42' }); runtime.storage.set('stemistSessionToken', 'fixture')
const page = runtime.page('bundles/account/membership')
page.onLoad(); await page.onShow()
assert.equal(page.data.plan.priceLabel, '28.80')
assert.equal(page.data.checkoutEnabled, false)
page.data.consent = true
await page.purchase()
assert.equal(creates, 0, 'merchant not ready must never create or invoke payment')
assert.equal(invoked, 0)

enabled = true
await page.refresh()
page.data.consent = false
await page.purchase()
assert.equal(creates, 0, 'price confirmation is required')
page.data.consent = true
gate = deferred()
const first = page.purchase()
await settle()
await page.purchase()
assert.equal(creates, 1, 'rapid taps must share one in-flight order')
gate.resolve(); await first; gate = null
assert.equal(invoked, 1)
assert.equal(page.data.entitlement.active, false, 'native payment callback cannot mark membership active')
assert.equal(page.data.phase, 'confirming')
assert.equal(pending.orderId, order.id)
page.onHide()
assert.equal(page._pollTimer, null)

state = 'fulfilled'
await page.onShow()
assert.equal(page.data.entitlement.active, true)
assert.equal(page.data.phase, 'success')
assert.equal(pending, null)
assert.ok(reads >= 2)

pending = { idempotencyKey: 'another-pending-key', orderId: 'MEMBER202610140000002' }
page.applyConfirmed({ order: { ...order, status: 'fulfilled' }, entitlement: { active: true, expiresAt: new Date(Date.now() + 86400000).toISOString() } })
assert.equal(pending.orderId, 'MEMBER202610140000002', 'viewing an older completed order must not erase another pending purchase')
pending = null

// Delayed order responses after logout must not launch native payment.
await page.refresh(); page.data.consent = true
gate = deferred()
const late = page.purchase(); await settle()
const priorInvoked = invoked
runtime.storage.set('stemistUser', { id: 'ielts:99' })
await page.onShow()
assert.equal(page.data.busy, false, 'switching account must release the old account UI lock')
gate.resolve(); await late; gate = null
assert.equal(invoked, priorInvoked)
assert.equal(page.data.busy, false)
page.onUnload()

// Logout removes the local pointer. The authority order list must restore an
// unknown attempt without creating a new payable order for the same owner.
pending = null; state = 'pending'; listedOrders = [order]
runtime.storage.set('stemistUser', { id: 'ielts:42' })
const restored = runtime.page('bundles/account/membership'); restored.onLoad(); await restored.onShow()
assert.equal(pending.orderId, order.id)
assert.equal(pending.paymentAttemptState, 'unknown')
const beforeCreates = creates, beforeInvocations = invoked
restored.data.consent = true
await restored.purchase()
assert.equal(creates, beforeCreates)
assert.equal(invoked, beforeInvocations)
restored.onUnload()

const manifest = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'))
assert.ok(manifest.subPackages.find(item => item.root === 'bundles/account').pages.includes('membership'))
const markup = fs.readFileSync(new URL('../bundles/account/membership.wxml', import.meta.url), 'utf8')
assert.match(markup, /30/)
assert.match(markup, /非自动续费/)
assert.match(markup, /disabled=/)
assert.doesNotMatch(markup, /无限|永久免费|自动扣费已开启/)
console.log('Membership page: unavailable, consent, double tap, pending, confirmed fulfillment, resume and account isolation PASS')
