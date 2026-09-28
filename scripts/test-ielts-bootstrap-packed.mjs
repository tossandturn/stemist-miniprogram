import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {execFileSync} from 'node:child_process'

const root=path.resolve(import.meta.dirname,'..')
const target=path.join(root,'utils','ieltsBootstrap.js')
const baselineBytes=148473,baselineModuleSha256='1ad7549c845a490a4a4fb44d9a32e53069917d6d8d6a62d1bb2f066d3c502850'
const load=source=>{const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports,Array},{timeout:2000});return module.exports}
const baselineSource=execFileSync('git',['show','HEAD:utils/ieltsBootstrap.js'],{cwd:root,encoding:'utf8',maxBuffer:1_000_000})
const packedSource=fs.readFileSync(target,'utf8')
const baseline=load(baselineSource),started=performance.now(),packed=load(packedSource),decodeMs=performance.now()-started
const baselineJson=JSON.stringify(baseline),packedJson=JSON.stringify(packed)
const mutableNodes=new WeakSet()
const assertTree=(value,path='root')=>{if(!value||typeof value!=='object')return;assert.equal(mutableNodes.has(value),false,`packed bootstrap must not share mutable structure at ${path}`);mutableNodes.add(value);if(Array.isArray(value))value.forEach((child,index)=>assertTree(child,`${path}[${index}]`));else for(const [key,child] of Object.entries(value))assertTree(child,`${path}.${key}`)}

assert.deepStrictEqual(JSON.parse(packedJson),JSON.parse(baselineJson),'packed bootstrap exports must deeply equal the HEAD baseline')
assert.equal(packedJson,baselineJson,'JSON equality also preserves every object property order and primitive type')
assert.deepEqual(Object.keys(packed),Object.keys(baseline))
assertTree(packed)
const firstSections=packed.catalog.writingTasks[0].sections,secondSections=packed.catalog.writingTasks[1].sections
assert.notEqual(firstSections,secondSections);firstSections.push({fixture:true});assert.equal(secondSections.length,0,'mutating one decoded row cannot change another row');firstSections.pop()
assert.equal(crypto.createHash('sha256').update(packedJson).digest('hex'),'f27448acbd755a6badf513435c4c00f0051ba187904f853722a14b31570baefb')
if(Buffer.byteLength(baselineSource)===baselineBytes)assert.equal(crypto.createHash('sha256').update(baselineSource).digest('hex'),baselineModuleSha256,'HEAD baseline module must be the independently frozen input')
assert.ok(Buffer.byteLength(packedSource)<=baselineBytes-20_000,'packed runtime module must save at least 20 KiB')
assert.ok(decodeMs<100,`bootstrap decode must stay lightweight, measured ${decodeMs.toFixed(2)} ms`)

const check=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts','build-native-bootstrap.mjs'),'--source-module',target,'--out',target,'--check'],{cwd:root,encoding:'utf8',maxBuffer:1_000_000}))
assert.equal(check.status,'verified');assert.equal(check.semanticSha256,'f27448acbd755a6badf513435c4c00f0051ba187904f853722a14b31570baefb')
console.log(JSON.stringify({status:'pass',baselineBytes,packedBytes:Buffer.byteLength(packedSource),savedBytes:baselineBytes-Buffer.byteLength(packedSource),semanticSha256:check.semanticSha256,decodeMs:Number(decodeMs.toFixed(2))}))
