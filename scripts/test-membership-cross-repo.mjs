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
      if (url === '/api/membership/catalog/private') {
        const catalog = authority.membershipCatalog({}, {})
        return { ...catalog, userId: 'ielts:42', commerce: { ...catalog.commerce, canary: null } }
      }
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

  const proofNow = Date.parse('2026-10-14T12:00:00.000Z')
  const statusEnv = { MEMBERSHIP_ENFORCEMENT_ENABLED: '1', MEMBERSHIP_ENFORCEMENT_READY: '1' }
  const writeMembership = ({ userId = 42, plan = 'all-access-month', expiresAt = '2026-10-15T12:00:00.000Z', version = '2026-10-14T11:59:00.000Z' } = {}) => {
    db.prepare('INSERT OR IGNORE INTO users(id) VALUES(?)').run(userId)
    db.prepare(`
      INSERT INTO memberships(user_id,plan,starts_at,expires_at,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,starts_at=excluded.starts_at,expires_at=excluded.expires_at,updated_at=excluded.updated_at
    `).run(userId, plan, '2026-10-14T11:00:00.000Z', expiresAt, version)
  }
  const prove = async ({ clientOwner = 'ielts:42', authorityOwner = 'ielts:42' } = {}) => {
    const status = authority.membershipStatus(db, authorityOwner, statusEnv, proofNow)
    const proofRuntime = miniRuntime({ modules: {
      'utils/api': { requestJson: async (url) => { assert.equal(url, '/api/membership/status'); return status } },
      'utils/nativeSession': { refreshNativeSession: async () => 'fixture-only' },
      'utils/membershipAccess': { offerMembership() {} },
    } })
    proofRuntime.storage.set('stemistUser', { id: clientOwner })
    proofRuntime.storage.set('stemistSessionToken', 'fixture-only')
    return proofRuntime.load('utils/membershipProof').ensureMembershipAccess({ wxApi: proofRuntime.wx, now: () => proofNow })
  }
  for (const plan of ['all-access-month', 'day', 'week', 'month', 'year']) {
    const version = `2026-10-14T11:59:0${plan.length % 10}.000Z`
    writeMembership({ plan, version })
    const proof = await prove()
    assert.equal(proof.planId, plan)
    assert.equal(proof.version, version)
  }
  writeMembership({ plan: 'month', expiresAt: '2026-10-14T11:59:59.999Z' })
  await assert.rejects(prove(), error => error.code === 'membership_required' && error.statusCode === 403)
  db.prepare('DELETE FROM memberships WHERE user_id=42').run()
  await assert.rejects(prove(), error => error.code === 'membership_required' && error.statusCode === 403)
  writeMembership({ userId: 43, plan: 'year' })
  await assert.rejects(prove({ authorityOwner: 'ielts:43' }), error => error.code === 'membership_authority_mismatch' && error.statusCode === 503)
  writeMembership({ plan: 'all-access-month', version: 'malformed\nversion' })
  await assert.rejects(prove(), error => error.code === 'membership_authority_invalid' && error.statusCode === 503)
  console.log('Real membership authority -> Mini contract: price, status, order list and disabled checkout with zero orders PASS')
} finally { db.close() }
