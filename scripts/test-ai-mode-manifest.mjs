import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { nativeAppManifest } from './helpers/native-app-manifest.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const bytes = relative => fs.readFileSync(path.join(root, relative)).length
const app = JSON.parse(read('app.json'))
const manifest = nativeAppManifest(app)
const projectConfig = JSON.parse(read('project.config.json'))
const versionParts = String(projectConfig.libVersion || '').split('.').map(Number)
assert.ok(versionParts.length === 3 && versionParts.every(Number.isInteger))
assert.ok(versionParts[0] > 3 || versionParts[0] === 3 && (versionParts[1] > 16 || versionParts[1] === 16 && versionParts[2] >= 2), 'WeChat AI Handoff requires base library 3.16.2 or newer')

assert.equal(app.lazyCodeLoading, 'requiredComponents')
assert.equal(app.agent.instruction, 'agent/AGENTS.md')
assert.equal(app.agent.pageMetadata, 'page-meta.json')
assert.deepEqual(app.agent.skills, [{
  name: 'learning-navigator',
  description: '按课程体系、学科、阶段和学习任务发现真实入口，并接力进入 STEMist 原生页面',
  path: '/skills/learning-navigator',
}])

const skillPackage = manifest.subPackages.find(item => item.root === 'skills')
assert.ok(skillPackage)
assert.equal(skillPackage.independent, true)
assert.deepEqual(skillPackage.pages, [])
const handoffPackage = manifest.subPackages.find(item => item.root === 'bundles/ai-entry')
assert.ok(handoffPackage)
assert.equal(handoffPackage.independent, false)
assert.deepEqual(handoffPackage.pages, ['index'])
assert.ok(manifest.allPages.includes('bundles/ai-entry/index'))

assert.ok(bytes('agent/AGENTS.md') <= 10_000)
assert.ok(bytes('skills/learning-navigator/SKILL.md') <= 16_000)
const mcp = JSON.parse(read('skills/learning-navigator/mcp.json'))
const compactForLimit = JSON.stringify(mcp, (key, value) => key === 'outputSchema' ? undefined : value)
assert.ok(Buffer.byteLength(compactForLimit, 'utf8') <= 24_000)
assert.deepEqual(mcp.apis.map(item => item.name), ['discoverLearningOptions', 'openLearningDestination'])
for(const api of mcp.apis)assert.deepEqual(api.inputSchema.properties.courseSystem.enum,['cambridge','edexcel','oxfordaqa','ap','ib','ielts','competition','tools'])
for (const api of mcp.apis) {
  assert.equal(api._meta.ui.pagePath, '/bundles/ai-entry/index')
  assert.equal(api.outputSchema.properties.navigationPath.format, 'page-link')
  assert.equal(api.outputSchema.properties.navigationPath['x-link-text-field'], 'navigationLabel')
}

const registrations = []
vm.runInNewContext(read('skills/learning-navigator/index.js'), {
  require(request) { return { api: request } },
  wx: { modelContext: { createSkill(skillPath) {
    assert.equal(skillPath, app.agent.skills[0].path)
    return { registerAPI(name, handler) { registrations.push({ name, handler }) } }
  } } },
})
assert.deepEqual(registrations.map(item => item.name), mcp.apis.map(item => item.name))

const pageMetadata = JSON.parse(read('page-meta.json'))
assert.ok(Array.isArray(pageMetadata.pages) && pageMetadata.pages.length >= 1)
for (const page of pageMetadata.pages) assert.ok(manifest.allPages.includes(page.path), `page metadata path registered: ${page.path}`)

const instruction = read('agent/AGENTS.md')
assert.match(instruction, /知识库/)
assert.match(instruction, /导航/)
assert.match(instruction, /不读取.*私有/)
assert.doesNotMatch(instruction, /包办|所有问题都调用|自动付款|自动提交/)

const source = [read('agent/AGENTS.md'), read('skills/learning-navigator/SKILL.md'), read('skills/learning-navigator/mcp.json')].join('\n')
assert.doesNotMatch(source, /-----BEGIN .*PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{24,}|Bearer\s+[A-Za-z0-9._-]+/)

console.log(JSON.stringify({ status: 'passed', skills: app.agent.skills.length, instructionBytes: bytes('agent/AGENTS.md'), skillBytes: bytes('skills/learning-navigator/SKILL.md'), mcpLimitBytes: Buffer.byteLength(compactForLimit, 'utf8') }))
