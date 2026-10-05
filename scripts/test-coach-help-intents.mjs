import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime } from './helpers/mini-runtime.mjs'

const coach = fs.readFileSync(new URL('../utils/coach.js', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('../utils/api.js', import.meta.url), 'utf8')
const panel = fs.readFileSync(new URL('../components/coach-panel/index.wxml', import.meta.url), 'utf8')
const panelLogic = fs.readFileSync(new URL('../components/coach-panel/index.js', import.meta.url), 'utf8')
const coachPage = fs.readFileSync(new URL('../pages/coach/index.wxml', import.meta.url), 'utf8')
const stemCoachPage = fs.readFileSync(new URL('../pages/stem/coach.wxml', import.meta.url), 'utf8')

assert.match(coach, /helpIntent/, 'Mini Coach orchestration must preserve explicit help intent')
assert.match(api, /helpIntent/, 'both Mini request shapers must forward optional help intent')
assert.match(panel, /worked-solution/, 'the shared panel must provide an opt-in worked-solution action')
assert.match(panelLogic, /showHelpActions:\s*\{\s*type:\s*Boolean,\s*value:\s*false\s*\}/, 'shared Coach actions must remain off by default for existing IELTS/read-only consumers')
assert.match(coachPage, /show-help-actions/, 'the standalone Coach page must opt in to help actions')
assert.match(stemCoachPage, /show-help-actions/, 'the STEM photo Coach page must opt in to help actions')
assert.doesNotMatch(
  fs.readFileSync(new URL('../pages/stem/coach.js', import.meta.url), 'utf8'),
  /第一处问题，并给出一个下一步提示/,
  'standalone STEM photo review must not default to a hint-only request',
)

const apiRequests = []
const orchestration = miniRuntime({ modules: {
  'utils/api': {
    askCoach: async (request) => { apiRequests.push({ channel: 'stem', ...request }); return { mode: 'ai', providerStatus: 'connected', answer: '完整结果' } },
    askIeltsCoach: async (request) => { apiRequests.push({ channel: 'ielts', ...request }); return { mode: 'ai', providerStatus: 'connected', answer: 'IELTS feedback' } },
  },
} }).load('utils/coach')

const photoDefault = await orchestration.runCoach({ context: { product: 'STEM Studio' }, imageDataUrls: ['data:image/jpeg;base64,fixture'] })
assert.equal(apiRequests[0].helpIntent, 'worked-solution')
assert.match(apiRequests[0].message, /完整解答/)
assert.match(apiRequests[0].message, /最终结果/)
assert.equal(photoDefault.completed, true)

for (const message of ['检查第二步', '不要答案，只给我提示']) {
  await orchestration.runCoach({ message, context: { product: 'STEM Studio' }, imageDataUrls: ['data:image/jpeg;base64,fixture'] })
  assert.equal(apiRequests.at(-1).helpIntent, '')
  assert.equal(apiRequests.at(-1).message, message)
}

await orchestration.runCoach({ helpIntent: 'hint', context: { product: 'STEM Studio' }, imageDataUrls: ['data:image/jpeg;base64,fixture'] })
assert.equal(apiRequests.at(-1).helpIntent, 'hint')
assert.match(apiRequests.at(-1).message, /不给最终答案|不要直接给最终答案/)
await orchestration.runCoach({ helpIntent: 'check-work', context: { product: 'STEM Studio' }, imageDataUrls: ['data:image/jpeg;base64,fixture'] })
assert.match(apiRequests.at(-1).message, /第一处错误/)

await orchestration.runCoach({ helpIntent: 'worked-solution', context: { product: 'IELTSist', skill: 'writing' }, imageDataUrls: ['data:image/jpeg;base64,essay'] })
assert.equal(apiRequests.at(-1).channel, 'ielts')
assert.match(apiRequests.at(-1).message, /四项标准/)
assert.doesNotMatch(apiRequests.at(-1).message, /单位检查/)

const failed = await miniRuntime({ modules: { 'utils/api': {
  askCoach: async () => ({ mode: 'offline', providerStatus: 'error', answer: '检查 SI 单位。' }),
  askIeltsCoach: async () => ({ mode: 'offline', providerStatus: 'error', answer: 'Generic hint.' }),
} } }).load('utils/coach').runCoach({ helpIntent: 'worked-solution', context: { product: 'STEM Studio' }, imageDataUrls: ['data:image/jpeg;base64,fixture'] })
assert.equal(failed.completed, false)
assert.equal(failed.answer, '')
assert.doesNotMatch(failed.failureMessage, /SI 单位/)

function photoRuntime({ product = 'STEM Studio', source = 'alevel', apiResult = { mode: 'ai', providerStatus: 'connected', answer: '完成' } } = {}) {
  const requests = []
  const runtime = miniRuntime({ modules: {
    'utils/image': { readAsJpegDataUrl: async (file) => `data:image/jpeg;base64,${file}` },
    'utils/api': {
      isAuthError: () => false,
      askCoach: async (request) => { requests.push({ channel: 'stem', ...request }); return apiResult },
      askIeltsCoach: async (request) => { requests.push({ channel: 'ielts', ...request }); return apiResult },
    },
  } })
  runtime.storage.set('stemistUser', { id: 'ielts:intent' })
  runtime.storage.set('stemistCoachPhoto', '/owned/coach-question.jpg')
  runtime.storage.set('stemistCoachPhotoMeta', { owner: 'ielts:intent', epoch: 0, path: '/owned/coach-question.jpg', contextId: product === 'IELTSist' ? 'writing' : 'stem-photo' })
  const page = runtime.page('pages/coach/index')
  page.onLoad({ source })
  page.onShow()
  return { runtime, page, requests }
}

const defaultPage = photoRuntime()
await defaultPage.page.submit()
assert.equal(defaultPage.requests[0].helpIntent, 'worked-solution', 'empty photo submission defaults to a complete learning answer')

const followup = photoRuntime()
followup.page.chooseHelpIntent({ detail: { value: 'hint' } })
await followup.page.submit()
followup.page.chooseHelpIntent({ detail: { value: 'worked-solution' } })
await followup.page.submit()
assert.equal(followup.requests.length, 2)
assert.equal(followup.requests[0].helpIntent, 'hint')
assert.equal(followup.requests[1].helpIntent, 'worked-solution')
assert.deepEqual(Array.from(followup.requests[1].imageDataUrls), Array.from(followup.requests[0].imageDataUrls), 'hint to full-answer follow-up must reuse the same in-memory photo')
assert.deepEqual(followup.requests[1].context, followup.requests[0].context, 'hint to full-answer follow-up must retain exact context')
assert.equal(followup.requests[1].history.length, 2, 'worked solution must retain the successful hint turn')
assert.equal(followup.page.data.imagePath, '/owned/coach-question.jpg')

const writingPage = photoRuntime({ product: 'IELTSist', source: 'writing' })
await writingPage.page.submit()
assert.equal(writingPage.requests[0].channel, 'ielts')
assert.equal(writingPage.requests[0].helpIntent, 'worked-solution')
assert.match(writingPage.requests[0].message, /四项标准/)

const incompletePage = photoRuntime({ apiResult: { mode: 'offline', providerStatus: 'error', answer: 'Generic safe hint.' } })
await incompletePage.page.submit()
assert.equal(incompletePage.page.data.answer, '')
assert.equal(incompletePage.page.data.canRetry, true)
assert.equal(incompletePage.page.data.imagePath, '/owned/coach-question.jpg')
assert.equal(incompletePage.runtime.storage.has('stemistSubmission:coach-stem-photo'), false, 'an incomplete response must not become a completed submission')

const exam = miniRuntime()
exam.storage.set('stemistUser', { id: 'ielts:exam' })
exam.storage.set('stemistCroppedImage', '/owned/exam.jpg')
exam.storage.set('stemistCroppedImageMeta', { owner: 'ielts:exam', epoch: 0, path: '/owned/exam.jpg' })
exam.storage.set('stemistCoachContext', { attemptId: 'exam-attempt', paperStudyMode: 'exam-simulation', submitted: false })
const examPage = exam.page('pages/stem/coach')
examPage.onLoad()
assert.equal(examPage.data.solutionDisabled, true)
examPage.chooseHelpIntent({ detail: { value: 'worked-solution' } })
assert.equal(examPage.data.helpIntent, '', 'disabled exam action cannot claim answer permission')

assert.match(fs.readFileSync(new URL('../components/coach-panel/index.wxss', import.meta.url), 'utf8'), /coach-help-actions button[^}]*min-height:\s*44px/)
assert.match(fs.readFileSync(new URL('../components/coach-panel/index.wxss', import.meta.url), 'utf8'), /max-width:\s*375px/)

console.log('Mini Coach help-intent source contract passed.')
