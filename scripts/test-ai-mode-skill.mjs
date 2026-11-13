import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cache = new Map()

function load(relative) {
  const normalized = relative.replace(/\\/g, '/').replace(/\.js$/, '')
  if (cache.has(normalized)) return cache.get(normalized)
  const filename = path.join(root, `${normalized}.js`)
  const module = { exports: {} }
  const localRequire = request => load(path.posix.normalize(path.posix.join(path.posix.dirname(normalized), request)))
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, require: localRequire, URLSearchParams, encodeURIComponent })
  cache.set(normalized, module.exports)
  return module.exports
}

const discover = load('skills/learning-navigator/apis/discoverLearningOptions')
const open = load('skills/learning-navigator/apis/openLearningDestination')

const stageChoice = await discover({ courseSystem: 'cambridge', subjectCode: '9702', task: 'topics' })
assert.equal(stageChoice.isError, false)
assert.equal(stageChoice.structuredContent.status, 'choose')
assert.deepEqual([...new Set(stageChoice.structuredContent.choices.map(item => item.stage))].sort(), ['A2', 'AS'])
assert.match(stageChoice.content[0].text, /选择阶段/)
assert.equal(typeof stageChoice.handoff, 'function')
const stageHandoff = stageChoice.handoff({ result: { structuredContent: stageChoice.structuredContent } })
assert.match(stageHandoff.query, /courseSystem=cambridge/)
assert.equal(stageHandoff.payload.status, 'choose')
assert.equal(Object.hasOwn(stageHandoff.payload, 'token'), false)

const routeChoice = await discover({ courseSystem: 'cambridge', subjectCode: '9709', stage: 'AS', task: 'papers' })
assert.equal(routeChoice.structuredContent.status, 'choose')
assert.equal(routeChoice.structuredContent.choices.length, 3)
assert.match(routeChoice.content[0].text, /课程路线/)

const exact = await open({ destinationId: 'cambridge-cie-9702-a2-physics-topics' })
assert.equal(exact.isError, false)
assert.equal(exact.structuredContent.status, 'ready')
assert.equal(exact.structuredContent.navigationPath, '/pages/stem/topics?routeId=cie-9702-a2-physics')
assert.equal(exact.structuredContent.navigationLabel, 'Physics 章节练习')
assert.doesNotMatch(exact.content[0].text, /\[[^\]]+\]\(|https?:\/\//)
const exactHandoff = exact.handoff({ result: { structuredContent: exact.structuredContent } })
assert.equal(exactHandoff.query, 'destinationId=cambridge-cie-9702-a2-physics-topics')
assert.deepEqual(Object.keys(exactHandoff.payload).sort(), ['destinationId', 'status'])
const tamperedHandoff = exact.handoff({ result: { structuredContent: { ...exact.structuredContent, destinationId: 'ielts-listening', navigationPath: '/pages/ielts/library?module=listening' } } })
assert.equal(tamperedHandoff.query, 'destinationId=cambridge-cie-9702-a2-physics-topics')
assert.deepEqual(JSON.parse(JSON.stringify(tamperedHandoff.payload)), { status: 'ready', destinationId: 'cambridge-cie-9702-a2-physics-topics' })

const mismatch = await open({ courseSystem: 'cambridge', routeId: 'cie-9702-a2-physics', subjectCode: '0580', task: 'papers' })
assert.equal(mismatch.isError, true)
assert.equal(mismatch.structuredContent, undefined)
assert.equal(mismatch.handoff, undefined)
assert.match(mismatch.content[0].text, /课程、阶段或路线/)

const forbidden = await open({ destinationId: 'tools-coach', token: 'secret', photo: 'data:image/jpeg;base64,AAAA', autoStart: true })
assert.equal(forbidden.isError, true)
assert.match(forbidden.content[0].text, /请求字段/)
const mixedBinding = await open({ destinationId: 'ielts-listening', courseSystem: 'cambridge', subjectCode: '9702' })
assert.equal(mixedBinding.isError, true)
assert.match(mixedBinding.content[0].text, /destinationId.*单独/i)

for (const result of [stageChoice, routeChoice, exact, mismatch, forbidden]) {
  const serialized = JSON.stringify(result.structuredContent || {})
  assert.doesNotMatch(serialized, /Bearer|data:image|session[_-]?key|cookie/i)
}

// WeChat's AI compiler warns for every returned field missing from outputSchema,
// including nested choice fields, even when the JSON Schema permits extras.
const apiSchemas = JSON.parse(fs.readFileSync(path.join(root, 'skills/learning-navigator/mcp.json'), 'utf8')).apis
function assertDeclaredOutput(value, schema, location) {
  assert.ok(schema, `${location}: schema must exist`)
  if (schema.type === 'object') {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${location}: expected object`)
    for (const [key, child] of Object.entries(value)) {
      assert.ok(Object.hasOwn(schema.properties || {}, key), `${location}.${key}: returned field is not declared`)
      assertDeclaredOutput(child, schema.properties[key], `${location}.${key}`)
    }
  } else if (schema.type === 'array') {
    assert.ok(Array.isArray(value), `${location}: expected array`)
    value.forEach((child, index) => assertDeclaredOutput(child, schema.items, `${location}[${index}]`))
  } else if (schema.type === 'string') {
    assert.equal(typeof value, 'string', `${location}: expected string`)
  } else {
    assert.fail(`${location}: unsupported test schema type ${schema.type}`)
  }
}

for (const [name, api, inputs] of [
  ['discoverLearningOptions', discover, [{}, { courseSystem: 'cambridge' }, { courseSystem: 'cambridge', subjectCode: '9702', task: 'topics' }, { courseSystem: 'cambridge', subjectCode: '9709', stage: 'AS', task: 'papers' }, { courseSystem: 'edexcel' }, { courseSystem: 'ielts', task: 'listening' }]],
  ['openLearningDestination', open, [{}, { courseSystem: 'cambridge' }, { courseSystem: 'cambridge', subjectCode: '9702', task: 'topics' }, { destinationId: 'cambridge-cie-9702-a2-physics-topics' }, { destinationId: 'ielts-listening' }, { courseSystem: 'tools', task: 'coach' }]],
]) {
  const schema = apiSchemas.find(item => item.name === name)?.outputSchema
  for (const input of inputs) {
    const result = await api(input)
    assert.equal(result.isError, false, `${name}: expected success for ${JSON.stringify(input)}`)
    assertDeclaredOutput(result.structuredContent, schema, `${name}.structuredContent`)
  }
}

const { REGISTRY } = load('skills/learning-navigator/data/registry.generated')
const openOutputSchema = apiSchemas.find(item => item.name === 'openLearningDestination').outputSchema
for (const destination of REGISTRY.destinations) {
  const result = await open({ destinationId: destination.id })
  assert.equal(result.isError, false, `destination should resolve: ${destination.id}`)
  assertDeclaredOutput(result.structuredContent, openOutputSchema, `destination[${destination.id}]`)
}

console.log(JSON.stringify({ status: 'passed', APIs: 2, declaredDestinations: REGISTRY.destinations.length, stageChoices: stageChoice.structuredContent.choices.length, routeChoices: routeChoice.structuredContent.choices.length }))
