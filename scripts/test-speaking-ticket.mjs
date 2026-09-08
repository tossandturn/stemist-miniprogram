import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'

const calls = []
const future = new Date(Date.now() + 15_000).toISOString()
const runtime = miniRuntime({ modules: {
  'utils/ieltsLearning': {
    requestIeltsLearning: async (path, body, options) => {
      calls.push({ path, body, options })
      return { protocol: 'ielts-realtime-ticket-v1', purpose: 'qwen-speaking', ticket: 'a'.repeat(43), expiresAt: future }
    },
  },
} })
const service = runtime.load('utils/speakingTicket')
assert.equal(await service.issueSpeakingTicket(), 'a'.repeat(43))
assert.equal(calls[0].path, '/api/speaking/realtime-ticket')
assert.equal(JSON.stringify(calls[0].body), '{}')
assert.equal(calls[0].options.method, 'POST')
assert.equal(calls[0].options.timeout, 8000)

for (const response of [
  null,
  { protocol: 'wrong', purpose: 'qwen-speaking', ticket: 'a'.repeat(43), expiresAt: future },
  { protocol: 'ielts-realtime-ticket-v1', purpose: 'wrong', ticket: 'a'.repeat(43), expiresAt: future },
  { protocol: 'ielts-realtime-ticket-v1', purpose: 'qwen-speaking', ticket: 'short', expiresAt: future },
  { protocol: 'ielts-realtime-ticket-v1', purpose: 'qwen-speaking', ticket: 'a'.repeat(43), expiresAt: new Date(Date.now() - 1).toISOString() },
]) {
  const invalid = miniRuntime({ modules: { 'utils/ieltsLearning': { requestIeltsLearning: async () => response } } }).load('utils/speakingTicket')
  await assert.rejects(() => invalid.issueSpeakingTicket(), /授权未完成/)
}

console.log('Native speaking ticket: authenticated POST contract and malformed/expired response rejection passed.')
