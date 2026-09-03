import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const module = { exports: {} }
vm.runInNewContext(fs.readFileSync(path.join(root, 'utils/crop.js'), 'utf8'), { module, exports: module.exports, Math, Error })
const { computeCropRect, resizedCropSize } = module.exports

const landscape = computeCropRect({
  viewport: { left: 0, top: 0, width: 600, height: 400 },
  box: { left: 100, top: 50, width: 400, height: 300 },
  imageWidth: 1200,
  imageHeight: 800,
})
assert.deepEqual(JSON.parse(JSON.stringify(landscape)), { sx: 200, sy: 100, sw: 800, sh: 600, sourceScale: 0.5 })

const portrait = computeCropRect({
  viewport: { left: 40, top: 20, width: 400, height: 600 },
  box: { left: 40, top: 20, width: 400, height: 600 },
  imageWidth: 800,
  imageHeight: 1200,
})
assert.equal(portrait.sx, 0)
assert.equal(portrait.sy, 0)
assert.equal(portrait.sw, 800)
assert.equal(portrait.sh, 1200)

const bounded = computeCropRect({
  viewport: { left: 0, top: 0, width: 100, height: 100 },
  box: { left: -50, top: -50, width: 300, height: 300 },
  imageWidth: 100,
  imageHeight: 100,
})
assert.equal(bounded.sx, 0)
assert.equal(bounded.sy, 0)
assert.equal(bounded.sw, 100)
assert.equal(bounded.sh, 100)
assert.deepEqual(JSON.parse(JSON.stringify(resizedCropSize(4000, 1000))), { width: 1600, height: 400 })
assert.deepEqual(JSON.parse(JSON.stringify(resizedCropSize(800, 600))), { width: 800, height: 600 })
console.log('Crop coordinate and aspect-ratio checks passed.')
