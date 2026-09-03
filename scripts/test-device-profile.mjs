import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'utils/device.js'), 'utf8')

function load(profile) {
  const module = { exports: {} }
  vm.runInNewContext(source, { module, exports: module.exports, wx: { getSystemInfoSync: () => profile } })
  return module.exports.readDeviceProfile()
}

assert.equal(load({ windowWidth: 390, screenWidth: 390, deviceType: 'phone', model: 'iPhone' }).isTablet, false)
assert.equal(load({ windowWidth: 844, screenWidth: 844, deviceType: 'phone', model: 'iPhone 15 landscape' }).isTablet, false)
assert.equal(load({ windowWidth: 820, screenWidth: 820, deviceType: 'tablet', model: 'iPad' }).isTablet, true)
assert.equal(load({ windowWidth: 1024, screenWidth: 1024, deviceType: 'unknown', model: 'desktop simulator' }).isTablet, true)
assert.equal(load({ windowWidth: 1280, screenWidth: 1280, deviceType: 'unknown', model: 'Pixel Tablet' }).isTablet, true)
assert.equal(load({ windowWidth: 1024, screenWidth: 1024, windowHeight: 768, deviceType: 'tablet', model: 'iPad' }).orientation, 'landscape')
assert.equal(load({ windowWidth: 768, screenWidth: 768, windowHeight: 1024, deviceType: 'tablet', model: 'iPad' }).orientation, 'portrait')
console.log('Phone/iPad device profile checks passed.')
