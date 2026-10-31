import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {transformNativePackageFile} from './helpers/native-package-transform.mjs'
import {packNativeTaskData} from './helpers/native-task-token-pack.mjs'

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../utils/ieltsTaskBootstrap.js'))
const load=bytes=>{const module={exports:{}};vm.runInNewContext(bytes.toString(),{module},{timeout:2000});return module.exports}
const packed=transformNativePackageFile('utils/ieltsTaskBootstrap.js',source)
assert.ok(source.length-packed.bytes.length>=25000,'release transform must remove at least 25 KB of repeated data text, not only JS whitespace')
const started=performance.now(),decoded=load(packed.bytes),duration=performance.now()-started
assert.equal(JSON.stringify(decoded),JSON.stringify(load(source)),'every key, value, type, property order and URL must survive packing')
assert.ok(duration<250,`task data restore should stay bounded; ${duration.toFixed(2)} ms`)
const seen=new WeakSet();function checkTree(value){if(!value||typeof value!=='object')return;assert.equal(seen.has(value),false,'decoding must not add shared mutable nodes');seen.add(value);Object.values(value).forEach(checkTree)}checkTree(decoded)
assert.equal(transformNativePackageFile('utils/ieltsTaskBootstrap.js',source).bytes.toString(),packed.bytes.toString(),'output is deterministic')
assert.throws(()=>packNativeTaskData('module.exports=require("external")'),/generated JSON module/,'reject non-data executable input')
const fixture={schemaVersion:'stemist-native-task-pack-v3',text:'quotes " \\ 中文 \n mathematical signs α ±',values:['reading-pages reading-pages',null,-1,false,0],tasks:{}}
const moduleText=data=>'// Generated public task data; no answer keys or student data.\nmodule.exports='+JSON.stringify(data)+'\n'
assert.equal(JSON.stringify(load(Buffer.from(packNativeTaskData(moduleText(fixture))))),JSON.stringify(fixture))
assert.throws(()=>packNativeTaskData(moduleText({...fixture,text:'\uE000'})),/collision/,'do not decode existing private-use characters as tokens')
console.log(JSON.stringify({status:'PASS',sourceBytes:source.length,packedBytes:packed.bytes.length,savedBytes:source.length-packed.bytes.length,decodeMs:Number(duration.toFixed(2)),semanticEquality:true}))
