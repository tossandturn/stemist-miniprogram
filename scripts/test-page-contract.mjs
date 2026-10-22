import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {expandedWxml} from './helpers/wxml-source.mjs'
import {nativeAppManifest,packageRootForPath} from './helpers/native-app-manifest.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const app = JSON.parse(read('app.json'))
const registered = nativeAppManifest(app)

for (const page of registered.allPages) {
  for (const extension of ['.js', '.wxml', '.wxss']) assert.equal(fs.existsSync(path.join(root, `${page}${extension}`)), true, `${page}${extension} is required`)
  const jsonPath = path.join(root, `${page}.json`)
  if (!fs.existsSync(jsonPath)) continue
  const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  if (config.usingComponents) assert.equal(typeof config.navigationBarTitleText, 'string', `${page} needs a meaningful native navigation title`)
  for (const [tag, componentPath] of Object.entries(config.usingComponents || {})) {
    const target=componentPath.startsWith('/')?componentPath.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(page),componentPath))
    const resolved=path.resolve(root,target)
    assert.ok(resolved.startsWith(root+path.sep),`${page} component ${tag} stays in the workspace`)
    for(const extension of ['.js','.json','.wxml','.wxss'])assert.ok(fs.existsSync(resolved+extension),`${page} references missing component ${tag}${extension}`)
    assert.equal(JSON.parse(fs.readFileSync(resolved+'.json','utf8')).component,true,`${tag} is declared as a component`)
    const componentPackage=packageRootForPath(target,registered.subPackages),pagePackage=packageRootForPath(page,registered.subPackages)
    assert.ok(componentPackage===null||componentPackage===pagePackage,`${page} cannot import another subpackage's component`)
    assert.match(expandedWxml(root,`${page}.wxml`), new RegExp(`<${tag}(?:\\s|>)`), `${page} must use ${tag}`)
  }
}

assert.equal(app.window.pageOrientation, 'auto')
assert.match(read('.gitignore'), /project\.private\.config\.json/)
console.log(`Page/component contract passed for ${registered.allPages.length} pages (${registered.mainPages.length} main, ${registered.allPages.length-registered.mainPages.length} subpackage).`)
