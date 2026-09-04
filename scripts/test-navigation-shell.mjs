import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const app = JSON.parse(read('app.json'))
const nav = read('components/app-nav/index.wxml')
const index = read('pages/index/index.js')
const capture = read('pages/stem/capture.js')
const speaking = read('pages/ielts/speaking.js')
const corePages = [
  ['pages/practice/index', 'practice'],
  ['pages/coach/index', 'coach'],
  ['pages/progress/index', 'progress'],
  ['pages/notebook/index', 'progress'],
  ['pages/stem/coach', 'coach'],
  ['pages/ielts/listening', 'practice'],
  ['pages/ielts/reading', 'practice'],
  ['pages/ielts/writing', 'practice'],
  ['pages/ielts/speaking', 'practice'],
  ['pages/account/auth', 'account'],
]

for (const [page, active] of corePages) {
  const source = read(`${page}.wxml`)
  assert.match(source, /<app-nav\s/)
  assert.match(source, new RegExp(`active="${active}"`), `${page} must declare its canonical nav destination`)
}

assert.equal(app.pages.filter((page) => /pages\/(practice|coach|progress|notebook)\/index$/.test(page)).length, 4)
assert.match(read('pages/index/index.js'), /A-Level 学科/)
assert.match(read('pages/index/index.js'), /Casio 计算器/)
assert.match(read('pages/index/index.js'), /ensureWeChatSession/)
assert.match(read('pages/calculator/index.js'), /evaluateExpression/)
assert.equal((nav.match(/url="\/pages\//g) || []).length, 10, 'phone and tablet nav must expose the same five destinations')
for (const label of ['Today', 'Practice', 'AI Coach', 'Progress', 'Account']) assert.match(nav, new RegExp(`>${label}<`))
assert.doesNotMatch(index, /showActionSheet/, 'Today must navigate to real Practice/Coach pages instead of an ambiguous action sheet')
assert.match(index, /openPractice/)
assert.match(capture, /pages\/stem\/camera/)
assert.match(read('pages/stem/camera.js'), /chooseMedia/)
assert.match(read('pages/stem/camera.js'), /sourceType:\s*\['camera'\]/)
assert.match(speaking, /ieltsWebUrl\('speaking'/)
assert.match(read('components/coach-panel/index.wxml'), /登录 \/ 注册后重试/)
assert.match(read('components/text-practice/index.wxml'), /登录 \/ 注册后重试/)
assert.match(read('utils/session.js'), /if \(!preserveDrafts\)/)
assert.match(read('pages/progress/index.js'), /getJson\('\/api\/stem\/attempts'/)
assert.match(read('pages/notebook/index.js'), /requestJson\(`\/api\/stem\/notebook\/notes/)
assert.doesNotMatch(read('pages/index/index.wxml') + read('app.wxss'), /(?:⚡|◉|▤|✎|◌|⌁|✦|⌂|◈)/)

console.log('Unified mini-program navigation shell contract passed.')
