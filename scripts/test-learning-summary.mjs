import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const now = Date.parse('2026-09-04T12:00:00+08:00')
const storage = {
  'stemistSubmission:stem-photo': { submittedAt: now - 60_000, skill: 'stem-photo' },
  'stemistSubmission:reading': { submittedAt: now - 8 * 24 * 60 * 60 * 1000, skill: 'reading' },
  'stemistDraft:writing': { text: 'draft' },
  'stemistDraft:coach': { message: 'question' },
}
const module = { exports: {} }
const source = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'utils/learningSummary.js'), 'utf8')
vm.runInNewContext(source, { module, exports: module.exports, wx: { getStorageSync: (key) => storage[key] }, Date, Number, String, Array, Object, Set })
const summary = module.exports.localLearningSummary(now)
assert.equal(summary.submissions.length, 2)
assert.equal(summary.recentActivity.skill, 'stem-photo')
assert.equal(summary.completedThisWeek, 1)
assert.equal(summary.draftCount, 2)
const remote = module.exports.remoteLearningRecords([{ attemptId: 'remote-1', mode: 'topic', routeId: 'cie-9702-as-physics', stage: 'AS', submittedAt: new Date(now).toISOString(), attempt: { markingMode: 'ai-coach-photo' } }])
const merged = module.exports.mergeLearningRecords(summary.submissions, remote)
assert.equal(merged[0].attemptId, 'remote-1')
assert.equal(merged[0].coachMode, 'ai')
assert.equal(merged.length, 3)
console.log('Local learning summary contract passed.')
