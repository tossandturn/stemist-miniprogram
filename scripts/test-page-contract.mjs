import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const app = JSON.parse(read('app.json'))
const componentFiles = new Set(fs.readdirSync(path.join(root, 'components')))

for (const page of app.pages) {
  for (const extension of ['.js', '.wxml', '.wxss']) assert.equal(fs.existsSync(path.join(root, `${page}${extension}`)), true, `${page}${extension} is required`)
  const jsonPath = path.join(root, `${page}.json`)
  if (!fs.existsSync(jsonPath)) continue
  const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  if (config.usingComponents) assert.equal(typeof config.navigationBarTitleText, 'string', `${page} needs a meaningful native navigation title`)
  for (const [tag, componentPath] of Object.entries(config.usingComponents || {})) {
    const expectedDirectory = path.basename(String(componentPath).replace(/\/index$/, ''))
    assert.equal(componentFiles.has(expectedDirectory), true, `${page} references missing component ${tag}`)
    assert.match(read(`${page}.wxml`), new RegExp(`<${tag}(?:\\s|>)`), `${page} must use ${tag}`)
  }
}

assert.equal(app.pageOrientation, 'auto')
assert.match(read('.gitignore'), /project\.private\.config\.json/)
console.log(`Page/component contract passed for ${app.pages.length} pages.`)
