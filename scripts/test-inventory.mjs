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
const { clearInventoryCache, fetchRouteInventory, normalizeInventory } = module.exports
const inventory = await fetchRouteInventory('cie-9702-as-physics')
const cached = await fetchRouteInventory('cie-9702-as-physics')
assert.equal(cached.routeId, inventory.routeId)
assert.equal(calls.length, 1, 'inventory should be cached during a short navigation loop')
assert.equal(inventory.availableQuestionGroupCount, 112)
assert.equal(inventory.topics[0].ready, true)
assert.equal(inventory.topicCount, 1)
assert.match(calls[0], /routes\/cie-9702-as-physics\/syllabus-topics/)
assert.throws(() => normalizeInventory({ routeId: 'other' }, 'cie-9702-as-physics'), /不匹配/)
const chapterPayload = {
  routeId: 'cie-9702-as-physics', paperComponents: [1, 2],
  practicePolicy: { schemaVersion: 'stem-topic-practice-policy-v1', minSourceGroups: 6, minReviewedGroups: 12, setSizes: [6, 10, 15],
    chapterStudy: { mode: 'chapter-study', minSourceGroups: 1, maxSourceGroups: 15, countPolicy: 'cap-to-available', formalProgressEligible: false, sourcePreferences: ['official-first', 'original-foundation-only'] } },
  chapterStudy: { mode: 'chapter-study', catalogVersion: 'v1', topicCount: 1, startableTopicCount: 1, gapTopicIds: ['physics-9702-topic-01'] },
  topics: [{ id: 'physics-9702-topic-01', code: '1', name: 'Physical quantities and units', questionIdsByComponent: {},
    chapterStudy: { mode: 'chapter-study', available: 1, officialAvailable: 0, originalAvailable: 1, startable: true, fallbackKind: 'original-foundation' },
    componentCounts: { 1: { chapterStudy: { mode: 'chapter-study', available: 1, officialAvailable: 0, originalAvailable: 1, startable: true, fallbackKind: 'original-foundation' } },
      2: { chapterStudy: { mode: 'chapter-study', available: 1, officialAvailable: 0, originalAvailable: 1, startable: true, fallbackKind: 'original-foundation' } } } }],
}
const chapter = normalizeInventory(chapterPayload, chapterPayload.routeId)
assert.equal(chapter.chapterStudy.catalogVersion, 'v1'); assert.equal(chapter.practicePolicy.chapterStudy.maxSourceGroups, 15)
assert.equal(chapter.topics[0].chapterStudy.fallbackKind, 'original-foundation'); assert.equal(chapter.topics[0].componentCounts[1].chapterStudy.available, 1)
for (const edit of [
  value => { value.practicePolicy.chapterStudy.formalProgressEligible = true },
  value => { value.topics[0].chapterStudy.available = 2 },
  value => { value.topics[0].chapterStudy.fallbackKind = 'official' },
  value => { value.chapterStudy.topicCount = 2 },
]) { const value = structuredClone(chapterPayload); edit(value); assert.throws(() => normalizeInventory(value, value.routeId), /章节学习|题库/) }
clearInventoryCache()
console.log('Server syllabus inventory contract passed.')
