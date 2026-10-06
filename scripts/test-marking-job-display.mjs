import assert from 'node:assert/strict'
import fs from 'node:fs'
import { deferred, miniRuntime, settle } from './helpers/mini-runtime.mjs'

const {
  formatBeijingTime,
  markingJobDisplay,
  retryRequestId,
} = miniRuntime().load('bundles/marking/display')

const baseJob = (overrides = {}) => ({
  jobId: 'job-display-fixture-123',
  status: 'failed',
  failureCode: 'marking_timeout',
  retryable: true,
  processingAttempt: 2,
  progress: { stage: 'failed', elapsedSeconds: 95 },
  result: null,
  sourcePdfPath: '/api/stem/paper-marking-jobs/job-display-fixture-123/source.pdf',
  reportPdfPath: null,
  expiresAt: '2026-10-13T12:28:29.000Z',
  ...overrides,
})

assert.equal(formatBeijingTime('2026-10-13T12:28:29.000Z'), '2026年10月13日 20:28（北京时间）')
for (const invalid of ['', null, 'not-a-date', '1970-01-01T00:00:00.000Z', '2099-99-99T00:00:00Z']) {
  assert.equal(formatBeijingTime(invalid), '', `Invalid or epoch-like value must stay hidden: ${invalid}`)
}

const timeout = markingJobDisplay(baseJob(), { resultValid: false, reportAvailable: false })
assert.equal(timeout.displayStatus, 'failed')
assert.equal(timeout.failureTitle, '批改超时')
assert.equal(timeout.failureAction, 'retry')
assert.equal(timeout.failureActionLabel, '重试批改')
assert.match(timeout.failureDetail, /作答文件仍保留/)
assert.match(timeout.retentionLabel, /作答 PDF 保留至 2026年10月13日 20:28（北京时间）/)
assert.doesNotMatch(timeout.retentionLabel, /下载报告/)

const cases = [
  ['ai_assessment_empty', 'AI 未返回可用的逐题结果'],
  ['ai_assessment_invalid_json', 'AI 返回内容未通过校验'],
  ['ai_assessment_provider_envelope_invalid', 'AI 返回内容未通过校验'],
  ['vision_review_failed', 'AI 服务暂时不可用'],
  ['vision_not_configured', 'AI 服务暂时不可用'],
  ['worker_restarted', '批改服务重启后已暂停'],
  ['request_aborted', '批改超时'],
]
for (const [failureCode, title] of cases) {
  const display = markingJobDisplay(baseJob({ failureCode }), { resultValid: false, reportAvailable: false })
  assert.equal(display.failureTitle, title, failureCode)
  assert.doesNotMatch(display.failureDetail, /provider|https?:\/\/|endpoint|stack/i, `${failureCode} must not leak internals`)
}

const result = { summary: 'Synthetic AI feedback', questionResults: [{ questionLabel: '1', rationale: 'Visible work' }] }
const reportFailure = markingJobDisplay(baseJob({ failureCode: 'report_pdf_invalid', result }), { resultValid: true, reportAvailable: false })
assert.equal(reportFailure.failureTitle, 'PDF 报告生成失败')
assert.equal(reportFailure.failureActionLabel, '重新生成报告')
assert.match(reportFailure.failureDetail, /批改文字已保留/)
assert.equal(reportFailure.flowStep, 3, 'A report-only failure belongs to the report step, not the AI analysis step')
assert.equal(reportFailure.currentStepLabel, '生成报告')
const bareReportFailure = markingJobDisplay(baseJob({ failureCode: 'marking_failed', result }), { resultValid: true, reportAvailable: false })
assert.equal(bareReportFailure.failureTitle, 'PDF 报告生成失败', 'A validated result without report is safely identified from artifact state even when the legacy code is generic')
const diagnosedReportFailure = markingJobDisplay(baseJob({ failureCode: 'marking_failed', progress: { stage: 'failed', lastStage: 'reporting' } }), { resultValid: false, reportAvailable: false })
assert.equal(diagnosedReportFailure.flowStep, 3, 'The server lastStage can safely identify a report-stage failure without exposing internals')

