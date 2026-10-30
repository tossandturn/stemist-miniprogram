import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'

const legacy = { url: '/question-assets/cie-9702-9702_s25_qp_11/qp-03.jpg', page: 3, imageSize: [1020, 1320], region: [.078, .06, .93, .197] }
const session = { id: 'geometry-test', routeId: 'cie-9702-as-physics', stage: 'AS', subjectCode: '9702', index: 0 }
let descriptor = legacy
const runtime = miniRuntime({ modules: { 'utils/nativePractice': {
  readSession: () => session,
  questionView: () => ({ question: { id: 'q1', fullPage: false, images: [{ id: 'q1-0', url: 'https://stem.ieltsist.com' + descriptor.url, ...source.sourceRegionStyle(descriptor) }] }, results: [] })
} } })
const source = runtime.load('utils/sourceRegion'), page = runtime.page('pages/stem/practice')
page.onLoad({ sessionId: session.id })
page.imageLoaded({ currentTarget: { dataset: { id: 'q1-0' } }, detail: { width: 992, height: 1404 } })
assert.equal(page.data.question.images[0].cropped, false, 'stale full-page coordinates must not crop different pixels')
assert.equal(page.data.question.fullPage, true, 'show the original-page question-number guidance')
assert.equal(page.data.question.images[0].failed, false, 'a validated original page remains usable')
page.refresh()
assert.equal(page.data.question.images[0].cropped, false, 'saving an answer must not reapply stale crop coordinates')

descriptor = { ...legacy, imageSize: [992, 1404] }
page.refresh()
assert.equal(page.data.question.images[0].cropped, true, 'updated matching geometry may use its verified crop')
assert.equal(page.data.question.fullPage, false)

descriptor = { ...legacy, url: '/api/stem/practice-source-image?routeId=cie-9702-as-physics&sourceQuestionId=q1&region=0&v=' + 'a'.repeat(64) }
page.refresh()
page.imageLoaded({ currentTarget: { dataset: { id: 'q1-0' } }, detail: { width: 992, height: 1404 } })
assert.equal(page.data.question.images[0].failed, true, 'versioned image mismatches must stay fail-closed')
assert.equal(page.data.question.fullPage, false)
console.log('Practice image geometry: original-page fallback, refresh persistence, repaired geometry and versioned fail-closed passed.')
