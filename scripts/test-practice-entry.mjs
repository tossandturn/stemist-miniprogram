import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'pages/practice/index.js'), 'utf8')
let pageConfig
const routes = [
  { routeId: 'cie-9702-as-physics', subjectCode: '9702', subjectLabel: 'Physics', stage: 'AS', components: 'P1 + P2 + P3' },
  { routeId: 'bpho-admissions-physics', subjectCode: 'bpho', subjectLabel: 'British Physics Olympiad', stage: 'Competition', components: 'Competition paper' },
  { routeId: 'uatuk-esat-admissions', subjectCode: 'esat', subjectLabel: 'ESAT', stage: 'Admissions', components: 'Maths + science modules' },
]
const subjects = [
  { code: '9702', label: 'Physics', short: '物理' },
  { code: 'bpho', label: 'BPhO', short: 'BPhO' },
  { code: 'esat', label: 'ESAT', short: 'ESAT' },
]
const fakeRequire = (name) => {
  if (name === '../../utils/page') return { deviceState: (value) => value, syncDevice: () => {} }
  if (name === '../../utils/inventory') return { fetchRouteInventory: async () => ({ topics: [] }) }
  if (name === '../../utils/stemCatalog') return {
    routesForSubjectStage: (code, stage) => routes.filter((route) => route.subjectCode === code && route.stage === stage),
    subjectsForCategory: (category) => category === 'competition' ? [subjects[1], subjects[2]] : category === 'ielts' ? [] : [subjects[0]],
    normalizeStemCategory: (category) => String(category || '').toLowerCase() === 'competition' ? 'competition' : 'alevel',
    stemCategoryProfile: (category) => String(category || '').toLowerCase() === 'competition' ? { id: 'competition', label: '竞赛 / 入学考试', family: 'competition', stages: ['Competition', 'Admissions'] } : { id: 'alevel', label: 'A-Level 学科', family: 'exam', stages: ['IGCSE', 'AS', 'A2'] },
    familyForCategoryStage: (category, stage) => String(category || '').toLowerCase() === 'competition' ? (String(stage || '').toLowerCase() === 'admissions' ? 'admissions' : 'competition') : 'exam',
  }
  if (name === '../../utils/ieltsCatalog') return {
    IELTS_FEATURE_GROUPS: [{ id: 'skills', label: '四项技能', detail: '', features: [{ id: 'listening', kind: 'native', nativePage: '/pages/ielts/listening' }] }],
    getIeltsFeature: (id) => id === 'listening' ? { id, kind: 'native', nativePage: '/pages/ielts/listening' } : null,
    ieltsWebUrl: () => 'https://ieltsist.com/?from=stemist#home',
  }
  throw new Error(`unexpected module ${name}`)
}
const wx = { getStorageSync: () => '', setStorageSync: () => {}, navigateTo: () => {} }
vm.runInNewContext(source, { Page: (config) => { pageConfig = config }, require: fakeRequire, wx, String, Number, Boolean, Object, Array, Date, encodeURIComponent })
const instance = { data: JSON.parse(JSON.stringify(pageConfig.data)), setData(update, callback) { Object.assign(this.data, update); if (callback) callback() } }
Object.assign(instance, pageConfig)
pageConfig.onLoad.call(instance, { category: 'competition' })
assert.equal(instance.data.activeCategory, 'competition')
assert.equal(instance.data.subjectCode, 'bpho')
assert.equal(instance.data.stage, 'Competition')
assert.equal(instance.data.routeId, 'bpho-admissions-physics')
pageConfig.chooseStage.call(instance, { currentTarget: { dataset: { stage: 'Admissions' } } })
assert.equal(instance.data.subjectCode, 'esat')
assert.equal(instance.data.family, 'admissions')
pageConfig.onLoad.call(instance, { category: 'ielts' })
assert.equal(instance.data.activeCategory, 'ielts')
assert.equal(instance.data.routeId, '')
assert.equal(instance.data.ieltsGroups.length, 1)
console.log('Practice entry category routing contract passed.')
