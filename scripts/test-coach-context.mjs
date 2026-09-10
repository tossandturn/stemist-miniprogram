import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'pages/coach/index.js'), 'utf8')
let pageConfig
const fakeRequire = (name) => {
  if (name === '../../utils/page') return { deviceState: (value) => value, syncDevice: () => {}, readDraft: () => null, scheduleDraft: () => {}, clearDraft: () => {}, cancelDraft: () => {} }
  if (name === '../../utils/coach') return { runCoach: async () => ({ answer: 'ok', mode: 'ai', providerStatus: 'connected', coachState: { label: 'AI 已连接' } }) }
  if (name === '../../utils/api') return { isAuthError: () => false }
  if (name === '../../utils/ieltsLearning') return { requestIeltsLearning: async () => ({}) }
  if (name === '../../utils/coachEntry') return { takeCoachEntry: () => null, focusPassage: value => value }
  if (name === '../../utils/nativeCaptions') return { loadCaptions: async () => ({words:[]}) }
  if (name === '../../utils/image') return { readAsJpegDataUrl: async () => {throw Error('No photo belongs to this text-only context')} }
  if (name === '../../utils/nativeCoachPhoto') return { readCoachPhoto: () => '', clearCoachPhoto: () => true }
  throw new Error(`unexpected module ${name}`)
}
vm.runInNewContext(source, { Page: (config) => { pageConfig = config }, require: fakeRequire, wx: { getStorageSync: () => '', setStorageSync: () => {}, navigateTo: () => {} }, String, Number, Boolean, Object, Array, Set, Date, Promise, Error })

function makePage() {
  const page = { ...pageConfig, data: JSON.parse(JSON.stringify(pageConfig.data)), setData(update) { Object.assign(this.data, update) } }
  return page
}

const ielts = makePage()
pageConfig.onLoad.call(ielts, { source: 'ielts', category: 'ielts' })
assert.equal(ielts.data.contextId, 'ielts')
assert.equal(ielts.data.routeContext.category, 'ielts')
assert.equal(ielts.data.routeContextLabel, '')

const competition = makePage()
pageConfig.onLoad.call(competition, { source: 'competition', category: 'competition', family: 'admissions', routeId: 'uatuk-esat-admissions', stage: 'Admissions', subjectCode: 'esat' })
assert.equal(competition.data.contextId, 'stem-photo')
assert.equal(competition.data.routeContext.category, 'competition')
assert.equal(competition.data.routeContext.family, 'admissions')
assert.equal(competition.data.routeContext.category, 'competition')
assert.equal(competition.data.routeContext.stage, 'Admissions')
console.log('AI Coach product-context separation contract passed.')
