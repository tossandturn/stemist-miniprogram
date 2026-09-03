import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const miniRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stemRoutePath = path.resolve(miniRoot, '..', 'alevel-learning-platform', 'src', 'data', 'routeRegistry.js')
if (!fs.existsSync(stemRoutePath)) {
  console.log('STEM route registry is outside this checkout; mirror check skipped.')
  process.exit(0)
}

const routeIdPattern = /routeId:\s*['"]([^'"]+)['"]/g
const sourceIds = [...fs.readFileSync(stemRoutePath, 'utf8').matchAll(routeIdPattern)].map((match) => match[1])
const miniIds = [...fs.readFileSync(path.join(miniRoot, 'utils', 'stemRoutes.js'), 'utf8').matchAll(routeIdPattern)].map((match) => match[1])
assert.deepEqual([...new Set(miniIds)].sort(), [...new Set(sourceIds)].sort(), 'Mini Program route mirror must match STEM route registry')
console.log(`STEM route mirror passed (${sourceIds.length} routes).`)
