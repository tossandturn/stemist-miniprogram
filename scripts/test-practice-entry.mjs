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
]
const subjects = [
  { code: '9702', label: 'Physics', short: '物理' },
  { code: 'bpho', label: 'BPhO', short: 'BPhO' },
]
const fakeRequire = (name) => {
  if (name === '../../utils/page') return { deviceState: (value) => value, syncDevice: () => {} }
  if (name === '../../utils/inventory') return { fetchRouteInventory: async () => ({ topics: [] }) }
  if (name === '../../utils/stemCatalog') return {
    routesForSubjectStage: (code, stage) => routes.filter((route) => route.subjectCode === code && route.stage === stage),
    subjectsForCategory: (category) => category === 'competition' ? [subjects[1]] : category === 'ielts' ? [] : [subjects[0]],
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
pageConfig.onLoad.call(instance, { category: 'ielts' })
assert.equal(instance.data.activeCategory, 'ielts')
assert.equal(instance.data.routeId, '')
console.log('Practice entry category routing contract passed.')
