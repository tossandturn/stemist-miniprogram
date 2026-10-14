import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import { miniRuntime } from './helpers/mini-runtime.mjs'

const flag = process.argv.indexOf('--identity-backend')
assert.ok(flag >= 0 && process.argv[flag + 1], 'Pass the reviewed identity-backend worktree explicitly')
const require = createRequire(import.meta.url)
const authority = require(path.join(path.resolve(process.argv[flag + 1]), 'server/membership.js'))
const db = new DatabaseSync(':memory:')
try {
  db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES(42); CREATE TABLE memberships(user_id INTEGER PRIMARY KEY,plan TEXT,starts_at TEXT,expires_at TEXT,updated_at TEXT);')
  authority.installMembershipSchema(db)
  const runtime = miniRuntime({ modules: {
    'utils/api': { requestIeltsJson: async url => { assert.equal(url, '/api/membership/catalog'); return authority.membershipCatalog({}, {}) } },
    'utils/ieltsLearning': { requestIeltsLearning: async (url, payload, options) => {
      if (url === '/api/membership/status') return authority.membershipStatus(db, 'ielts:42', {})
      if (url === '/api/membership/orders' && options.method === 'GET') return authority.listMembershipOrders(db, 'ielts:42')
      if (url === '/api/membership/orders' && options.method === 'POST') return authority.createMembershipCheckout({ db, userId: 'ielts:42', payload, env: {}, providerRegistry: {}, resolveWechatIdentity: () => assert.fail('Disabled checkout must not exchange a WeChat code') })
      assert.fail('Unexpected membership path')
    } },
  } })
  runtime.storage.set('stemistUser', { id: 'ielts:42' }); runtime.storage.set('stemistSessionToken', 'fixture-only')
  const client = runtime.load('bundles/account/membershipData')
  const catalog = await client.fetchCatalog()
  assert.equal(catalog.plan.priceFen, 2880)
  assert.equal(catalog.plan.durationDays, 30)
  assert.equal(catalog.commerce.checkoutEnabled, false)
  assert.equal((await client.fetchStatus()).entitlement.active, false)
  assert.equal((await client.fetchOrders()).orders.length, 0)
  await assert.rejects(client.createOrder({ idempotencyKey: 'crossrepo-no-charge-1', wxCode: 'fixture', platform: 'android' }), error => error.statusCode === 503 && error.code === 'membership_checkout_unavailable')
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM membership_orders').get().total, 0)
  console.log('Real membership authority -> Mini contract: price, status, order list and disabled checkout with zero orders PASS')
} finally { db.close() }
