import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const runtime=miniRuntime(),service=runtime.load('utils/coachEffort')
assert.equal(service.readCoachEffort(),'low')
runtime.storage.set('stemistUser',{id:'student-a'});runtime.storage.set('stemistPrivacyEpoch',2)
service.saveCoachEffort('max');assert.equal(service.readCoachEffort(),'max')
runtime.storage.set('stemistUser',{id:'student-b'});assert.equal(service.readCoachEffort(),'low')
runtime.storage.set('stemistUser',{id:'student-a'});assert.equal(service.readCoachEffort(),'max')
runtime.storage.set('stemistPrivacyEpoch',3);assert.equal(service.readCoachEffort(),'low')
for(const value of ['medium',{},null,4])assert.throws(()=>service.saveCoachEffort(value))
assert.equal(service.coachEffortTimeout('low',55000),55000)
assert.ok(service.coachEffortTimeout('max',55000)>service.coachEffortTimeout('high',55000))
assert.ok(service.coachEffortTimeout('max',55000)<=150000)
console.log('Coach effort preference: low default, owner/epoch isolation, validation and bounded client wait PASS.')
