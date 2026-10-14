import assert from 'node:assert/strict'
import { miniRuntime, deferred } from './helpers/mini-runtime.mjs'

const protocol = 'stemist-membership-v1'
const plan = { id: 'all-access-month', title: '全功能月卡', priceFen: 2880, currency: 'CNY', durationDays: 30, autoRenew: false }
const catalog = { protocol, plan, commerce: { checkoutEnabled: false, reason: 'setup_required', providers: [{ id: 'wechat_virtual', enabled: false, reason: 'setup_required' }] }, enforcement: { enabled: false, appliesToExistingUsers: true } }
const privateCatalog = { ...catalog, userId: 'ielts:42', commerce: { ...catalog.commerce, canary: null } }
const order = { id: 'MEMBER202610140000001', status: 'pending', planId: plan.id, priceFen: 2880, currency: 'CNY', durationDays: 30, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 900000).toISOString() }
const calls = []
let privateReply = { protocol, userId: 'ielts:42', entitlement: { active: false, planId: '', startsAt: null, expiresAt: null, version: 0 }, enforcement: catalog.enforcement }
let publicReply = catalog
let privateCatalogReply = privateCatalog, privateCatalogError = null
let pendingReply
const runtime = miniRuntime({ modules: {
  'utils/api': { requestIeltsJson: async (...args) => { calls.push(args); return publicReply } },
  'utils/ieltsLearning': { requestIeltsLearning: async (...args) => { calls.push(args); if (args[0] === '/api/membership/catalog/private') { if (privateCatalogError) throw privateCatalogError; return privateCatalogReply } return pendingReply ? pendingReply.promise : privateReply } },
}, wx: { getSystemInfoSync: () => ({ platform: 'android' }), requestVirtualPayment(options) { calls.push({ virtual: options }); options.success({ errMsg: 'requestVirtualPayment:ok' }) }, requestPayment(options) { calls.push({ jsapi: options }); options.success({ errMsg: 'requestPayment:ok' }) } } })
runtime.storage.set('stemistUser', { id: 'ielts:42' })
runtime.storage.set('stemistSessionToken', 'fixture-session-not-a-real-token')
const service = runtime.load('bundles/account/membershipData')
const loaded = await service.fetchCatalog()
assert.equal(loaded.plan.priceLabel, '28.80')
assert.equal(loaded.commerce.checkoutEnabled, false)
assert.equal((await service.fetchStatus()).entitlement.active, false)
assert.equal(calls[0][0], '/api/membership/catalog/private')
assert.equal(calls[0][2].method, 'GET')
assert.equal(calls[1][0], '/api/membership/status')

runtime.storage.delete('stemistUser');runtime.storage.delete('stemistSessionToken')
await service.fetchCatalog();assert.equal(calls.at(-1)[0],'/api/membership/catalog','a guest reads only the public safe-off catalog')
runtime.storage.set('stemistUser',{id:'ielts:42'});runtime.storage.set('stemistSessionToken','fixture-session-not-a-real-token')

privateCatalogReply = { ...privateCatalog, plan: { ...plan, priceFen: '2880' } }
await assert.rejects(service.fetchCatalog(), /方案|会员/)
privateCatalogReply = { ...privateCatalog, plan: { ...plan, autoRenew: true } }
await assert.rejects(service.fetchCatalog(), /方案|会员/)
privateCatalogReply = privateCatalog
privateCatalogReply = { ...privateCatalog, userId: 'ielts:99' }
await assert.rejects(service.fetchCatalog(), /账号/)
privateCatalogReply = privateCatalog
privateReply = { ...privateReply, userId: 'ielts:99' }
await assert.rejects(service.fetchStatus(), /账号/)
privateReply = { ...privateReply, userId: 'ielts:42' }

const productionCatalog = {
  ...privateCatalog,
  commerce: {
    checkoutEnabled: true,
    reason: 'ready',
    providers: [{ id: 'wechat_virtual', enabled: true, reason: 'ready', platforms: ['android'] }],
    canary: null,
  },
}
privateCatalogReply = productionCatalog
assert.equal(
  (await service.fetchCatalog()).commerce.checkoutEnabled,
  true,
  'a signed-in user may use the normal production commerce path without a canary',
)
privateCatalogReply = { ...productionCatalog, commerce: { ...productionCatalog.commerce, reason: 'setup_required' } }
assert.equal((await service.fetchCatalog()).commerce.checkoutEnabled, false, 'normal commerce still requires the authority ready decision')
privateCatalogReply = {
  ...productionCatalog,
  commerce: {
    ...productionCatalog.commerce,
    providers: [{ id: 'wechat_virtual', enabled: false, reason: 'setup_required', platforms: ['android'] }],
  },
}
assert.equal((await service.fetchCatalog()).commerce.checkoutEnabled, false, 'normal commerce still requires an enabled platform provider')
runtime.storage.delete('stemistUser');runtime.storage.delete('stemistSessionToken')
publicReply = { ...catalog, commerce: { ...productionCatalog.commerce } }
assert.equal((await service.fetchCatalog()).commerce.checkoutEnabled, false, 'an unauthenticated public catalog can never authorize checkout')
runtime.storage.set('stemistUser',{id:'ielts:42'});runtime.storage.set('stemistSessionToken','fixture-session-not-a-real-token')
publicReply = catalog

