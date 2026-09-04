import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const miniRoot = path.resolve(import.meta.dirname, '..')
const siblingRoot = path.resolve(miniRoot, '..', 'alevel-learning-platform', 'public', 'data', 'papers')
if (!fs.existsSync(siblingRoot)) {
  console.log('Local STEM paper catalogs are outside this checkout; fixture audit skipped.')
  process.exit(0)
}
const source = fs.readFileSync(path.join(miniRoot, 'utils/paperCatalog.js'), 'utf8')
const module = { exports: {} }
vm.runInNewContext(source, {
  module,
  exports: module.exports,
  Map,
  Set,
  Promise,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Error,
  encodeURIComponent,
  require: (name) => { assert.equal(name, './api'); return { getJson: async () => ({}) } },
})
const { PAPER_SUBJECTS, isQuestionPaper, normalizePaperItem } = module.exports
const expected = new Map(PAPER_SUBJECTS.map((item) => [item.code, new Set()]))
for (const [code] of expected) {
  const file = path.join(siblingRoot, `${code}.json`)
  assert.ok(fs.existsSync(file), `missing local paper catalog ${code}.json`)
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'))
  const items = payload.items.map(normalizePaperItem).filter((item) => item.subject === code && isQuestionPaper(item))
  assert.ok(items.length > 0, `${code} must expose at least one active question paper`)
  for (const item of items) for (const stage of item.stages) expected.get(code).add(stage)
}
for (const [code, stages] of expected) {
  const requires = ['0580', '0606', '0610', '0625'].includes(code) ? ['igcse'] : ['9231', '9700', '9701', '9702', '9708', '9709'].includes(code) ? ['as', 'a2'] : ['amc12', 'bpho'].includes(code) ? ['competition'] : ['admissions']
  for (const stage of requires) assert.ok(stages.has(stage), `${code} must map at least one paper to ${stage}`)
}
console.log(`Local paper catalog fixture audit passed for ${expected.size} subjects.`)
