import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'pages/papers/index.js'), 'utf8')
const paperSubjects = [
  { code: '9702', label: 'A-Level Physics' },
  { code: 'bpho', label: 'BPhO' },
  { code: 'esat', label: 'ESAT' },
]
let pageConfig
const fakeRequire = (name) => {
  if (name === '../../utils/page') return { deviceState: (value) => value, syncDevice: () => {} }
  if (name === '../../utils/paperCatalog') return { PAPER_SUBJECTS: paperSubjects, fetchPaperCatalog: async () => ({ items: [] }) }
  if (name === '../../utils/stemCatalog') return {
    normalizeStemCategory: (value) => String(value || '').toLowerCase() === 'competition' ? 'competition' : 'alevel',
    stemCategoryProfile: (value) => String(value || '').toLowerCase() === 'competition' ? { label: '竞赛 / 入学考试' } : { label: 'A-Level 学科' },
    subjectsForCategory: (value) => String(value || '').toLowerCase() === 'competition' ? [{ code: 'bpho' }, { code: 'esat' }] : [{ code: '9702' }],
    familyForCategoryStage: () => 'exam',
  }
  throw new Error(`unexpected module ${name}`)
}
vm.runInNewContext(source, { Page: (config) => { pageConfig = config }, require: fakeRequire, wx: {}, String, Number, Boolean, Set, Array, Object, Math, Date, encodeURIComponent })

function makeInstance() {
  const instance = { data: JSON.parse(JSON.stringify(pageConfig.data)), setData(update, callback) { Object.assign(this.data, update); if (callback) callback() } }
  Object.assign(instance, pageConfig)
  return instance
}

const competition = makeInstance()
pageConfig.onLoad.call(competition, { category: 'competition' })
assert.equal(competition.data.category, 'competition')
assert.equal(JSON.stringify(competition.data.subjects.map((item) => item.code)), JSON.stringify(['bpho', 'esat']))
assert.equal(JSON.stringify(competition.data.stageFilters.map((item) => item.id)), JSON.stringify(['all', 'competition', 'admissions']))

const alevel = makeInstance()
pageConfig.onLoad.call(alevel, { category: 'alevel' })
assert.equal(JSON.stringify(alevel.data.subjects.map((item) => item.code)), JSON.stringify(['9702']))
assert.equal(JSON.stringify(alevel.data.stageFilters.map((item) => item.id)), JSON.stringify(['all', 'igcse', 'as', 'a2']))
console.log('Past-paper entry scope contract passed.')