const canaryExpiresAt=new Date(Date.now()+60*60*1000).toISOString(),recoveryOrderId='M'+'1'.repeat(30)
privateCatalogReply={...privateCatalog,commerce:{checkoutEnabled:true,reason:'testbuyer_canary',providers:[{id:'wechat_virtual',enabled:true,reason:'testbuyer_canary',platforms:['android']}],canary:{mode:'single-testbuyer',expiresAt:canaryExpiresAt,remainingNewOrders:1,recovery:null}}}
assert.equal((await service.fetchCatalog()).commerce.checkoutEnabled,true,'only the private owner-bound Android canary may expose checkout')
const enabledCanary=privateCatalogReply
privateCatalogReply={...enabledCanary,commerce:{...enabledCanary.commerce,canary:{...enabledCanary.commerce.canary,expiresAt:new Date(Date.now()+3*60*60*1000).toISOString()}}};assert.equal((await service.fetchCatalog()).commerce.checkoutEnabled,false,'a canary over the two-hour bound stays disabled')
privateCatalogReply={...enabledCanary,commerce:{...enabledCanary.commerce,providers:[{id:'wechat_jsapi',enabled:true,reason:'testbuyer_canary',platforms:['android']}]}};assert.equal((await service.fetchCatalog()).commerce.checkoutEnabled,false,'digital membership cannot silently fall back to ordinary JSAPI payment')
service.forgetPending();privateCatalogReply={...enabledCanary,commerce:{...enabledCanary.commerce,canary:{...enabledCanary.commerce.canary,remainingNewOrders:1,recovery:{idempotencyKey:'canary-recover-same-order',orderId:recoveryOrderId}},checkoutEnabled:true,reason:'testbuyer_canary_recovery_required'}}
let recovered=await service.fetchCatalog(),pendingCanary=service.readPending();assert.equal(recovered.commerce.checkoutEnabled,false);assert.equal(pendingCanary.idempotencyKey,'canary-recover-same-order');assert.equal(pendingCanary.orderId,recoveryOrderId);assert.equal(pendingCanary.paymentAttemptState,'unknown','a server-owned order is query-only and never payable twice')
service.forgetPending();privateCatalogReply={...privateCatalogReply,commerce:{...privateCatalogReply.commerce,canary:{...privateCatalogReply.commerce.canary,recovery:{idempotencyKey:'canary-recover-no-order',orderId:null}}}}
recovered=await service.fetchCatalog();pendingCanary=service.readPending();assert.equal(recovered.commerce.checkoutEnabled,true,'an active owner-only pre-order recovery may retry only its server idempotency key');assert.equal(pendingCanary.idempotencyKey,'canary-recover-no-order');assert.equal(pendingCanary.orderId,'');assert.equal(pendingCanary.paymentAttemptState,'not_started','a pre-order recovery reuses the server idempotency key with a fresh wxCode')
service.rememberPending({idempotencyKey:'local-unknown-payment',orderId:recoveryOrderId,paymentAttemptState:'unknown'});recovered=await service.fetchCatalog();pendingCanary=service.readPending();assert.equal(recovered.commerce.checkoutEnabled,false,'a local unknown/paid-capable attempt cannot be downgraded into another native payment');assert.equal(pendingCanary.idempotencyKey,'local-unknown-payment');assert.equal(pendingCanary.orderId,recoveryOrderId);assert.equal(pendingCanary.paymentAttemptState,'unknown')
service.forgetPending();privateCatalogReply={...privateCatalog,commerce:{...privateCatalog.commerce,canary:{mode:'single-testbuyer',expiresAt:'not-a-date',remainingNewOrders:1,recovery:null}}}
await assert.rejects(service.fetchCatalog(),/授权|会员/)
privateCatalogError=Object.assign(Error('private unavailable'),{code:'membership_authority_unavailable'});const publicCalls=calls.filter(item=>Array.isArray(item)&&item[0]==='/api/membership/catalog').length
await assert.rejects(service.fetchCatalog(),/private unavailable/);assert.equal(calls.filter(item=>Array.isArray(item)&&item[0]==='/api/membership/catalog').length,publicCalls,'a private catalog failure must not fall back to a payable public response');privateCatalogError=null;privateCatalogReply=privateCatalog

pendingReply = deferred()
const late = service.fetchStatus()
runtime.storage.set('stemistUser', { id: 'ielts:99' })
pendingReply.resolve({ protocol, userId: 'ielts:42', entitlement: { active: true, expiresAt: new Date(Date.now() + 86400000).toISOString() } })
await assert.rejects(late, /账号/)
pendingReply = null
runtime.storage.set('stemistUser', { id: 'ielts:42' })

