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

console.log(JSON.stringify({ status: 'passed', APIs: 2, stageChoices: stageChoice.structuredContent.choices.length, routeChoices: routeChoice.structuredContent.choices.length }))
