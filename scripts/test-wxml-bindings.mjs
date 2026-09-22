import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { miniRuntime } from './helpers/mini-runtime.mjs'
import {expandedWxml} from './helpers/wxml-source.mjs'
import {nativeAppManifest} from './helpers/native-app-manifest.mjs'

const root = path.resolve(import.meta.dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const app = JSON.parse(read('app.json'))
const registered = nativeAppManifest(app),registeredPages=new Set(registered.allPages)
const runtime = miniRuntime()

function handlerNames(wxml) {
  const names = new Set()
  const pattern = /\b(?:bind|catch)(?::|)(?:tap|input|change|confirm|load|error|scale|action|submit|retry|account|clear|focus|blur|keyboardheightchange)\s*=\s*"([A-Za-z_$][\w$]*)"/g
  for (const match of wxml.matchAll(pattern)) names.add(match[1])
  return [...names]
}

for (const page of registered.allPages) {
  const wxml = expandedWxml(root,`${page}.wxml`)
  // Inspect the assembled Page object, including factories/controller mixins.
  // Text matching alone rejected legitimate imported handlers and skipped
  // generated pages without actually proving their event wiring.
  const definition = runtime.load(page)
  for (const name of handlerNames(wxml)) {
    assert.ok(Object.prototype.hasOwnProperty.call(definition,name) && typeof definition[name] === 'function', `${page} references missing handler ${name}`)
  }
  for (const match of wxml.matchAll(/\burl="(\/[^"?]+)(?:\?[^" ]*)?"/g)) {
    const target = match[1].replace(/^\//, '').replace(/\/$/, '')
    assert.ok(registeredPages.has(target), `${page} points to an unregistered page ${target}`)
  }
}

console.log(`WXML handler and internal page-link contract passed for ${registered.allPages.length} pages.`)
