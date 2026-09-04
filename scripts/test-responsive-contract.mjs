import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const app = JSON.parse(read('app.json'))
const appCss = read('app.wxss')
const navCss = read('components/app-nav/index.wxss')
const fabCss = read('components/ai-fab/index.wxss')
const calculatorCss = read('pages/calculator/index.wxss')
const practiceCss = read('pages/practice/index.wxss')
const papersCss = read('pages/papers/index.wxss')

for (const page of app.pages) {
  const source = read(`${page}.wxml`)
  assert.match(source, /class="[^"]*\bpage\b[^"]*\{\{deviceClass\}\}[^"]*\{\{orientation\}\}/, `${page} must expose device and orientation classes`)
}

assert.match(navCss, /\.app-nav-phone\s*\{[^}]*position:\s*fixed/s)
assert.match(fabCss, /top:\s*calc\(18rpx \+ env\(safe-area-inset-top\)\)/)
assert.match(navCss, /grid-template-columns:\s*repeat\(5/)
assert.match(navCss, /\.app-nav-tablet\s*\{[^}]*grid-template-columns:\s*repeat\(5/s)
assert.match(navCss, /\.app-nav-phone \.app-nav-item\s*\{[^}]*min-height:\s*88rpx/s)
assert.match(navCss, /\.app-nav-tablet \.app-nav-item\s*\{[^}]*min-height:\s*48px/s)
assert.match(appCss, /\.page\.device-phone\s*\{[^}]*padding:[^}]*154rpx/s)
assert.match(appCss, /\.page\.device-tablet\s*\{[^}]*padding:\s*32px 48px/s)
assert.match(appCss, /\.page\.device-tablet\.portrait \.workspace-grid\s*\{\s*display:\s*block/)
assert.match(appCss, /\.page\.device-phone \.workspace-grid\s*\{\s*display:\s*block/)
assert.match(appCss, /\.page\.device-tablet \.workspace-grid\s*\{[^}]*grid-template-columns/s)
assert.match(calculatorCss, /\.calc-key\s*\{[^}]*min-height:\s*88rpx/s)
assert.match(calculatorCss, /@media \(min-width: 768px\)/)
assert.match(practiceCss, /\.ielts-feature-grid\s*\{/)
assert.match(practiceCss, /\.page\.device-phone \.ielts-feature-card\s*\{[^}]*min-height/s)
assert.match(papersCss, /\.entry-scope\s*\{/)
assert.doesNotMatch(appCss, /\.bottom-nav|\.tablet-nav/, 'legacy duplicated navigation CSS must be removed')
assert.doesNotMatch(navCss + appCss, /overflow-x:\s*(?:scroll|auto)/, 'top-level layout must not introduce horizontal page scrolling')

console.log(`Responsive phone/iPad contract passed for ${app.pages.length} pages.`)
