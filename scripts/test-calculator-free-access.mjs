import assert from 'node:assert/strict'
import { miniRuntime, settle } from './helpers/mini-runtime.mjs'

// Product rule: the existing Casio-style learning calculator is free. Neither
// login availability nor a paid/expired entitlement may gate local operations.
for (const account of ['guest', 'free']) {
  let authAttempts = 0, requests = 0, payments = 0
  const runtime = miniRuntime({
    wx: {
      request() { requests++; throw Error('Calculator must work without a network request') },
      requestPayment() { payments++; throw Error('Calculator must not initiate payment') },
      requestVirtualPayment() { payments++; throw Error('Calculator must not initiate virtual payment') },
    },
    modules: {
      'utils/wechatAuth': { ensureWeChatSession: () => { authAttempts++; return Promise.reject(Error('Login unavailable')) } },
    },
  })
  if (account !== 'guest') {
    runtime.storage.set('stemistUser', { id: 'ielts:999999991' })
    runtime.storage.set('stemistSessionToken', 'synthetic-local-only')
  }
  const home = runtime.page('pages/index/index')
  home.openEntry({ currentTarget: { dataset: { entry: 'calculator' } } })
  await settle()
  assert.equal(runtime.calls.at(-1)?.url, '/pages/calculator/index', `${account} can enter even when login fails`)
  assert.equal(home.data.entryError, '')
  const page = runtime.page('pages/calculator/index'); page.onLoad(); page.onShow()
  for (const model of ['cw', 'cnx']) {
    page.selectCalculatorModel({ currentTarget: { dataset: { model } } })
    page.onInput({ detail: { value: '2+3*4', cursor: 5 } }); page.calculate()
    assert.equal(page.data.answer, 14, `${account} ${model} remains free`)
    page.onInput({ detail: { value: 'sin(30)', cursor: 7 } }); page.calculate()
    assert.ok(Math.abs(page.data.answer - 0.5) < 1e-10)
    assert.equal(page.data.error, '')
  }
  page.flushState(); page.onUnload(); home.onUnload()
  assert.equal(requests, 0); assert.equal(payments, 0)
  assert.equal(authAttempts, 1, 'background session attempt never blocks navigation')
  assert.ok(runtime.calls.every(call => !/membership|auth/.test(call.url || '')))
  console.log(`PASS calculator free access: ${account}; both models; no network/payment/download quota`)
}
