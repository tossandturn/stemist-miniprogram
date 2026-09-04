import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const routes = [
  { routeId: 'cie-9702-as-physics', subjectCode: '9702', subjectLabel: 'Physics', stage: 'AS', components: 'P1 + P2 + P3' },
  { routeId: 'cie-9702-a2-physics', subjectCode: '9702', subjectLabel: 'Physics', stage: 'A2', components: 'P4 + P5' },
  { routeId: 'cie-9709-as-p1-p5', subjectCode: '9709', subjectLabel: 'Mathematics', stage: 'AS', components: 'P1 + S1' },
]
let pageConfig
const storage = {}
let navigatedUrl = ''
const wx = {
  getSystemInfoSync: () => ({ windowWidth: 390, deviceType: 'phone', model: 'iPhone' }),
  getStorageSync: (key) => storage[key],
  removeStorageSync: (key) => { delete storage[key] },
  setStorageSync: (key, value) => { storage[key] = value },
  navigateTo: ({ url }) => { navigatedUrl = url },
}
const pageHelpers = { deviceState: (value) => value, syncDevice: () => {} }
const stemCatalog = {
  STEM_SUBJECTS: [{ code: '9702', label: 'Physics', short: '物理' }, { code: '9709', label: 'Mathematics', short: '数学' }],
  STEM_STAGES: ['IGCSE', 'AS', 'A2', 'Competition', 'Admissions'],
  routesForSubjectStage: (code, stage) => routes.filter((route) => route.subjectCode === code && route.stage === stage),
  subjectByCode: (code) => stemCatalog.STEM_SUBJECTS.find((subject) => subject.code === String(code || '')) || null,
}
const fakeRequire = (name) => name === '../../utils/page' ? pageHelpers : name === '../../utils/stemCatalog' ? stemCatalog : name === '../../utils/stemRoutes' ? { routesForSubjectStage: stemCatalog.routesForSubjectStage, routeById: (id) => routes.find((route) => route.routeId === id) || null } : name === '../../utils/inventory' ? { fetchRouteInventory: async () => null } : (() => { throw new Error(`unexpected module ${name}`) })()
const source = fs.readFileSync(path.join(root, 'pages/stem/capture.js'), 'utf8')
vm.runInNewContext(source, { Page: (config) => { pageConfig = config }, require: fakeRequire, wx, Date, String, Number, Boolean, Math, encodeURIComponent })

const instance = { data: JSON.parse(JSON.stringify(pageConfig.data)), setData(update, callback) { Object.assign(this.data, update); if (callback) callback() } }
Object.assign(instance, pageConfig)
pageConfig.onLoad.call(instance, {})
pageConfig.chooseStage.call(instance, { currentTarget: { dataset: { stage: 'IGCSE' } } })
assert.equal(instance.data.canCapture, false)
pageConfig.chooseStage.call(instance, { currentTarget: { dataset: { stage: 'AS' } } })
assert.equal(instance.data.canCapture, true)
pageConfig.takePhoto.call(instance)
assert.equal(storage.stemistCameraReturn.context.routeId, 'cie-9702-as-physics')
assert.equal(storage.stemistCameraReturn.context.subjectCode, '9702')
assert.equal(navigatedUrl, '/pages/stem/camera')
assert.equal(instance.data.busy, true)
pageConfig.onShow.call(instance)
assert.equal(instance.data.busy, false)

storage.stemistRetakeContext = { subjectCode: '9709', stage: 'AS', routeId: 'cie-9709-as-p1-p5' }
const retakeInstance = { data: JSON.parse(JSON.stringify(pageConfig.data)), setData(update, callback) { Object.assign(this.data, update); if (callback) callback() } }
Object.assign(retakeInstance, pageConfig)
pageConfig.onLoad.call(retakeInstance, {})
assert.equal(retakeInstance.data.subjectCode, '9709')
assert.equal(retakeInstance.data.routeId, 'cie-9709-as-p1-p5')
assert.equal(storage.stemistRetakeContext, undefined)
console.log('STEM photo route flow checks passed.')
