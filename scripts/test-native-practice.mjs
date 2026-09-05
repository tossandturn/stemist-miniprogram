import assert from 'node:assert/strict'
import { miniRuntime, deferred, settle } from './helpers/mini-runtime.mjs'

const routeId = 'cie-9702-as-physics'
const spec = { routeId, stage: 'AS', subjectCode: '9702', components: [1, 2], syllabusTopicIds: ['t1', 't2'], questionCount: 6 }
const ids = (start, count) => Array.from({ length: count }, (_, i) => `q${i + start}`)
function inventory() {
  return { routeId, paperComponents: [1, 2], topics: [
    { id: 't1', name: 'Units', questionIdsByComponent: { 1: { verifiedQuestionIds: ids(0, 7) }, 2: { verifiedQuestionIds: ids(7, 5) } } },
    { id: 't2', name: 'Motion', questionIdsByComponent: { 1: { verifiedQuestionIds: ids(0, 6) }, 2: { verifiedQuestionIds: ids(12, 6) } } },
  ] }
}
function payload() {
  return { schemaVersion: 'syllabus-practice-set-v1', ...spec, practiceMode: 'verified', formalProgressEligible: true,
    questionGroups: ids(0, 6).map(id => ({ id, routeId, stage: 'AS', subjectCode: '9702', paperComponent: 2, questionNumber: id, totalMarks: 2,
      studentStudyEligible: true, sourceContent: { complete: true, fileComplete: true, assetUrls: [`/question-assets/paper/qp-1.jpg`] },
      sourceRef: { paperId: 'paper', paper: 'paper.pdf', year: 2025, season: 'Nov' },
      syllabusMapping: { topicIds: ['t1'] },
      parts: [{ partId: `${id}:a`, label: 'a', marks: 2, answerKey: 'SECRET ANSWER', markSchemePoints: ['SECRET RUBRIC'], aiAssistedMarkingAvailable: true,
        markingProvenance: { sourceQuestionId: id, questionPartId: `${id}:a`, bindingSignature: 'bound' } }],
    })) }
}
let passed = 0
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`) }

await check('unique availability and per-topic 12-group floor, not summed or lowered', () => {
  const { selectionState } = miniRuntime().load('utils/nativePractice')
  const both = selectionState(inventory(), ['t1', 't2'], [1, 2], 6)
  assert.equal(both.availableCount, 18)
  assert.equal(both.canStart, true)
  assert.equal(selectionState(inventory(), ['t1', 't2'], [1], 6).canStart, false)
  assert.equal(selectionState(inventory(), ['t1'], [3], 6).canStart, false)
  assert.equal(selectionState(inventory(), [], [1, 2], 6).canStart, false)
})
await check('reject incomplete, wrong route, duplicate and malformed sets', () => {
  const { validatePracticeSet } = miniRuntime().load('utils/nativePractice')
  assert.equal(validatePracticeSet(payload(), spec).questions.length, 6)
  for (const corrupt of [p => p.routeId = 'wrong', p => p.questionGroups[0].sourceContent.complete = false, p => p.questionGroups[1] = p.questionGroups[0], p => p.questionGroups[0].sourceContent.assetUrls = ['https://evil.test/a.jpg'], p => p.questionGroups.pop(), p => p.practiceMode = 'unavailable']) {
    const p = payload(); corrupt(p); assert.throws(() => validatePracticeSet(p, spec))
  }
  assert.throws(() => validatePracticeSet({}, spec))
})
await check('only current question reaches renderer; no answers or provenance in setData', () => {
  const native = miniRuntime().load('utils/nativePractice')
  const s = native.createSession(payload(), spec)
  const view = native.questionView(s, 0)
  assert.equal(view.question.id, 'q0')
  assert.equal(view.question.images.length, 1)
  assert.doesNotMatch(JSON.stringify(view), /SECRET|bindingSignature|markingProvenance|questionGroups/)
  assert.equal(view.navItems.length, 6)
})
await check('public assembly does not forward stale bearer and timeout is not empty bank', async () => {
  let request
  const runtime = miniRuntime({ wx: { request: options => { request = options; options.fail({ errMsg: 'request:fail timeout' }) } } })
  runtime.storage.set('stemistSessionToken', 'test-token')
  await assert.rejects(runtime.load('utils/nativePractice').generatePractice(spec), /超时/)
  assert.equal(request.header.Authorization, undefined)
})
await check('private session ownership and explicit logout invalidate delayed writes', () => {
  const runtime = miniRuntime()
  const native = runtime.load('utils/nativePractice')
  runtime.storage.set('stemistUser', { id: 'student-a' })
  const session = native.createSession(payload(), spec)
  native.saveSession(session)
  runtime.storage.set('stemistUser', { id: 'student-b' })
  assert.equal(native.readSession(session.id), null)
  assert.throws(() => native.saveSession(session), /账号/)
  runtime.storage.set('stemistUser', { id: 'student-a' })
  runtime.load('utils/session').clearLocalSession()
  assert.equal(native.readSession(session.id), null)
  assert.throws(() => native.saveSession(session), /结束/)
})
await check('builder routes natively and locks repeated generation', async () => {
  const wait = deferred(); let calls = 0
  const runtime = miniRuntime({ modules: { 'utils/inventory': { fetchRouteInventory: async () => inventory() }, 'utils/api': { requestJson: async () => { calls++; return wait.promise } } } })
  const page = runtime.page('pages/stem/topics')
  page.onLoad({ routeId }); await settle()
  page.toggleTopic({ currentTarget: { dataset: { id: 't1' } } })
  page.chooseCount({ currentTarget: { dataset: { count: 6 } } })
  const pending = page.start(); await settle(); page.start()
  assert.equal(calls, 1)
  assert.equal(page.data.busy, true)
  wait.resolve({ ...payload(), syllabusTopicIds: ['t1'] }); await pending
  assert.match(runtime.calls.at(-1).url, /^\/pages\/stem\/practice\?sessionId=/)
  assert.equal(page.data.busy, false)
})
await check('marking requires authentic identity and keeps grants/images off persistence', async () => {
  const requests = []
  const runtime = miniRuntime({ modules: { 'utils/image': { readAsJpegDataUrl: async () => 'data:image/jpeg;base64,cGhvdG8=' }, 'utils/api': { requestJson: async (path, body) => {
    requests.push({ path, body })
    if (path.endsWith('/attempts')) return { attempt: { attemptId: body.attemptId } }
    if (path.endsWith('/capabilities')) return { capabilities: [{ questionPartId: 'q0:a', markingGrant: 'test-grant' }] }
    return { mode: 'vision', providerStatus: 'connected', score: 1, maxScore: 2, confidence: 0.8, summary: 'Check units.', reviewRequired: true }
  } } } })
  const native = runtime.load('utils/nativePractice')
  const session = native.createSession(payload(), spec)
  session.answers.q0 = { photo: 'wxfile://usr/native-practice/test.jpg', revision: 1, results: {}, attemptId: 'native-test-q0' }
  native.saveSession(session)
  await assert.rejects(native.markQuestion(session.id, 'q0'), /登录/)
  assert.equal(requests.length, 0)
  runtime.storage.set('stemistUser', { id: 'student-a' }); runtime.storage.set('stemistSessionToken', 'test-token')
  await native.markQuestion(session.id, 'q0')
  assert.deepEqual(requests.map(r => r.path), ['/api/stem/attempts', '/api/stem/marking/capabilities', '/api/ai/mark-handwriting'])
  assert.equal(requests[2].body.provenance.sourceQuestionId, 'q0')
  assert.doesNotMatch(JSON.stringify(requests[0].body), /base64|markingGrant|wxfile/)
  assert.doesNotMatch(JSON.stringify([...runtime.storage.values()].filter(v => typeof v === 'object')), /test-grant|base64/)
  assert.equal(native.readSession(session.id).answers.q0.results['q0:a'].score, 1)
})
await check('durable crop binds one question, retake clears stale marking only after copy succeeds', async () => {
  const copied = [], removed = []
  let failCopy = false
  const runtime = miniRuntime({ wx: { env: { USER_DATA_PATH: 'wxfile://usr' }, getFileSystemManager: () => ({ mkdirSync() {}, accessSync() {}, copyFile: options => { copied.push(options); failCopy ? options.fail({}) : options.success({}) }, unlink: options => removed.push(options.filePath) }) } })
  const native = runtime.load('utils/nativePractice'), session = native.createSession(payload(), spec)
  native.saveSession(session)
  const context = { sessionId: session.id, questionId: 'q0', privacyEpoch: native.epoch() }
  await native.attachPhoto(context, 'wxfile://temp/photo.jpg')
  const first = native.readSession(session.id).answers.q0
  assert.match(first.photo, /^wxfile:\/\/usr\/native-practice\/mini-set-/)
  failCopy = true
  await assert.rejects(native.attachPhoto(context, 'wxfile://temp/new.jpg'), /未保存/)
  assert.equal(native.readSession(session.id).answers.q0.photo, first.photo)
  assert.equal(removed.length, 0)
  failCopy = false
  await native.attachPhoto(context, 'wxfile://temp/new.jpg')
  assert.equal(native.readSession(session.id).answers.q0.revision, 2)
  assert.deepEqual(removed, [first.photo])
})
await check('logout during async photo copy cannot recreate private evidence', async () => {
  let copy; const removed = []
  const runtime = miniRuntime({ wx: { env: { USER_DATA_PATH: 'wxfile://usr' }, getFileSystemManager: () => ({ mkdirSync() {}, accessSync() {}, copyFile: options => { copy = options }, unlink: options => removed.push(options.filePath) }) } })
  const native = runtime.load('utils/nativePractice'), session = native.createSession(payload(), spec)
  native.saveSession(session)
  const pending = native.attachPhoto({ sessionId: session.id, questionId: 'q0', privacyEpoch: native.epoch() }, 'temp.jpg')
  await settle(); runtime.load('utils/session').clearLocalSession(); copy.success({})
  await assert.rejects(pending, /结束/)
  assert.equal(native.readSession(session.id), null)
  assert.deepEqual(removed, [copy.destPath])
})
await check('401 preserves an owned draft behind reauthentication, not a dead end', () => {
  const runtime = miniRuntime(), native = runtime.load('utils/nativePractice')
  runtime.storage.set('stemistUser', { id: 'student-a' })
  const session = native.createSession(payload(), spec); native.saveSession(session)
  runtime.load('utils/session').clearLocalSession({ preserveDrafts: true })
  const page = runtime.page('pages/stem/practice'); page.onLoad({ sessionId: session.id })
  assert.equal(page.data.question, null)
  assert.equal(page.data.authRequired, true)
  runtime.storage.set('stemistUser', { id: 'student-a' })
  runtime.storage.set('stemistSessionToken', 'test-token')
  page.onShow()
  assert.equal(page.data.question.id, 'q0')
})
await check('invalid AI scores and offline success cannot become marking feedback', () => {
  const { verifiedResult } = miniRuntime().load('utils/nativePractice')
  for (const result of [{ mode: 'offline' }, { mode: 'vision', providerStatus: 'connected', score: 3, maxScore: 2, confidence: .8 }, { mode: 'vision', providerStatus: 'connected', score: 1, maxScore: 2, confidence: NaN }]) assert.throws(() => verifiedResult(result, { marks: 2 }))
})
await check('late assembly response after logout never creates a new-account session', async () => {
  const pending = deferred()
  const runtime = miniRuntime({ modules: { 'utils/api': { requestJson: () => pending.promise } } })
  const native = runtime.load('utils/nativePractice'), generation = native.generatePractice(spec)
  runtime.load('utils/session').clearLocalSession(); pending.resolve(payload())
  await assert.rejects(generation, /账号/)
})
console.log(`Native practice: ${passed} checks passed.`)
