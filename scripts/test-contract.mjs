import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=path.resolve(import.meta.dirname,'..')
const read=file=>fs.readFileSync(path.join(root,file),'utf8')
const app=JSON.parse(read('app.json'))
assert.equal(new Set(app.pages).size,app.pages.length,'registered pages must be unique')
assert.equal(app.window.pageOrientation,'auto')
assert.equal(app.lazyCodeLoading,'requiredComponents')
assert.equal(app.__usePrivacyCheck__,true)
assert.equal(app.pageOrientation,undefined,'orientation belongs under window')
assert.equal(app.permission?.['scope.camera'],undefined,'camera use is runtime-authorized; not a supported manifest permission entry')
const files=fs.readdirSync(root,{recursive:true}).filter(f=>typeof f==='string' && /\.js$/.test(f) && !/^(?:node_modules|scripts|\.git)[/\\]/.test(f))
for(const file of files) {
  const source=read(file)
  for(const match of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
    assert.ok(match[1].startsWith('.'),'student runtime must not import an unbundled Node dependency: '+file)
    const target=path.resolve(root,path.dirname(file),match[1]+'.js')
    assert.ok(fs.existsSync(target),file+' imports missing module '+match[1])
  }
  assert.doesNotMatch(source,/sk-[A-Za-z0-9]{20,}|BEGIN [A-Z ]*PRIVATE KEY/)
}
for(const page of app.pages) {
  for(const ext of ['js','json','wxml','wxss'])assert.ok(fs.existsSync(path.join(root,page+'.'+ext)),page+'.'+ext)
  const config=JSON.parse(read(page+'.json'))
  for(const [name,src] of Object.entries(config.usingComponents||{})) {
    assert.ok(fs.existsSync(path.join(root,src.replace(/^\//,'')+'.js')),page+' component '+name)
  }
}
console.log('Mini-program runtime imports and manifest packaging passed.')
