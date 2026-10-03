import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'utils/inventory.js'), 'utf8')
const calls = []
const basePayload = { routeId: 'cie-9702-as-physics', syllabusVersion: '2025-2027', officialPaperCount: 46, officialPairedPaperCount: 46, indexedQuestionGroupCount: 147, verifiedQuestionGroupCount: 112, availableQuestionGroupCount: 112, topics: [{ id: 'physics-9702-topic-01', code: '1', name: 'Physical quantities and units', availableQuestionCount: 10, verifiedQuestionCount: 10, ready: true }] }
let responseFor = () => basePayload
const module = { exports: {} }
const fakeRequire = (name) => {
  if (name === './api') return {
    getJson: async (url) => {
      calls.push(url)
      return structuredClone(responseFor(url))
    },
  }
  throw new Error(`unexpected module ${name}`)
}
vm.runInNewContext(source, { module, exports: module.exports, require: fakeRequire, Promise, Error, String, Number, Boolean, Math, Array, Object, Map, Date, encodeURIComponent })
const { INVENTORY_CACHE_LIMIT, clearInventoryCache, fetchRouteInventory, normalizeInventory } = module.exports
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

const v2Payload = structuredClone(chapterPayload)
v2Payload.chapterStudy = { ...v2Payload.chapterStudy, catalogVersion: 'v2', foundationCatalog: 'v2' }
v2Payload.topics[0].chapterStudy = { ...v2Payload.topics[0].chapterStudy, available: 3, originalAvailable: 3 }
for (const value of Object.values(v2Payload.topics[0].componentCounts)) value.chapterStudy = { ...value.chapterStudy, available: 3, originalAvailable: 3 }
const v2 = normalizeInventory(v2Payload, v2Payload.routeId, 'v2')
assert.equal(v2.foundationCatalog, 'v2')
assert.equal(v2.chapterStudy.foundationCatalog, 'v2')
assert.equal(v2.topics[0].chapterStudy.originalAvailable, 3)
assert.throws(() => normalizeInventory(basePayload, basePayload.routeId, 'v2'), /章节学习|题库/, 'an opted-in client cannot silently accept a legacy inventory')
assert.throws(() => normalizeInventory(v2Payload, v2Payload.routeId, 'v3'), /版本|章节学习|题库/)
for (const edit of [
  value => { delete value.chapterStudy.foundationCatalog },
  value => { value.chapterStudy.catalogVersion = 'v1' },
  value => { value.topics[0].chapterStudy.originalAvailable = 2 },
]) { const value = structuredClone(v2Payload); edit(value); assert.throws(() => normalizeInventory(value, value.routeId, 'v2'), /章节学习|题库/) }

clearInventoryCache(); responseFor = () => v2Payload
const callStart = calls.length
const [firstV2, coalescedV2] = await Promise.all([fetchRouteInventory(v2Payload.routeId, 'v2'), fetchRouteInventory(v2Payload.routeId, 'v2')])
assert.equal(firstV2.foundationCatalog, 'v2'); assert.equal(coalescedV2.foundationCatalog, 'v2')
assert.equal(calls.length - callStart, 1, 'same route and capability should coalesce')
assert.match(calls.at(-1), /\?foundationCatalog=v2$/)
responseFor = () => chapterPayload
await fetchRouteInventory(chapterPayload.routeId, '')
assert.equal(calls.length - callStart, 2, 'v1 and v2 inventories must not share cache entries')

clearInventoryCache(); responseFor = url => ({ ...basePayload, routeId: decodeURIComponent(url.match(/routes\/([^/]+)\/syllabus-topics/)[1]) })
const boundedStart = calls.length
for (let i = 0; i < INVENTORY_CACHE_LIMIT + 2; i++) await fetchRouteInventory(`route-${i}`, '')
await fetchRouteInventory('route-0', '')
assert.equal(calls.length - boundedStart, INVENTORY_CACHE_LIMIT + 3, 'settled inventory cache must be bounded')
clearInventoryCache()
console.log('Server syllabus inventory contract passed.')
