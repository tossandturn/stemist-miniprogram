import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'utils/inventory.js'), 'utf8')
const calls = []
const module = { exports: {} }
const fakeRequire = (name) => {
  if (name === './api') return {
    getJson: async (url) => {
      calls.push(url)
      return { routeId: 'cie-9702-as-physics', syllabusVersion: '2025-2027', officialPaperCount: 46, officialPairedPaperCount: 46, indexedQuestionGroupCount: 147, verifiedQuestionGroupCount: 112, availableQuestionGroupCount: 112, topics: [{ id: 'physics-9702-topic-01', code: '1', name: 'Physical quantities and units', availableQuestionCount: 10, verifiedQuestionCount: 10, ready: true }] }
    },
  }
  throw new Error(`unexpected module ${name}`)
}
vm.runInNewContext(source, { module, exports: module.exports, require: fakeRequire, Promise, Error, String, Number, Boolean, Math, Array, Object, encodeURIComponent })
const { fetchRouteInventory, normalizeInventory } = module.exports
const inventory = await fetchRouteInventory('cie-9702-as-physics')
assert.equal(inventory.availableQuestionGroupCount, 112)
assert.equal(inventory.topics[0].ready, true)
assert.equal(inventory.topicCount, 1)
assert.match(calls[0], /routes\/cie-9702-as-physics\/syllabus-topics/)
assert.throws(() => normalizeInventory({ routeId: 'other' }, 'cie-9702-as-physics'), /不匹配/)
console.log('Server syllabus inventory contract passed.')
