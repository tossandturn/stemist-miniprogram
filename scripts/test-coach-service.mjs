import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'utils/coach.js'), 'utf8')
const calls = []
const module = { exports: {} }
const fakeApi = { askCoach: async (payload) => { calls.push(payload); return { message: 'feedback' } } }
const fakeRequire = (name) => name === './api' ? fakeApi : (() => { throw new Error(`unexpected module ${name}`) })()
vm.runInNewContext(source, { module, exports: module.exports, require: fakeRequire, Promise, String, Array, Error, Object })
const { runCoach, normalizeCoachContext, coachAnswer } = module.exports

assert.equal(normalizeCoachContext({ skill: 'reading' }).stage, 'practice')
assert.equal(normalizeCoachContext({}).source, 'stemist-miniprogram')
assert.equal(coachAnswer({ answer: 'a' }), 'a')
await assert.rejects(() => runCoach({}), /请先输入内容/)
const result = await runCoach({ message: 'check this', context: { skill: 'reading' }, imageDataUrls: [] })
assert.equal(result.answer, 'feedback')
assert.deepEqual(JSON.parse(JSON.stringify(calls[0].context)), { skill: 'reading', stage: 'practice', source: 'stemist-miniprogram' })
console.log('AI Coach service contract passed.')
