const { requestIeltsJson } = require('../../utils/api')
const { requestIeltsLearning } = require('../../utils/ieltsLearning')

const PROTOCOL = 'stemist-membership-v1'
const PLAN_ID = 'all-access-month'
const CAPABILITY = 'membership-checkout-v1'
const MAX_CANARY_MS = 2 * 60 * 60 * 1000
const STATUS_LABELS = { created: '创建中', pending: '待支付', paid: '开通确认中', processing: '确认中', fulfilled: '已开通', closed: '已关闭', failed: '未完成', refunded: '已退款', refund_pending: '退款处理中' }

function failure(message, code = 'membership_invalid') {
  const error = new Error(message)
  error.code = code
  return error
}
function text(value, max = 120) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : ''
}
function exact(value, keys) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === keys.slice().sort().join('|'))
}
function context() {
  return { owner: String(wx.getStorageSync('stemistUser')?.id || 'guest'), epoch: Number(wx.getStorageSync('stemistPrivacyEpoch')) || 0 }
}
function assertContext(expected) {
  const current = context()
  if (current.owner !== expected.owner || current.epoch !== expected.epoch) throw failure('账号已变化，请重新打开会员中心。', 'account_changed')
}
function protocol(value) {
  if (!value || value.protocol !== PROTOCOL) throw failure('会员服务暂未就绪，请稍后重试。')
  return value
}
function assertUser(value, expected) {
  assertContext(expected)
  const id = String(value?.userId || '')
  if (expected.owner === 'guest' || (id.startsWith('ielts:') ? id : 'ielts:' + id) !== expected.owner) throw failure('会员账号校验未完成，请重新登录。', 'account_changed')
}
function planData(plan) {
  if (!plan || plan.id !== PLAN_ID || !Number.isSafeInteger(plan.priceFen) || plan.priceFen <= 0 || plan.priceFen > 100000000 || plan.currency !== 'CNY' || plan.durationDays !== 30 || plan.autoRenew !== false) throw failure('会员方案暂不可用，请刷新后重试。')
  return { id: plan.id, title: text(plan.title, 50) || '全功能月卡', priceFen: plan.priceFen, priceLabel: (plan.priceFen / 100).toFixed(2), currency: 'CNY', durationDays: 30, autoRenew: false }
}
function entitlementData(value) {
  if (!value || typeof value.active !== 'boolean') throw failure('会员状态暂未确认，请重试。')
  if (value.active && (!Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now())) throw failure('会员状态已变化，请刷新确认。')
  return { active: value.active, planId: text(value.planId), startsAt: value.startsAt || null, expiresAt: value.expiresAt || null, version: value.version }
}
function orderData(order) {
  if (!order || !/^[A-Za-z0-9_-]{8,64}$/.test(order.id) || !Object.prototype.hasOwnProperty.call(STATUS_LABELS, order.status) || order.planId !== PLAN_ID || !Number.isSafeInteger(order.priceFen) || order.priceFen <= 0 || order.currency !== 'CNY' || order.durationDays !== 30) throw failure('订单信息暂未确认，请刷新订单。')
  return { id: order.id, status: order.status, statusLabel: STATUS_LABELS[order.status], planId: PLAN_ID, priceFen: order.priceFen, priceLabel: (order.priceFen / 100).toFixed(2), currency: 'CNY', durationDays: 30, createdAt: order.createdAt || null, expiresAt: order.expiresAt || null, paidAt: order.paidAt || null }
}
async function privateRequest(path, data, method = 'GET') {
  const expected = context()
  if (expected.owner === 'guest' || !wx.getStorageSync('stemistSessionToken')) throw failure('请先登录后开通会员。', 'auth_required')
  const result = protocol(await requestIeltsLearning(path, data, { method, timeout: 20000 }))
  assertUser(result, expected)
  return result
}
async function fetchCatalog() {
  const expected = context()
  const authenticated = expected.owner !== 'guest' && Boolean(wx.getStorageSync('stemistSessionToken'))
  const value = authenticated ? await privateRequest('/api/membership/catalog/private') : protocol(await requestIeltsJson('/api/membership/catalog', undefined, { method: 'GET', timeout: 10000 }))
  assertContext(expected)
  if (typeof value.commerce?.checkoutEnabled !== 'boolean' || typeof value.enforcement?.enabled !== 'boolean' || value.enforcement.appliesToExistingUsers !== true) throw failure('会员服务暂未就绪，请稍后重试。')
  const validatedPlan = planData(value.plan)
  const providers = Array.isArray(value.commerce.providers) ? value.commerce.providers.filter(item => ['wechat_virtual', 'wechat_jsapi'].includes(item?.id)).map(item => ({ id: item.id, enabled: item.enabled === true, reason: text(item.reason), platforms: Array.isArray(item.platforms) ? item.platforms.filter(platform => ['android', 'ios'].includes(platform)) : [] })) : []
  let canary = null,canaryCanStart = false
  if (authenticated && value.commerce.canary !== null) {
    const source = value.commerce.canary
    if (!exact(source, ['mode', 'expiresAt', 'remainingNewOrders', 'recovery']) || source.mode !== 'single-testbuyer' || ![0, 1].includes(source.remainingNewOrders) || !Number.isFinite(Date.parse(source.expiresAt))) throw failure('测试支付授权无效，当前不会扣款。', 'membership_checkout_unavailable')
    let recovery = null
    if (source.recovery !== null) {
      if (!exact(source.recovery, ['idempotencyKey', 'orderId']) || !/^[A-Za-z0-9_-]{8,128}$/.test(source.recovery.idempotencyKey || '') || source.recovery.orderId !== null && !/^M[A-Za-z0-9_-]{30}$/.test(source.recovery.orderId || '')) throw failure('测试订单恢复信息无效，当前不会扣款。', 'membership_checkout_unavailable')
      recovery = { idempotencyKey: source.recovery.idempotencyKey, orderId: source.recovery.orderId || '' }
      const local = readPending(),unsafeToDowngrade = !recovery.orderId && (Boolean(local?.orderId) || ['launched', 'submitted', 'unknown'].includes(local?.paymentAttemptState))
      if (!unsafeToDowngrade) rememberPending({ ...recovery, paymentAttemptState: recovery.orderId ? 'unknown' : 'not_started' })
      canaryCanStart = !recovery.orderId && !unsafeToDowngrade
    }
    else canaryCanStart = source.remainingNewOrders === 1
    canary = { mode: 'single-testbuyer', expiresAt: new Date(Date.parse(source.expiresAt)).toISOString(), remainingNewOrders: source.remainingNewOrders, recovery }
  }
  const platform = String(wx.getSystemInfoSync()?.platform || '').toLowerCase()
  const platformProviders = providers.filter(item => item.id === 'wechat_virtual' && item.enabled && item.platforms.includes(platform))
  const available = platformProviders.some(item => typeof wx[item.id === 'wechat_virtual' ? 'requestVirtualPayment' : 'requestPayment'] === 'function')
  const expires = Date.parse(canary?.expiresAt),canStart = canary && canaryCanStart
  const reasonAllowsStart = value.commerce.reason === 'testbuyer_canary' || value.commerce.reason === 'testbuyer_canary_recovery_required' && canary?.recovery && !canary.recovery.orderId
  const canaryReady = authenticated && canStart && Number.isFinite(expires) && expires > Date.now() && expires - Date.now() <= MAX_CANARY_MS && reasonAllowsStart
  const normalCommerceReady = authenticated && value.commerce.canary === null && value.commerce.reason === 'ready'
  const checkoutEnabled = Boolean(value.commerce.checkoutEnabled && (normalCommerceReady || canaryReady) && available)
  const reason = checkoutEnabled ? 'ready' : value.commerce.checkoutEnabled ? platformProviders.length ? 'payment_unsupported' : 'platform_unavailable' : text(value.commerce.reason)
  return { protocol: PROTOCOL, plan: validatedPlan, commerce: { checkoutEnabled, reason, providers, canary }, enforcement: { enabled: value.enforcement.enabled, appliesToExistingUsers: true } }
}
async function fetchStatus() {
  const value = await privateRequest('/api/membership/status')
  return { ...value, entitlement: entitlementData(value.entitlement) }
}
async function fetchOrders() {
  const value = await privateRequest('/api/membership/orders')
  if (!Array.isArray(value.orders) || value.orders.length > 50) throw failure('订单列表暂未加载完成。')
  return { orders: value.orders.map(orderData), hasMore: value.hasMore === true }
}
async function fetchOrder(id) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id || '')) throw failure('订单编号无效。')
  const value = await privateRequest('/api/membership/orders/' + encodeURIComponent(id))
  const order = orderData(value.order)
  if (order.id !== id) throw failure('订单编号不匹配。')
  return { order, entitlement: entitlementData(value.entitlement) }
}
async function createOrder({ idempotencyKey, wxCode, platform }) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey || '')) throw failure('请重新发起开通。')
  const value = await privateRequest('/api/membership/orders', { planId: PLAN_ID, idempotencyKey, wxCode: text(wxCode, 256), platform: ['ios', 'android'].includes(platform) ? platform : 'unknown', clientCapability: CAPABILITY }, 'POST')
  return { userId: value.userId, order: orderData(value.order), payment: value.payment }
}
async function invokePayment(checkout, plan) {
  const expected = context()
  assertUser(checkout, expected)
  const order = orderData(checkout?.order)
  const currentPlan = planData(plan)
  if (order.status !== 'pending' || order.priceFen !== currentPlan.priceFen || order.currency !== currentPlan.currency || order.durationDays !== currentPlan.durationDays) throw failure('订单金额或会员方案已变化，请刷新订单。')
  const payment = checkout.payment
  const input = payment?.parameters
  let method, parameters
  if (payment?.provider === 'wechat_virtual') {
    let signed
    try { signed = JSON.parse(input.signData) } catch { throw failure('支付参数无效，请刷新订单。') }
    if (input.mode !== 'short_series_goods' || typeof input.signData !== 'string' || input.signData.length > 4096 || !/^[a-f0-9]{64}$/i.test(input.paySig || '') || !/^[a-f0-9]{64}$/i.test(input.signature || '') || signed.outTradeNo !== order.id || signed.goodsPrice !== order.priceFen || signed.buyQuantity !== 1 || signed.currencyType !== 'CNY' || signed.env !== 0 || typeof signed.productId !== 'string' || !signed.productId || !signed.offerId) throw failure('支付参数与订单不一致，请刷新订单。')
    method = 'requestVirtualPayment'
    parameters = { mode: input.mode, signData: input.signData, paySig: input.paySig, signature: input.signature }
  } else if (payment?.provider === 'wechat_jsapi') {
    if (!input || !/^\d{10,13}$/.test(input.timeStamp || '') || !/^[A-Za-z0-9_-]{8,64}$/.test(input.nonceStr || '') || !/^prepay_id=[A-Za-z0-9_-]{8,180}$/.test(input.package || '') || input.signType !== 'RSA' || !/^[A-Za-z0-9+/=]{128,1024}$/.test(input.paySign || '')) throw failure('支付参数无效，请刷新订单。')
    method = 'requestPayment'
    parameters = { timeStamp: input.timeStamp, nonceStr: input.nonceStr, package: input.package, signType: 'RSA', paySign: input.paySign }
  } else throw failure('当前支付通道尚未开通。', 'payment_unavailable')
  if (typeof wx[method] !== 'function') throw failure('当前微信版本暂不能使用此支付通道，请更新微信后重试。', 'payment_unsupported')
  assertContext(expected)
  const pending = readPending()
  if (pending?.orderId !== order.id || !['not_started', 'canceled'].includes(pending.paymentAttemptState)) throw failure('该订单正在确认，请勿重复发起支付。', 'payment_confirmation_pending')
  rememberPending({ ...pending, paymentAttemptState: 'launched' })
  const markAttempt = state => {
    assertContext(expected)
    const current = readPending()
    if (current?.orderId === order.id && current.idempotencyKey === pending.idempotencyKey) rememberPending({ ...current, paymentAttemptState: state })
  }
  return new Promise((resolve, reject) => wx[method]({ ...parameters,
    success() { try { markAttempt('submitted'); resolve({ submitted: true }) } catch (error) { reject(error) } },
    fail(result) {
      try { assertContext(expected) } catch (error) { reject(error); return }
      const canceled = /cancel|取消/i.test(String(result?.errMsg || ''))
      try { markAttempt(canceled ? 'canceled' : 'unknown') } catch (error) { reject(error); return }
      reject(failure(canceled ? '已取消支付，可在订单中查看结果。' : '支付结果待确认，请查看订单，勿重复付款。', canceled ? 'payment_canceled' : 'payment_unconfirmed'))
    },
  }))
}
function pendingKey() { return 'stemistMembershipPending:' + encodeURIComponent(context().owner) }
function readPending() {
  const value = wx.getStorageSync(pendingKey())
  if (context().owner === 'guest' || value?.owner !== context().owner || !/^[A-Za-z0-9_-]{8,128}$/.test(value.idempotencyKey || '')) return null
  return { idempotencyKey: value.idempotencyKey, orderId: /^[A-Za-z0-9_-]{8,64}$/.test(value.orderId || '') ? value.orderId : '', paymentAttemptState: ['not_started', 'launched', 'submitted', 'unknown', 'canceled'].includes(value.paymentAttemptState) ? value.paymentAttemptState : value.orderId ? 'unknown' : 'not_started' }
}
function rememberPending(value) {
  if (context().owner === 'guest' || !/^[A-Za-z0-9_-]{8,128}$/.test(value.idempotencyKey || '')) throw failure('请先登录后开通会员。')
  wx.setStorageSync(pendingKey(), { owner: context().owner, idempotencyKey: value.idempotencyKey, orderId: /^[A-Za-z0-9_-]{8,64}$/.test(value.orderId || '') ? value.orderId : '', paymentAttemptState: ['not_started', 'launched', 'submitted', 'unknown', 'canceled'].includes(value.paymentAttemptState) ? value.paymentAttemptState : 'not_started' })
}
function forgetPending() { wx.removeStorageSync(pendingKey()) }
function newIdempotencyKey() { return 'member-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14) }
module.exports = { PROTOCOL, PLAN_ID, CAPABILITY, context, assertContext, planData, orderData, fetchCatalog, fetchStatus, fetchOrders, fetchOrder, createOrder, invokePayment, readPending, rememberPending, forgetPending, newIdempotencyKey }
