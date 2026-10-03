import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'

import { miniRuntime } from './helpers/mini-runtime.mjs'

const backendIndex = process.argv.indexOf('--backend')
if (backendIndex < 0 || !process.argv[backendIndex + 1]) throw Error('Supply --backend with the reviewed STEM backend worktree.')

const backend = path.resolve(process.argv[backendIndex + 1])
const stem = await import(pathToFileURL(path.join(backend, 'server/stemApi.js')).href)
const bank = await import(pathToFileURL(path.join(backend, 'src/data/questionBank.js')).href)
const rebind = await import(pathToFileURL(path.join(backend, 'src/lib/syllabusPracticeRebind.js')).href)

const routeId = 'cie-9702-as-physics'
const topicId = 'physics-9702-topic-01'
const signingKey = 'mini-mixed-chapter-study-signing-key'

function token(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    iss: 'ieltsist.com', aud: 'stem.ieltsist.com', sub: `ielts:${userId}`, username: `mini-${userId}`, iat: now, exp: now + 300,
  })).toString('base64url')
  return `${header}.${payload}.${crypto.createHmac('sha256', signingKey).update(`${header}.${payload}`).digest('base64url')}`
}

function call(api, { method, url, body, bearer = '', headers = {} }) {
  return new Promise((resolve, reject) => {
    const request = Readable.from(body ? [Buffer.from(JSON.stringify(body), 'utf8')] : [])
    request.method = method
    request.url = url
    request.headers = {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...headers,
    }
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[String(name).toLowerCase()] = value },
      end(raw = '') {
        const text = String(raw || '')
        resolve({ statusCode: this.statusCode, payload: text ? JSON.parse(text) : null })
      },
    }
    Promise.resolve(api(request, response, () => reject(Error(`Unhandled ${method} ${url}`)))).catch(reject)
  })
}

function reviewedQuestion(component) {
  const question = bank.studyQuestionBank.find((candidate) => (
    candidate.routeId === routeId
    && Number(candidate.paperComponent) === component
    && bank.isHumanReviewedPastPaperItem(candidate)
  ))
  assert.ok(question, `reviewed P${component} fixture`)
  assert.equal(question.syllabusMapping?.primaryTopicId, topicId)
  return question
}

function unitFromSet(set, id) {
  return {
    id,
    type: 'topic',
    sourceAuthority: 'server-syllabus',
    sourceGateVersion: 'server-syllabus-catalog-v2',
    routeId: set.routeId,
    stage: set.stage,
    knowledgeGroupId: set.selectedSyllabusTopicIds[0],
    syllabusTopic: set.selectedSyllabusTopicIds.join(','),
    paperComponent: set.components,
    studyMode: set.studyMode,
    sourcePreference: set.sourcePreference,
    foundationCatalog: set.foundationCatalog,
    practiceMode: set.practiceMode,
    parts: set.questionGroups.flatMap((group) => group.parts.map((part) => ({
      id: `${id}:${group.id}:${part.partId}`,
      sourceQuestionId: group.id,
      questionPartId: part.partId,
      sourceKind: part.sourceKind,
      originalQuestionId: part.originalQuestionId,
      originalCatalogVersion: part.originalCatalogVersion,
      foundationCatalog: part.foundationCatalog,
      itemKind: part.itemKind,
      skillFocus: part.skillFocus,
      markingProvenance: part.markingProvenance,
      sourceBindingProvenance: part.sourceBindingProvenance,
    }))),
  }
}

const fixtures = [reviewedQuestion(1), reviewedQuestion(2)]
assert.equal(fixtures[0].answerType, 'multiple-choice')
assert.notEqual(fixtures[1].answerType, 'multiple-choice')

const api = stem.createStemApi({
  env: {
    NODE_ENV: 'test',
    STEM_DB_PATH: ':memory:',
    STEM_IDENTITY_SIGNING_KEY: signingKey,
    STEM_MARKING_CAPABILITY_SIGNING_KEY: 'mini-mixed-chapter-study-marking-key',
  },
  questionBank: fixtures,
})
const bearer = token(4101)
const backendCalls = []
const practiceSets = []
const partMarks = new Map()

