import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'
let modal, count = 0
const runtime = miniRuntime({ wx: { showModal(options) { count++; modal = options } } })
runtime.storage.set('stemistUser', { id: 'ielts:42' })
const access = runtime.load('utils/membershipAccess')
access.offerMembership(); access.offerMembership()
assert.equal(count, 1)
modal.success({ confirm: false }); modal.complete()
assert.equal(runtime.calls.length, 0)
access.offerMembership()
runtime.storage.set('stemistUser', { id: 'ielts:99' })
modal.success({ confirm: true }); modal.complete()
assert.equal(runtime.calls.length, 0, 'late modal must not navigate a new account')
access.offerMembership(); modal.success({ confirm: true }); modal.complete()
assert.equal(runtime.calls.at(-1).url, '/bundles/account/membership')
console.log('Membership access: one prompt, explicit consent, owner isolation and no client entitlement PASS')
