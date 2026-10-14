const membership = require('./membershipData')
const { deviceState, syncDevice } = require('../../utils/page')

function dateLabel(value) {
  const date = new Date(value)
  if (!value || !Number.isFinite(date.getTime())) return ''
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function message(error) {
  return ({ membership_checkout_unavailable: '微信支付尚未开通，当前不会扣款。', membership_platform_unavailable: '当前设备暂未开放购买，请稍后重试。', auth_required: '请先登录后开通会员。', account_changed: '账号已变化，请重新打开会员中心。', payment_canceled: '已取消支付，可在订单中查看结果。', payment_unconfirmed: '支付结果待确认，请勿重复付款。', payment_unsupported: '当前微信版本暂不能使用此支付通道，请更新微信后重试。', wechat_identity_mismatch: '请使用当前微信账号登录后再开通会员。' })[error?.code] || '暂时未能完成，请重试；支付结果以订单确认为准。'
}
function loginCode() {
  return new Promise((resolve, reject) => wx.login({ timeout: 10000,
    success(result) { if (typeof result?.code === 'string' && result.code) resolve(result.code); else reject(new Error('WeChat sign-in unavailable')) },
    fail() { reject(new Error('WeChat sign-in unavailable')) },
  }))
}

Page({
  onShareAppMessage() { return require('../../utils/share').onShareAppMessage.call(this) },
  data: deviceState({ loading: true, busy: false, loggedIn: false, plan: null, entitlement: null, expiryLabel: '', checkoutEnabled: false, checkoutNote: '微信支付正在开通，暂不收款。', enforcementEnabled: false, consent: false, phase: 'idle', notice: '', error: '', orderError: '', orders: [], hasMore: false, pendingOrderId: '', pendingOrderShort: '' }),
  onLoad() { this._generation = 0; this._visible = false; this._pollTimer = null; this._purchasing = false },
  onShow() { this._visible = true; syncDevice(this); return this.refresh() },
  onResize() { syncDevice(this) },
  onHide() { this._visible = false; this._generation++; this.clearPoll() },
  onUnload() { this.onHide() },
  goBack() { wx.navigateBack() },
  login() { wx.navigateTo({ url: '/pages/account/auth' }) },
  clearPoll() { if (this._pollTimer) clearTimeout(this._pollTimer); this._pollTimer = null },
  valid(generation, expected) {
    if (!this._visible || this._generation !== generation) return false
    try { membership.assertContext(expected); return true } catch { return false }
  },
  setEntitlement(value) { this.setData({ entitlement: value, expiryLabel: dateLabel(value?.expiresAt) }) },
  async refresh() {
    this.clearPoll()
    const generation = ++this._generation, expected = membership.context()
    if (this._purchaseAttempt && (this._purchaseAttempt.expected.owner !== expected.owner || this._purchaseAttempt.expected.epoch !== expected.epoch)) {
      this._purchaseAttempt = null
      this._purchasing = false
    }
    const loggedIn = expected.owner !== 'guest' && Boolean(wx.getStorageSync('stemistSessionToken'))
    this.setData({ loading: true, busy: this._purchasing, loggedIn, checkoutEnabled: false, error: '', orderError: '', entitlement: null, orders: [], pendingOrderId: '', pendingOrderShort: '' })
    try {
      const catalog = await membership.fetchCatalog()
      if (!this.valid(generation, expected)) return
      const changed = this.data.plan && this.data.plan.priceFen !== catalog.plan.priceFen
      const checkoutNote = catalog.commerce.reason === 'platform_unavailable' ? '当前设备暂未开放购买，请稍后重试。' : catalog.commerce.reason === 'payment_unsupported' ? '请更新微信后重试此支付通道。' : '微信支付正在开通，暂不收款。'
      this.setData({ plan: catalog.plan, checkoutEnabled: catalog.commerce.checkoutEnabled, checkoutNote, enforcementEnabled: catalog.enforcement.enabled, ...(changed ? { consent: false } : {}) })
      if (!loggedIn) return
      const account = await membership.fetchStatus()
      if (!this.valid(generation, expected)) return
      this.setEntitlement(account.entitlement)
      try {
        const result = await membership.fetchOrders()
        if (!this.valid(generation, expected)) return
        this.setData({ orders: result.orders.map(order => ({ ...order, createdLabel: dateLabel(order.createdAt), shortId: order.id.slice(-10) })), hasMore: result.hasMore })
        // Local logout deliberately removes private pointers. Restore unresolved
        // purchases only from the authenticated owner's server list, and never
        // assume a lost native payment callback means it is safe to pay again.
        if (!membership.readPending()) {
          const unresolved = result.orders.find(order => ['created', 'pending', 'paid', 'processing'].includes(order.status))
          if (unresolved) membership.rememberPending({ idempotencyKey: 'recover-' + unresolved.id, orderId: unresolved.id, paymentAttemptState: 'unknown' })
        }
      } catch {
        if (this.valid(generation, expected)) this.setData({ orderError: '订单暂未加载，可点击刷新。' })
      }
      const pending = membership.readPending()
      if (pending?.orderId && this.valid(generation, expected)) {
        this.setData({ pendingOrderId: pending.orderId, pendingOrderShort: pending.orderId.slice(-10), phase: 'confirming' })
        await this.verifyOrder(pending.orderId, generation, expected, 0)
      }
    } catch (error) {
      if (this.valid(generation, expected)) this.setData({ error: message(error) })
    } finally {
      if (this.valid(generation, expected)) this.setData({ loading: false, busy: this._purchasing })
    }
  },
  consentChanged(event) { this.setData({ consent: Array.isArray(event.detail?.value) && event.detail.value.includes('confirm'), error: '' }) },
  async purchase() {
    if (this._purchasing || this.data.busy || this.data.loading || !this.data.checkoutEnabled || !this.data.plan) return
    if (!this.data.loggedIn) { this.login(); return }
    if (!this.data.consent) { this.setData({ error: '请先确认价格、有效期和非自动续费说明。' }); return }
    const generation = this._generation, expected = membership.context()
    const attemptToken = { generation, expected }
    this._purchaseAttempt = attemptToken
    this._purchasing = true
    this.clearPoll()
    this.setData({ busy: true, phase: 'creating', error: '', notice: '' })
    try {
      let pending = membership.readPending()
      if (pending?.orderId) {
        const existing = await membership.fetchOrder(pending.orderId)
        if (!this.valid(generation, expected)) return
        if (existing.order.status === 'fulfilled') { this.applyConfirmed(existing); return }
        if (!['created', 'pending', 'paid', 'processing'].includes(existing.order.status)) { membership.forgetPending(); pending = null }
        if (['paid', 'processing'].includes(existing.order.status) || !['not_started', 'canceled'].includes(pending?.paymentAttemptState)) { this.setData({ phase: 'confirming', notice: '支付结果确认中，请勿重复付款。' }); await this.verifyOrder(existing.order.id, generation, expected, 0); return }
      }
      if (!pending) { pending = { idempotencyKey: membership.newIdempotencyKey(), orderId: '' }; membership.rememberPending(pending) }
      const wxCode = await loginCode()
      if (!this.valid(generation, expected)) return
      const platform = String(wx.getSystemInfoSync()?.platform || '').toLowerCase()
      const checkout = await membership.createOrder({ idempotencyKey: pending.idempotencyKey, wxCode, platform })
      if (!this.valid(generation, expected)) return
      membership.rememberPending({ idempotencyKey: pending.idempotencyKey, orderId: checkout.order.id, paymentAttemptState: pending.paymentAttemptState || 'not_started' })
      this.setData({ pendingOrderId: checkout.order.id, pendingOrderShort: checkout.order.id.slice(-10) })
      if (['paid', 'fulfilled', 'processing'].includes(checkout.order.status)) { await this.verifyOrder(checkout.order.id, generation, expected, 0); return }
      this.setData({ phase: 'paying' })
      await membership.invokePayment(checkout, this.data.plan)
      if (!this.valid(generation, expected)) return
      this.setData({ phase: 'confirming', notice: '支付已返回，正在确认开通结果，请勿重复付款。' })
      await this.verifyOrder(checkout.order.id, generation, expected, 0)
    } catch (error) {
      if (!this.valid(generation, expected)) return
      const known = membership.readPending()
      if (error?.code === 'membership_checkout_unavailable' && !known?.orderId) membership.forgetPending()
      this.setData({ phase: error?.code === 'payment_canceled' ? 'canceled' : known?.orderId ? 'confirming' : 'idle', error: message(error) })
      if (known?.orderId && error?.code !== 'payment_canceled') await this.verifyOrder(known.orderId, generation, expected, 5)
    } finally {
      if (this._purchaseAttempt === attemptToken) {
        this._purchaseAttempt = null
        this._purchasing = false
        try { membership.assertContext(expected); if (this._visible) this.setData({ busy: false }) } catch { /* Another account owns the page now. */ }
      }
    }
  },
  applyConfirmed(result) {
    this.setEntitlement(result.entitlement)
    const ownsPending = membership.readPending()?.orderId === result.order.id
    if (ownsPending) { membership.forgetPending(); this.clearPoll() }
    this.setData({ ...(ownsPending ? { phase: result.entitlement.active ? 'success' : 'idle', pendingOrderId: '', pendingOrderShort: '' } : {}), notice: ownsPending && result.entitlement.active ? '会员已开通，可以返回继续学习。' : '该订单已完成，会员状态已刷新。', error: '', consent: false })
  },
  async verifyOrder(id, generation = this._generation, expected = membership.context(), attempt = 0) {
    try {
      const result = await membership.fetchOrder(id)
      if (!this.valid(generation, expected)) return
      if (result.order.status === 'fulfilled') { this.applyConfirmed(result); return }
      if (['closed', 'failed', 'refunded'].includes(result.order.status)) {
        const ownsPending = membership.readPending()?.orderId === id
        if (ownsPending) membership.forgetPending()
        this.setEntitlement(result.entitlement)
        this.setData({ ...(ownsPending ? { phase: 'idle', pendingOrderId: '', pendingOrderShort: '' } : {}), notice: `订单${result.order.statusLabel || result.order.status}，可在订单记录中查看。` }); return
      }
      const canceled = membership.readPending()?.orderId === id && membership.readPending()?.paymentAttemptState === 'canceled'
      this.setData({ phase: canceled ? 'canceled' : 'confirming', notice: canceled ? '支付已取消，可以继续支付原订单。' : attempt >= 5 ? '开通结果仍待确认，可稍后刷新订单，无需重复付款。' : '正在确认订单，确认后自动更新会员状态。' })
      if (canceled) return
      if (attempt < 5) {
        this.clearPoll()
        this._pollTimer = setTimeout(() => { this._pollTimer = null; if (this.valid(generation, expected)) this.verifyOrder(id, generation, expected, attempt + 1) }, Math.min(6000, 1500 + attempt * 1000))
      }
    } catch (error) {
      if (this.valid(generation, expected)) this.setData({ phase: 'confirming', notice: '订单暂未确认，原订单已保留，请勿重复付款。', error: message(error) })
    }
  },
  checkOrder(event) {
    if (this.data.busy) return
    const id = event?.currentTarget?.dataset?.id || this.data.pendingOrderId
    if (id) { this.clearPoll(); return this.verifyOrder(id) }
  },
})
