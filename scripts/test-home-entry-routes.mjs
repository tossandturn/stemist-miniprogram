import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const source = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const targets = [...source.matchAll(/url:\s*'([^']+)'/g)].map((match) => match[1].split('?')[0].replace(/^\//, ''))
for (const target of ['pages/practice/index', 'pages/calculator/index']) assert.ok(app.pages.includes(target), `home target ${target} must be registered`)
assert.equal((source.match(/id\s*:\s*'(?:alevel|ap|ib|ielts|competition|calculator)'/g) || []).length, 6, 'home must expose exactly six primary entry IDs')
assert.match(source,/id\s*:\s*'ap'[\s\S]*url\s*:\s*'\/bundles\/curricula\/index\?board=ap'/)
assert.match(source,/id\s*:\s*'ib'[\s\S]*url\s*:\s*'\/bundles\/curricula\/index\?board=ib'/)
for (const target of targets.filter((value) => value.startsWith('pages/'))) assert.ok(app.pages.includes(target), `home URL points to missing page ${target}`)
const curricula=app.subPackages?.find(item=>item.root==='bundles/curricula')
assert.ok(curricula?.pages?.includes('index'),'AP/IB home target must be registered in the curricula subpackage')
console.log('Home six-entry route contract passed.')