try {
  const runtime = miniRuntime({ modules: {
    'utils/image': {
      readAsJpegDataUrl: async () => 'data:image/jpeg;base64,c3ludGhldGlj',
      compressImage: async (value) => value,
    },
    'utils/api': {
      requestJson: async (url, body, options = {}) => {
        backendCalls.push({ url, body })
        if (url === '/api/ai/mark-handwriting') {
          const marks = partMarks.get(body?.provenance?.questionPartId)
          assert.ok(Number.isFinite(marks) && marks > 0, 'fake AI result remains bound to a real official part')
          return { mode: 'vision', providerStatus: 'connected', score: 0, maxScore: marks, confidence: 0.9, summary: 'Synthetic local contract result.', reviewRequired: true }
        }
        const method = String(options.method || 'POST').toUpperCase()
        const response = await call(api, {
          method,
          url,
          body,
          bearer: url === '/api/stem/practice-sets' ? '' : bearer,
          headers: url === '/api/stem/practice-sets' ? { 'x-stemist-source-images': 'region-v2' } : {},
        })
        if (response.statusCode >= 400) throw Object.assign(Error(`${url}: ${response.payload?.error || 'request failed'}`), { statusCode: response.statusCode, code: response.payload?.code })
        if (url === '/api/stem/practice-sets') practiceSets.push(response.payload)
        return response.payload
      },
    },
  } })
  runtime.storage.set('stemistUser', { id: 'ielts:4101' })
  runtime.storage.set('stemistSessionToken', bearer)
  const native = runtime.load('utils/nativePractice')

  async function runOfficial(component, expectedFormat) {
    const spec = {
      routeId,
      stage: 'AS',
      subjectCode: '9702',
      components: [component],
      syllabusTopicIds: [topicId],
      questionCount: 4,
      studyMode: 'chapter-study',
      sourcePreference: 'official-first',
      foundationCatalog: 'v2',
    }
    const setIndex = practiceSets.length
    const session = await native.generatePractice(spec)
    const set = practiceSets[setIndex]
    assert.equal(session.sourceMix.official, 1)
    assert.equal(session.sourceMix.originalFoundation, 3)
    assert.equal(session.questions.length, 4)
    const official = session.questions.find((question) => !question.original)
    assert.ok(official)
    assert.equal(official.answerFormat, expectedFormat)
    native.saveSession(session)
    const attemptCallStart = backendCalls.length

    if (expectedFormat === 'single-choice') {
      native.saveChoice(session.id, official.id, 'A')
      await native.markChoice(session.id, official.id)
    } else {
      const saved = native.readSession(session.id)
      const markable = official.parts.filter((part) => part.canMark)
      assert.ok(markable.length, 'reviewed written fixture exposes canonical AI-markable parts')
      for (const part of markable) partMarks.set(part.id, part.marks)
      saved.answers[official.id] = { photo: 'wxfile://usr/native-practice/synthetic.jpg', revision: 1, results: {}, attemptId: `${session.id}-written` }
      native.saveSession(saved)
      await native.markQuestion(session.id, official.id)
    }

    const attemptCall = backendCalls.slice(attemptCallStart).find((entry) => entry.url === '/api/stem/attempts')
    assert.ok(attemptCall)
    const attemptId = attemptCall.body.attemptId
    assert.equal(attemptCall.body.studyMode, 'chapter-study')
    assert.equal(attemptCall.body.sourcePreference, 'official-first')
    assert.equal(attemptCall.body.foundationCatalog, 'v2')
    assert.equal(attemptCall.body.attempt.studyMode, attemptCall.body.studyMode)
    assert.equal(attemptCall.body.attempt.sourcePreference, attemptCall.body.sourcePreference)
    assert.equal(attemptCall.body.attempt.foundationCatalog, attemptCall.body.foundationCatalog)

    const unit = unitFromSet(set, `syllabus-set:mini-mixed-p${component}`)
    const rebound = await call(api, {
      method: 'POST',
      url: '/api/stem/practice-sets/rebind',
      body: { unit: rebind.syllabusPracticeRebindPayload(unit) },
      bearer,
    })
    assert.equal(rebound.statusCode, 200, rebound.payload?.error)
    assert.equal(rebound.payload.unit.studyMode, 'chapter-study')
    assert.equal(rebound.payload.unit.sourcePreference, 'official-first')
    assert.equal(rebound.payload.unit.foundationCatalog, 'v2')
    assert.deepEqual(rebound.payload.unit.sourceMix, { official: 1, originalFoundation: 3 })
    return { attemptId, questionId: official.id, component }
  }

  const mcq = await runOfficial(1, 'single-choice')
  const written = await runOfficial(2, 'written')
  const history = await call(api, { method: 'GET', url: '/api/stem/attempts', bearer })
  assert.equal(history.statusCode, 200)
  for (const expected of [mcq, written]) {
    const saved = history.payload.attempts.find((attempt) => attempt.attemptId === expected.attemptId)
    assert.ok(saved, `persisted P${expected.component} chapter attempt`)
    assert.equal(saved.binding.studyMode, 'chapter-study')
    assert.equal(saved.binding.sourcePreference, 'official-first')
    assert.equal(saved.binding.foundationCatalog, 'v2')
    assert.equal(saved.attempt.studyMode, 'chapter-study')
    assert.equal(saved.attempt.sourcePreference, 'official-first')
    assert.equal(saved.attempt.foundationCatalog, 'v2')
    assert.ok(saved.binding.parts.every((part) => !String(part.sourceQuestionId).startsWith('original-foundation:')))
  }

  console.log(JSON.stringify({ status: 'pass', mcq, written, historyCount: history.payload.attempts.length, mixedSource: { official: 1, originalFoundation: 3 } }))
} finally {
  stem.closeStemDatabaseForTests()
}
