import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'utils/stemCatalog.js'), 'utf8')
const routes = [
  { routeId: 'cie-9702-as-physics', subjectCode: '9702', stage: 'AS' },
  { routeId: 'cie-0606-igcse-additional-mathematics', subjectCode: '0606', stage: 'IGCSE' },
  { routeId: 'bpho-admissions-physics', subjectCode: 'bpho', stage: 'Competition' },
  { routeId: 'uatuk-esat-admissions', subjectCode: 'esat', stage: 'Admissions' },
]
const module = { exports: {} }
vm.runInNewContext(source, {
  module,
  exports: module.exports,
  Object,
  String,
  Array,
  Set,
  require: (name) => {
    assert.equal(name, './stemRoutes')
    return { routesForSubjectStage: (subject, stage) => routes.filter((route) => route.subjectCode === subject && route.stage === stage) }
  },
})
const { STEM_ENTRY_CATEGORIES, familyForCategoryStage, STEM_CATEGORY_PROFILES, subjectsForCategory, routesForSubjectStage } = module.exports
assert.ok(STEM_ENTRY_CATEGORIES.alevel.includes('0606'))
assert.ok(STEM_ENTRY_CATEGORIES.competition.includes('esat'))
assert.equal(subjectsForCategory('alevel').some((item) => item.code === '0606'), true)
assert.equal(subjectsForCategory('competition').some((item) => item.code === 'bpho'), true)
assert.equal(routesForSubjectStage('bpho', 'Competition')[0].routeId, 'bpho-admissions-physics')
assert.equal(STEM_CATEGORY_PROFILES.alevel.family, 'exam')
assert.equal(familyForCategoryStage('competition', 'Admissions'), 'admissions')
console.log('STEM category and route catalog contract passed.')
