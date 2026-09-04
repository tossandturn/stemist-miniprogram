import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'pages/stem/camera.js'), 'utf8')
let pageConfig
const storage = { stemistCameraReturn: { route: 'stem', context: { category: 'alevel', family: 'exam', subjectCode: '9702', routeId: 'cie-9702-as-physics', stage: 'AS' } } }
let navigated = ''
let chosenSource = ''
const wx = {
  getSystemInfoSync: () => ({ windowWidth: 390, deviceType: 'phone', model: 'iPhone' }),
  getStorageSync: (key) => storage[key],
  removeStorageSync: (key) => { delete storage[key] },
  setStorageSync: (key, value) => { storage[key] = value },
  createCameraContext: () => null,
  chooseMedia: (options) => { chosenSource = options.sourceType[0]; options.success({ tempFiles: [{ tempFilePath: '/tmp/camera.jpg' }] }) },
  navigateTo: ({ url }) => { navigated = url },
  navigateBack: () => {},
}
const fakeRequire = (name) => name === '../../utils/page' ? { deviceState: (value) => value, syncDevice: () => {} } : (() => { throw new Error(`unexpected module ${name}`) })()
vm.runInNewContext(source, { Page: (config) => { pageConfig = config }, require: fakeRequire, wx, String, Number, Boolean, Object, Array, Math, encodeURIComponent, Date, Promise })
const instance = { data: JSON.parse(JSON.stringify(pageConfig.data)), setData(update) { Object.assign(this.data, update) } }
Object.assign(instance, pageConfig)
pageConfig.onLoad.call(instance)
assert.equal(instance.data.category, 'alevel')
assert.equal(instance.data.family, 'exam')
pageConfig.onReady.call(instance)
pageConfig.takePhoto.call(instance)
assert.equal(chosenSource, 'camera', 'fallback must be camera-only')
assert.match(navigated, /^\/pages\/crop\/crop\?src=/)
assert.equal(storage.stemistCropReturn.context.routeId, 'cie-9702-as-physics')
console.log('Native camera page and camera-only fallback contract passed.')
