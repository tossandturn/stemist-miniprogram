import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

let requests = 0
const fixture = {
      schemaVersion: 2,
      totals: { questionPapers: 2, pairedQuestionPapers: 1 },
      items: [
        { id: 'qp-1', subject: '9702', year: 2025, season: 'May', kind: 'qp', file: '9702_m25_qp_12.pdf', pairKey: '9702-m25-12', examProfile: { code: '9702/1', title: 'Multiple Choice', stages: ['as'], courseRouteIds: ['cie-9702-as-physics'] }, governance: { state: 'active' } },
        { id: 'qp-core', subject: '0625', year: 2025, season: 'May', kind: 'qp', file: '0625_m25_qp_11.pdf', examProfile: { code: '0625/1', title: 'Core', stages: ['core'], courseRouteIds: ['cie-0625-igcse-physics'] }, governance: { state: 'active' } },
        { id: 'qp-bpho', subject: 'bpho', year: 2024, season: 'Nov', kind: 'qp', file: 'bpho-2024.pdf', examProfile: { code: 'bpho/2024', title: 'Round 1', stages: ['r1'], courseRouteIds: ['bpho-admissions-physics'] }, governance: { state: 'active' } },
        { id: 'ms-1', subject: '9702', year: 2025, season: 'May', kind: 'ms', file: '9702_m25_ms_12.pdf', governance: { state: 'active' } },
        { id: 'withdrawn', subject: '9702', year: 2024, season: 'May', kind: 'qp', file: 'withdrawn.pdf', governance: { state: 'withdrawn' } },
      ],
}
const module = { exports: {} }
const source = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'utils/paperCatalog.js'), 'utf8')
vm.runInNewContext(source, {
  module,
  exports: module.exports,
  Map,
  Promise,
  Number,
  String,
  Boolean,
  Array,
  Error,
  encodeURIComponent,
  require(name) {
    assert.equal(name, './api')
    return { getJson: async () => { requests += 1; return fixture } }
  },
})
const { PAPER_SUBJECTS, canonicalStages, fetchPaperCatalog } = module.exports
assert.ok(PAPER_SUBJECTS.some((item) => item.code === '0606'))
assert.ok(PAPER_SUBJECTS.some((item) => item.code === '9231'))
assert.equal(JSON.stringify(canonicalStages('0625', ['core'])), JSON.stringify(['igcse']))
assert.equal(JSON.stringify(canonicalStages('bpho', ['r1'])), JSON.stringify(['competition']))
assert.equal(JSON.stringify(canonicalStages('esat', ['prep'])), JSON.stringify(['admissions']))
const first = await fetchPaperCatalog('9702')
const second = await fetchPaperCatalog('9702')
assert.equal(requests, 1, 'paper catalog should be cached within a mini-program session')
assert.equal(first.items.length, 1)
assert.equal(first.items[0].pairKey, '9702-m25-12')
assert.equal(first.items[0].paperNumber, '9702/1')
assert.equal(second.items[0].id, 'qp-1')
await assert.rejects(() => fetchPaperCatalog('not-a-subject'), /暂不支持/)
console.log('Paper catalog normalization and session cache passed.')