const completed = markingJobDisplay(baseJob({
  status: 'completed', failureCode: null, retryable: false, result,
  reportPdfPath: '/api/stem/paper-marking-jobs/job-display-fixture-123/report.pdf',
}), { resultValid: true, reportAvailable: true })
assert.equal(completed.displayStatus, 'completed')
assert.match(completed.retentionLabel, /作答与批改报告保留至/)

const nonRetryable = markingJobDisplay(baseJob({ failureCode: 'provider_image_limit', retryable: false }), { resultValid: false, reportAvailable: false })
assert.equal(nonRetryable.failureAction, 'new')
assert.equal(nonRetryable.failureActionLabel, '新建批改')

const pending = markingJobDisplay(baseJob(), { resultValid: false, reportAvailable: false, retryConfirmationPending: true })
assert.equal(pending.failureAction, 'refresh')
assert.equal(pending.failureActionLabel, '确认任务状态')
assert.match(pending.failureDetail, /不会重复提交重试/)

const retryId = retryRequestId(baseJob())
assert.equal(retryId, retryRequestId(baseJob()), 'The same failed attempt reuses one idempotency key')
assert.notEqual(retryId, retryRequestId(baseJob({ processingAttempt: 3 })), 'A later failed attempt gets a new retry key')
assert.match(retryId, /^[A-Za-z0-9._:-]{8,100}$/)

