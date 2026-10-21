import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {transformNativePackageFile} from './helpers/native-package-transform.mjs'
const root=path.resolve(import.meta.dirname,'..')
const source=fs.readFileSync(path.join(root,'utils/academicAnswer.js'))
const result=transformNativePackageFile('utils/academicAnswer.js',source)
assert.equal(result.transform,'esbuild-academic-identifiers-v1','only pure presentation helpers get identifier compression')
assert.ok(result.bytes.length<source.length*.78,'recover sufficient headroom without lowering budget')
function runtime(compiled){
 const cache=new Map()
 function load(relative){
  relative=relative.replace(/\.js$/,'');if(cache.has(relative))return cache.get(relative)
  const bytes=fs.readFileSync(path.join(root,relative+'.js')),module={exports:{}}
  vm.runInNewContext((compiled?transformNativePackageFile(relative+'.js',bytes).bytes:bytes).toString('utf8'),{module,exports:module.exports,require:name=>load(path.posix.join(path.posix.dirname(relative),name)),URL})
  cache.set(relative,module.exports);return module.exports
 }
 return load('utils/academicAnswer')
}
const before=runtime(false),after=runtime(true)
for(const source of ['**解题步骤**\n1. 减去 3。\n\n**最终答案**\n\\[x=4\\]\n\n**检验**\n代回成立。','## (a)\n\n**答案**\n$x=4$\n\n## (b)\n\n**答案**\n$y=5$','**下一步动作**\n先减去 3。','[private](https://example.com/?token=fixture)']){
 for(const key of ['academicAnswer','modularAnswer'])assert.equal(JSON.stringify(after[key](source)),JSON.stringify(before[key](source)))
}
for(const key of Object.keys(before))assert.equal(after[key].name,before[key].name)
assert.equal(transformNativePackageFile('utils/share.js',Buffer.from('function named(){return 1}')).transform,'esbuild-whitespace-v1')
console.log('Academic package: targeted compression, output/name parity and unchanged other transforms PASS')
