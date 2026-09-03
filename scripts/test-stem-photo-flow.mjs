import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const routes = [
  { routeId: 'cie-9702-as-physics', subjectCode: '9702', subjectLabel: 'Physics', stage: 'AS', components: 'P1 + P2 + P3' },
  { routeId: 'cie-9702-a2-physics', subjectCode: '9702', subjectLabel: 'Physics', stage: 'A2', components: 'P4 + P5' },
]
let pageConfig
const storage = {}
let navigatedUrl = ''
const wx = {
  getSystemInfoSync: () => ({ windowWidth: 390, deviceType: 'phone', model: 'iPhone' }),
  setStorageSync: (key, value) => { storage[key] = value },
  chooseMedia: (options) => options.success({ tempFiles: [{ tempFilePath: '/tmp/photo.jpg' }] }),
  navigateTo: ({ url }) => { navigatedUrl = url },
}
const pageHelpers = { deviceState: (value) => value, syncDevice: () => {} }
const fakeRequire = (name) => name === '../../utils/page' ? pageHelpers : name === '../../utils/stemRoutes' ? { routesForSubjectStage: (code, stage) => routes.filter((route) => route.subjectCode === code && route.stage === stage) } : name === '../../utils/inventory' ? { fetchRouteInventory: async () => null } : (() => { throw new Error(`unexpected module ${name}`) })()
const source = fs.readFileSync(path.join(root, 'pages/stem/capture.js'), 'utf8')
vm.runInNewContext(source, { Page: (config) => { pageConfig = config }, require: fakeRequire, wx, Date, String, Number, Boolean, Math, encodeURIComponent })

const instance = { data: JSON.parse(JSON.stringify(pageConfig.data)), setData(update) { Object.assign(this.data, update) } }
Object.assign(instance, pageConfig)
pageConfig.onLoad.call(instance, {})
pageConfig.chooseStage.call(instance, { currentTarget: { dataset: { stage: 'IGCSE' } } })
assert.equal(instance.data.canCapture, false)
pageConfig.chooseStage.call(instance, { currentTarget: { dataset: { stage: 'AS' } } })
assert.equal(instance.data.canCapture, true)
pageConfig.takePhoto.call(instance)
assert.equal(storage.stemistCropReturn.context.routeId, 'cie-9702-as-physics')
assert.equal(storage.stemistCropReturn.context.subjectCode, '9702')
assert.match(navigatedUrl, /^\/pages\/crop\/crop\?src=/)
assert.equal(instance.data.busy, true)
pageConfig.onShow.call(instance)
assert.equal(instance.data.busy, false)
console.log('STEM photo route flow checks passed.')
