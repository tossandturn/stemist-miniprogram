import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'pages/notebook/index.js'), 'utf8')
const routes = [
  { routeId: 'cie-9702-as-physics', subjectCode: '9702', subjectLabel: 'Physics', stage: 'AS', components: 'P1 + P2 + P3' },
  { routeId: 'bpho-admissions-physics', subjectCode: 'bpho', subjectLabel: 'BPhO', stage: 'Competition', components: 'Round 1' },
  { routeId: 'uatuk-esat-admissions', subjectCode: 'esat', subjectLabel: 'ESAT', stage: 'Admissions', components: 'Maths + science' },
]
let pageConfig
const fakeRequire = (name) => {
  if (name === '../../utils/page') return { deviceState: (value) => value, syncDevice: () => {}, scheduleDraft: () => {}, cancelDraft: () => {} }
  if (name === '../../utils/api') return { getJson: async () => ({}), requestJson: async () => ({}) }
  if (name === '../../utils/stemRoutes') return { STEM_ROUTES: routes }
  if (name === '../../utils/stemCatalog') return {
    categoryForRoute: (routeId) => String(routeId).startsWith('cie-') ? 'alevel' : 'competition',
    normalizeStemCategory: (value) => String(value || '').toLowerCase() === 'competition' ? 'competition' : 'alevel',
    stemCategoryProfile: (value) => ({ label: String(value || '').toLowerCase() === 'competition' ? '竞赛 / 入学考试' : 'A-Level 学科' }),
    familyForCategoryStage: (category, stage) => category === 'competition' ? (stage === 'Admissions' ? 'admissions' : 'competition') : 'exam',
  }
  throw new Error(`unexpected module ${name}`)
}
vm.runInNewContext(source, { Page: (config) => { pageConfig = config }, require: fakeRequire, wx: { getStorageSync: () => '', setStorageSync: () => {}, removeStorageSync: () => {}, showModal: () => {} }, String, Number, Boolean, Array, Object, Date, Promise, encodeURIComponent })
const page = { data: JSON.parse(JSON.stringify(pageConfig.data)), setData(update, callback) { Object.assign(this.data, update); if (callback) callback() } }
Object.assign(page, pageConfig)
pageConfig.onLoad.call(page, { category: 'competition', routeId: 'uatuk-esat-admissions' })
assert.equal(page.data.category, 'competition')
assert.equal(page.data.family, 'admissions')
assert.equal(page.data.routeId, 'uatuk-esat-admissions')
assert.equal(page.data.routes.some((route) => route.routeId.startsWith('cie-')), false)
console.log('Notebook entry scope contract passed.')
