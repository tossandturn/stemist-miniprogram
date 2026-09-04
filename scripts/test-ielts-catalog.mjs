import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'utils/ieltsCatalog.js'), 'utf8')
const module = { exports: {} }
vm.runInNewContext(source, {
  module,
  exports: module.exports,
  Object,
  String,
  Array,
  encodeURIComponent,
})
const { IELTS_FEATURES, IELTS_FEATURE_GROUPS, getIeltsFeature, ieltsWebUrl } = module.exports
const required = ['dashboard', 'coach', 'listening', 'reading', 'writing', 'speaking', 'same-test', 'random-exam', 'vocabulary', 'mine', 'subscription', 'full-workspace']
assert.equal(new Set(IELTS_FEATURES.map((feature) => feature.id)).size, required.length)
for (const id of required) {
  const feature = getIeltsFeature(id)
  assert.ok(feature, `IELTS feature ${id} must be mapped`)
  if (feature.nativePage) assert.match(feature.nativePage, /^\/pages\/(?:coach|ielts)\//)
  const url = ieltsWebUrl(id)
  if (feature.hash) {
    assert.match(url, /^https:\/\/ieltsist\.com\/\?from=stemist(?:&module=[^#]+)?#/, `${id} must have a safe IELTSist deep link`)
    assert.doesNotMatch(url, /token|secret|access_token/i)
  }
}
assert.equal(IELTS_FEATURE_GROUPS.length, 5)
assert.ok(IELTS_FEATURE_GROUPS.every((group) => group.features.length > 0))
assert.equal(ieltsWebUrl('not-a-feature'), '')

const productionHtmlPath = path.resolve(root, '..', 'ielts-trainer', 'public', 'index.html')
if (fs.existsSync(productionHtmlPath)) {
  const productionHtml = fs.readFileSync(productionHtmlPath, 'utf8')
  for (const view of ['home', 'single', 'writing-upload', 'bank', 'sequence', 'exam', 'vocabulary', 'mine', 'subscription']) {
    assert.match(productionHtml, new RegExp(`data-view="${view}"`), `IELTSist production view ${view} must remain reachable`)
  }
}
console.log(`IELTSist feature catalog passed (${IELTS_FEATURES.length} features, ${IELTS_FEATURE_GROUPS.length} groups).`)
