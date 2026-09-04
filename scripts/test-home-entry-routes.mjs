import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const source = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const targets = [...source.matchAll(/url:\s*'([^']+)'/g)].map((match) => match[1].split('?')[0].replace(/^\//, ''))
for (const target of ['pages/practice/index', 'pages/calculator/index']) assert.ok(app.pages.includes(target), `home target ${target} must be registered`)
assert.equal((source.match(/id: '(?:alevel|ielts|competition|calculator)'/g) || []).length, 4, 'home must expose exactly four primary entry IDs')
for (const target of targets.filter((value) => value.startsWith('pages/'))) assert.ok(app.pages.includes(target), `home URL points to missing page ${target}`)
console.log('Home four-entry route contract passed.')