const template = fs.readFileSync(new URL('../bundles/marking/index.wxml', import.meta.url), 'utf8')
assert.match(template, /<stemist-header wx:if="{{false}}"\s*\/>/, 'The declared shared header remains a non-rendered manifest-contract reference')
assert.doesNotMatch(template, /<stemist-header[^>]*(?:title|action-text)=/, 'Native navigation alone provides the visible page title and back action')
assert.match(template, /不计入正式成绩/, 'Automatic AI marking must remain explicitly non-formal')
assert.match(template, /id="marking-failure-card"/)
assert.match(template, /id="marking-refresh-error"[^>]*role="alert"/)
assert.match(template, /failureAction === 'retry'/)
assert.match(template, /failureAction === 'refresh'/)
assert.match(template, /failureAction === 'new'/)
assert.match(template, /flowStep === 3 \? \(jobStatus === 'failed' \? 'active failed'/, 'Report-only failure marks step 3, not step 2')
assert.doesNotMatch(template, /文件保留至 \{\{expiresAt\}\}，请及时下载报告/, 'Download copy must depend on an actual report file')

function pageFixture({ retry, get }, runtimeOptions = {}) {
  const scope = { owner: 'synthetic-display-owner', epoch: 0 }
  const calls = { retry: [], get: 0 }
  const service = {
    scope: () => scope,
    current: () => true,
    list: async () => [],
    releaseFiles: async () => {},
    errorMessage: error => error?.message || '请求未完成',
    retry: async (jobId, requestId, activeScope) => {
      calls.retry.push({ jobId, requestId, activeScope })
      return retry(jobId, requestId, activeScope)
    },
    get: async (...args) => { calls.get++; return get(...args) },
  }
  const runtime = miniRuntime({ ...runtimeOptions, modules: { ...(runtimeOptions.modules || {}), 'bundles/marking/service': service } })
  runtime.storage.set('stemistUser', { id: scope.owner })
  runtime.storage.set('stemistSessionToken', 'synthetic-session')
  const page = runtime.page('bundles/marking/index')
  page.onLoad()
  page.__draft.jobId = baseJob().jobId
  page.setJob(baseJob())
  return { page, calls, runtime }
}

{
  const gate = deferred()
  const queuedJob = baseJob({ status: 'queued', failureCode: null, retryable: false, progress: { stage: 'queued', elapsedSeconds: 0 } })
  const fixture = pageFixture({
    retry: () => gate.promise,
    get: async () => queuedJob,
  })
  const first = fixture.page.retryJob()
  const second = fixture.page.retryJob()
  await settle()
  assert.equal(fixture.calls.retry.length, 1, 'A busy primary action cannot dispatch two retry requests')
  gate.resolve(queuedJob)
  await Promise.all([first, second])
  assert.equal(fixture.page.data.jobStatus, 'queued', 'The retry response is authoritative without a second status request')
  assert.equal(fixture.calls.get, 0)
  assert.ok(fixture.page.__draft.retryRequestId, 'Retry identity remains persisted until a canonical GET confirms the new state')
  await fixture.page.refreshJob()
  assert.equal(fixture.page.__draft.retryRequestId, undefined)
  fixture.page.onUnload()
}

for (const retryFailure of [
  Error('synthetic response lost after server acceptance'),
  Object.assign(Error('synthetic stale conflict'), { code: 'job_not_retryable', statusCode: 409 }),
]) {
  let serverJob = baseJob()
  const fixture = pageFixture({
    retry: async () => {
      serverJob = baseJob({ status: 'queued', failureCode: null, retryable: false, progress: { stage: 'queued', elapsedSeconds: 1 } })
      throw retryFailure
    },
    get: async () => serverJob,
  })
  await fixture.page.retryJob()
  assert.equal(fixture.calls.get, 1, 'Any uncertain retry outcome immediately reconciles canonical state')
  assert.equal(fixture.page.data.jobStatus, 'queued')
  assert.equal(fixture.page.__draft.retryRequestId, undefined)
  fixture.page.onUnload()
}

{
  let allowRefresh = false
  const networkFailure = Object.assign(Error('请求超时，请检查网络后重试。'), { code: 'network_timeout', statusCode: 0 })
  const fixture = pageFixture({
    retry: async () => { throw networkFailure },
    get: async () => {
      if (!allowRefresh) throw networkFailure
      return baseJob()
    },
  })
  await fixture.page.retryJob()
  assert.equal(fixture.calls.retry.length, 1)
  assert.equal(fixture.page.data.failureAction, 'refresh')
  assert.match(fixture.page.data.refreshError, /上次确认状态|重新读取/)
  assert.equal(fixture.page.data.error, '', 'A refresh failure stays independent from the confirmed job failure')
  assert.equal(fixture.page.data.jobLabel, '批改超时')
  await fixture.page.retryJob()
  assert.equal(fixture.calls.retry.length, 1, 'Unknown acceptance blocks a second server retry round')
  allowRefresh = true
  await fixture.page.refreshJob()
  assert.equal(fixture.page.data.refreshError, '')
  assert.equal(fixture.page.data.failureAction, 'retry')
  await fixture.page.retryJob()
  assert.equal(fixture.calls.retry.length, 2)
  assert.equal(fixture.calls.retry[0].requestId, fixture.calls.retry[1].requestId, 'A confirmed unchanged failure safely reuses the same retry request ID')
  fixture.page.onUnload()
}

{
  const requestIds = []
  const transportFailure = Object.assign(Error('synthetic transport failure'), { code: 'network_error', statusCode: 0 })
  const fixture = pageFixture({
    retry: async (_jobId, requestId) => { requestIds.push(requestId); throw transportFailure },
    get: async () => baseJob(),
  })
  await fixture.page.retryJob()
  const persistedId = fixture.page.__draft.retryRequestId
  assert.equal(requestIds[0], persistedId)
  fixture.page.onUnload()
  const restored = fixture.runtime.page('bundles/marking/index')
  restored.onLoad()
  restored.setJob(baseJob())
  assert.equal(restored.data.failureAction, 'refresh', 'A restored pending retry confirms canonical state before another POST')
  await restored.refreshJob()
  assert.equal(restored.data.failureAction, 'retry')
  await restored.retryJob()
  assert.equal(requestIds[1], persistedId, 'The retry identity survives a page reload for the same owner, epoch, job and attempt')
  restored.onUnload()
}

{
  const retryGate = deferred()
  const queuedJob = baseJob({ status: 'queued', failureCode: null, retryable: false, progress: { stage: 'queued' } })
  const fixture = pageFixture({ retry: () => retryGate.promise, get: async () => queuedJob })
  const pending = fixture.page.retryJob()
  await settle()
  fixture.page.onHide()
  retryGate.resolve(queuedJob)
  await pending
  assert.equal(fixture.page.data.jobStatus, 'failed', 'A response from an earlier page generation cannot update the hidden page')
  fixture.page.onShow()
  await settle();await settle()
  assert.equal(fixture.page.data.jobStatus, 'queued', 'Returning to the page reconciles the persisted retry through canonical GET')
  fixture.page.onUnload()
}

{
  let owner = 'owner-a', epoch = 0
  const retryGate = deferred()
  const service = {
    scope: () => ({ owner, epoch }),
    current: scope => scope?.owner === owner && scope?.epoch === epoch,
    list: async () => [], releaseFiles: async () => {}, errorMessage: error => error?.message || 'failure',
    retry: () => retryGate.promise,
    get: async () => baseJob({ status: 'queued', failureCode: null, retryable: false, progress: { stage: 'queued' } }),
  }
  const runtime = miniRuntime({ modules: { 'bundles/marking/service': service } })
  runtime.storage.set('stemistUser', { id: owner });runtime.storage.set('stemistSessionToken', 'synthetic-session')
  const page = runtime.page('bundles/marking/index');page.onLoad();page.__draft.jobId = baseJob().jobId;page.setJob(baseJob())
  const pending = page.retryJob();await settle()
  const oldKey = page.__key
  owner = 'owner-b';epoch = 1
  runtime.storage.set('stemistUser', { id: owner });runtime.storage.set('stemistPrivacyEpoch', epoch)
  retryGate.resolve(baseJob({ status: 'queued', failureCode: null, retryable: false, progress: { stage: 'queued' } }))
  await pending
  assert.equal(page.__scope.owner, owner)
  assert.equal(page.__scope.epoch, epoch)
  assert.equal(page.data.jobId, '', 'A late retry response cannot cross the owner/epoch boundary')
  assert.ok(runtime.storage.get(oldKey)?.retryRequestId, 'The old owner keeps its scoped pending identity for later canonical reconciliation')
  assert.equal(page.__draft.retryRequestId, undefined, 'The new owner never inherits the old retry identity')
  page.onUnload()
}

{
  const scheduled = []
  let nextTimer = 0
  const fixture = pageFixture({
    retry: async () => baseJob(),
    get: async () => { throw Error('synthetic transient status failure') },
  }, { globals: {
    setTimeout: (callback, delay) => { scheduled.push({ id: ++nextTimer, callback, delay }); return nextTimer },
    clearTimeout: () => {},
  } })
  fixture.page.__draft.jobId = 'job-unresolved-fixture-123'
  fixture.page.setData({ jobId: fixture.page.__draft.jobId, jobStatus: '' })
  await fixture.page.refreshJob()
  const delays = []
  while (scheduled.length) {
    const timer = scheduled.shift()
    delays.push(timer.delay)
    await timer.callback()
  }
  assert.deepEqual(delays, [4000, 8000, 16000, 30000], 'Unknown restored jobs use bounded backoff rather than stopping or polling forever')
  assert.equal(fixture.calls.get, 5)
  assert.match(fixture.page.data.refreshError, /重新读取状态/)
  fixture.page.onUnload()
}

console.log('Marking job display: safe failure taxonomy, Beijing retention, single recovery, idempotent retry, and independent refresh error passed.')