service.rememberPending({ idempotencyKey: 'idem-1234567890123456', orderId: order.id })
assert.equal(service.readPending().orderId, order.id)
runtime.storage.set('stemistUser', { id: 'ielts:99' })
assert.equal(service.readPending(), null)
runtime.storage.set('stemistUser', { id: 'ielts:42' })

privateReply = { protocol, userId: 'ielts:42', order, payment: { provider: 'wechat_virtual', parameters: { mode: 'short_series_goods', signData: JSON.stringify({ offerId: 'fixture-offer', buyQuantity: 1, env: 0, currencyType: 'CNY', productId: 'all-access-month', goodsPrice: 2880, outTradeNo: order.id }), paySig: 'a'.repeat(64), signature: 'b'.repeat(64) } } }
const checkout = await service.createOrder({ idempotencyKey: 'idem-1234567890123456', wxCode: 'fixture-code', platform: 'android' })
const input = calls.at(-1)[1]
assert.deepEqual(Object.keys(input).sort(), ['clientCapability', 'idempotencyKey', 'planId', 'platform', 'wxCode'])
assert.equal(input.planId, plan.id)
await service.invokePayment(checkout, loaded.plan)
assert.equal(calls.at(-1).virtual.mode, 'short_series_goods')
assert.equal(runtime.storage.get('stemistUser').membership, undefined, 'native success must never grant entitlement')
assert.ok(!JSON.stringify([...runtime.storage.values()]).includes('a'.repeat(64)), 'payment signatures are not persisted')
const invokes = calls.filter(item => item.virtual).length
await assert.rejects(service.invokePayment(checkout, loaded.plan), /确认/)
assert.equal(calls.filter(item => item.virtual).length, invokes, 'successful native return cannot open payment a second time while server is pending')
assert.equal(service.readPending().paymentAttemptState, 'submitted')

const bad = { ...checkout, order: { ...order, priceFen: 1 } }
await assert.rejects(service.invokePayment(bad, loaded.plan), /金额|方案/)
const wrongOrder = { ...checkout, payment: { ...checkout.payment, parameters: { ...checkout.payment.parameters, signData: JSON.stringify({ ...JSON.parse(checkout.payment.parameters.signData), outTradeNo: 'SOMEONE_ELSE' }) } } }
await assert.rejects(service.invokePayment(wrongOrder, loaded.plan), /支付/)
const unknown = { ...checkout, payment: { provider: 'javascript-url', parameters: {} } }
await assert.rejects(service.invokePayment(unknown, loaded.plan), /支付/)
service.forgetPending()
assert.equal(service.readPending(), null)

runtime.wx.requestVirtualPayment = options => options.fail({ errMsg: 'requestVirtualPayment:fail cancel' })
service.rememberPending({ idempotencyKey: 'idem-another-12345678', orderId: order.id, paymentAttemptState: 'not_started' })
await assert.rejects(service.invokePayment(checkout, loaded.plan), /取消/)
assert.equal(service.readPending().paymentAttemptState, 'canceled')
runtime.wx.requestVirtualPayment = options => options.success({})
await service.invokePayment(checkout, loaded.plan)
assert.equal(service.readPending().paymentAttemptState, 'submitted', 'explicit cancellation can retry the same order')

service.rememberPending({ idempotencyKey: 'idem-third-12345678', orderId: order.id, paymentAttemptState: 'not_started' })
runtime.wx.requestVirtualPayment = options => options.fail({ errMsg: 'requestVirtualPayment:fail unknown network' })
await assert.rejects(service.invokePayment(checkout, loaded.plan), /待确认/)
assert.equal(service.readPending().paymentAttemptState, 'unknown')
await assert.rejects(service.invokePayment(checkout, loaded.plan), /确认/)
for (const changed of [{ id: 'ielts:99', epoch: 0, callback: 'success' }, { id: 'ielts:42', epoch: 1, callback: 'fail' }]) {
  runtime.storage.set('stemistUser', { id: 'ielts:42' })
  runtime.storage.set('stemistPrivacyEpoch', 0)
  service.rememberPending({ idempotencyKey: 'idem-native-owner-123456', orderId: order.id, paymentAttemptState: 'not_started' })
  let nativeCallback
  runtime.wx.requestVirtualPayment = options => { nativeCallback = options }
  const nativeResult = service.invokePayment(checkout, loaded.plan)
  assert.equal(service.readPending().paymentAttemptState, 'launched')
  runtime.storage.set('stemistUser', { id: changed.id })
  runtime.storage.set('stemistPrivacyEpoch', changed.epoch)
  nativeCallback[changed.callback]({ errMsg: 'requestVirtualPayment:fail cancel' })
  await assert.rejects(nativeResult, /账号/)
  assert.equal(runtime.storage.get('stemistUser').membership, undefined)
  assert.equal(runtime.storage.get('stemistMembershipPending:ielts%3A42').paymentAttemptState, 'launched', 'a late native callback cannot downgrade another context to retryable cancellation')
  assert.equal(runtime.storage.has('stemistMembershipPending:ielts%3A99'), false)
}
console.log('Membership client: catalog, owner/epoch isolation, exact order payload, payment validation and no client grant PASS')
