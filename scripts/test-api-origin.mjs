import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const module = { exports: {} }
const source = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'utils/apiOrigin.js'), 'utf8')
vm.runInNewContext(source, { module, exports: module.exports, String })
const { DEFAULT_API_BASE, DEFAULT_IELTS_API_BASE, safeApiBase, safeIeltsApiBase } = module.exports
assert.equal(DEFAULT_API_BASE, 'https://stem.ieltsist.com')
assert.equal(DEFAULT_IELTS_API_BASE, 'https://ieltsist.com')
assert.equal(safeApiBase('https://stem.ieltsist.com/'), 'https://stem.ieltsist.com')
assert.equal(safeApiBase('http://127.0.0.1:5173/'), 'http://127.0.0.1:5173')
assert.equal(safeApiBase('https://evil.example'), '')
assert.equal(safeApiBase('https://stem.ieltsist.com.evil.example'), '')
assert.equal(safeApiBase('https://user@stem.ieltsist.com'), '')
assert.equal(safeIeltsApiBase('https://ieltsist.com/'), 'https://ieltsist.com')
assert.equal(safeIeltsApiBase('http://127.0.0.1:4321/'), 'http://127.0.0.1:4321')
assert.equal(safeIeltsApiBase('https://ieltsist.com.evil.example'), '')
console.log('Mini-program API origin allowlist passed.')
