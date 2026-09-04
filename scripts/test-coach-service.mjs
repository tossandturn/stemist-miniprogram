import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'utils/coach.js'), 'utf8')
const calls = []
const module = { exports: {} }
const fakeApi = {
  askCoach: async (payload) => { calls.push({ endpoint: 'stem', ...payload }); return { mode: 'ai', providerStatus: 'connected', message: 'feedback' } },
  askIeltsCoach: async (payload) => { calls.push({ endpoint: 'ielts', ...payload }); return { mode: 'ai', providerStatus: 'connected', message: 'ielts feedback' } },
}
const fakeRequire = (name) => name === './api' ? fakeApi : (() => { throw new Error(`unexpected module ${name}`) })()
vm.runInNewContext(source, { module, exports: module.exports, require: fakeRequire, Promise, String, Array, Error, Object })
const { runCoach, normalizeCoachContext, coachAnswer, coachState, safeCoachWarning } = module.exports

assert.equal(normalizeCoachContext({ skill: 'reading' }).stage, 'practice')
assert.equal(normalizeCoachContext({}).source, 'stemist-miniprogram')
assert.equal(coachAnswer({ answer: 'a' }), 'a')
assert.equal(coachState({ mode: 'ai', providerStatus: 'connected' }).label, 'AI 已连接')
assert.equal(coachState({ mode: 'local', providerStatus: 'skipped' }).isConnected, false)
assert.equal(safeCoachWarning('provider failed at https://secret.example/status'), 'provider failed at [链接已隐藏]')
assert.equal(safeCoachWarning('api key sk-123'), '')
assert.equal(safeCoachWarning('try again later').length, 15)
await assert.rejects(() => runCoach({}), /请先输入内容/)
const result = await runCoach({ message: 'check this', context: { skill: 'reading' }, imageDataUrls: [] })
assert.equal(result.answer, 'feedback')
assert.equal(result.coachState.label, 'AI 已连接')
assert.deepEqual(JSON.parse(JSON.stringify(calls[0].context)), { skill: 'reading', stage: 'practice', source: 'stemist-miniprogram' })
const ieltsResult = await runCoach({ message: 'check my reading evidence', context: { product: 'IELTSist', skill: 'reading' } })
assert.equal(ieltsResult.answer, 'ielts feedback')
assert.equal(calls[1].endpoint, 'ielts')
console.log('AI Coach service contract passed.')
