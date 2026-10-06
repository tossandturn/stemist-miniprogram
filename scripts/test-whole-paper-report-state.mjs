import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { miniRuntime } from './helpers/mini-runtime.mjs'

function fixture() {
  const scope = { owner: 'synthetic-report-owner', epoch: 0 }
  const r = miniRuntime({ modules: { 'bundles/marking/service': {
    scope: () => scope, current: () => true, list: async () => [],
    releaseFiles: async () => {}, errorMessage: e => e.message,
  } } })
  r.storage.set('stemistUser', { id: scope.owner })
  r.storage.set('stemistSessionToken', 'synthetic-report-session')
  const page = r.page('bundles/marking/index')
  page.onLoad()
  return page
}
const validResult = () => ({
  assessmentMode: 'ai-provisional', officialScore: false, formalProgressEligible: false,
  summary: 'Synthetic visible assessment.', provisionalScore: 3, maxScore: 4,
  missingPages: [], missingQuestions: [], reviewRequired: false,
  questionResults: [{ questionLabel: '2(a)', provisionalScore: 3, maxScore: 4,
    rationale: 'Synthetic method feedback.', evidence: ['Answer page 1: F = ma'],
    confidence: 0.9, reviewRequired: false, criteria: [] }],
})
const job = result => ({ jobId: 'synthetic-report-job', status: 'completed', result })

test('empty completed records never advertise a usable report', () => {
  for (const result of [null, {}, { summary: 'Only a summary', questionResults: [] }]) {
    const p = fixture()
    p.setJob(job(result))
    assert.equal(p.data.result, null)
    assert.notEqual(p.data.flowStep, 3)
    assert.doesNotMatch(p.data.jobLabel, /已完成/)
    assert.match(p.data.jobStateHint, /报告|批改|AI/)
    assert.equal(p.data.error, '', 'Invalid completed state is rendered once in the status card, not repeated as a page alert')
    p.onUnload()
  }
})

test('incomplete source feedback cannot render contradictory point scores', () => {
  for (const missing of [{ missingQuestions: ['2(a)'] }, { missingPages: [2] }]) {
    const p = fixture(), result = { ...validResult(), ...missing, reviewRequired: true }
    p.setJob(job(result))
    assert.equal(p.data.result.scoreReady, false)
    assert.equal(p.data.questions[0].scoreReady, false)
    assert.equal(p.data.questions[0].feedback, result.questionResults[0].rationale)
    assert.match(p.data.result.completeness, /2/)
    p.onUnload()
  }
})

test('reference-backed legacy scores without student evidence stay hidden', () => {
  const p = fixture(), result = validResult()
  result.questionResults[0].evidence = []
  p.setJob(job(result))
  assert.equal(p.data.result.scoreReady, false)
  assert.equal(p.data.questions[0].scoreReady, false)
  assert.equal(p.data.result.reviewRequired, true)
  p.onUnload()
})

test('an explicit abstention never falls through to a stale legacy score', () => {
  const p = fixture(), result = validResult()
  result.questionResults[0].provisionalScore = null
  result.questionResults[0].score = 3
  p.setJob(job(result))
  assert.equal(p.data.result.scoreReady, false)
  assert.equal(p.data.questions[0].scoreReady, false)
  p.onUnload()
})

test('a complete evidence-backed estimate and an unscored advisory remain usable', () => {
  const p = fixture(), result = validResult()
  p.setJob({ ...job(result), reportPdfPath: '/api/report.pdf' })
  assert.equal(p.data.flowStep, 3)
  assert.equal(p.data.result.scoreReady, true)
  assert.equal(p.data.questions[0].scoreReady, true)
  assert.equal(p.data.reportAvailable, true)
  p.setJob(job({ ...result, assessmentMode: 'ai-advisory-unscored', provisionalScore: null, maxScore: null, reviewRequired: true }))
  assert.equal(p.data.result.scoreReady, false)
  assert.equal(p.data.questions[0].scoreReady, false)
  assert.equal(p.data.questions.length, 1)
  p.onUnload()
})

test('each question score is visibly labelled as an AI estimate', () => {
  const template = fs.readFileSync(new URL('../bundles/marking/index.wxml', import.meta.url), 'utf8')
  assert.equal(/<text wx:if="{{item\.scoreReady}}">[^<]*AI 估分[^<]*<\/text>/.test(template), true, 'Question scores must carry the AI estimate label')
})
