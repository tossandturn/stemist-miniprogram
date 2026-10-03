import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const arg=process.argv.indexOf('--source'),repack=process.argv.includes('--repack-existing'),check=process.argv.includes('--check')
if((arg<0)===!repack)throw new Error('Supply exactly one of --source <verified snapshot> or --repack-existing')
let source
if(repack){const runtime=miniRuntime(),current=runtime.load('utils/ieltsTaskBootstrap'),{unpackTask}=runtime.load('utils/nativeDataPack');source={version:current.version,tasks:Object.keys(current.tasks||{}).map(id=>unpackTask(current,id))}}
else source=JSON.parse(fs.readFileSync(process.argv[arg+1],'utf8'))
if(!/^[a-f0-9]{24}$/.test(source.version)||!Array.isArray(source.tasks)||source.tasks.length>1500)throw new Error('Invalid source snapshot')
const counts=new Map(),names=[],nameIds=new Map()
function walk(value){
 if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).some(key=>['__proto__','constructor','prototype','$r','answer','answerKey','expectedAnswer','token','password'].includes(key)))throw new Error('Private or unsupported source field')
 const key=JSON.stringify(value)
 if(key.length>3)counts.set(key,(counts.get(key)||0)+1)
 if(value&&typeof value==='object')Object.values(value).forEach(walk)
 if(value&&typeof value==='object'&&!Array.isArray(value))for(const name of Object.keys(value))if(!nameIds.has(name)){nameIds.set(name,names.length);names.push(name)}
}
source.tasks.forEach(walk)
let keys=[...counts].filter(([,count])=>count>1).sort((a,b)=>b[1]-a[1]||Buffer.byteLength(b[0])-Buffer.byteLength(a[0])||(a[0]<b[0]?-1:a[0]>b[0]?1:0)).map(([key])=>key)
function build(sharedKeys){
 const refs=new Map(sharedKeys.map((key,index)=>[key,index]))
 function encode(value,own=''){
  const key=JSON.stringify(value)
  if(refs.has(key)&&own!==key)return -(refs.get(key)+1)
  if(Array.isArray(value))return [1,...value.map(item=>encode(item))]
  if(value&&typeof value==='object')return [0,...Object.entries(value).flatMap(([name,item])=>[nameIds.get(name),encode(item)])]
  if(typeof value==='number'&&value<0)return [2,value]
  return value
 }
 return{schemaVersion:'stemist-native-task-pack-v3',version:source.version,names,values:sharedKeys.map(key=>encode(JSON.parse(key),key)),tasks:Object.fromEntries(source.tasks.map(task=>[task.id,encode(task)]))}
}
function referenceCounts(pack){
 const uses=Array(pack.values.length).fill(0)
 function visit(value){
  if(typeof value==='number'&&value<0){const index=-value-1;if(index>=uses.length)throw new Error('Generated task reference is out of range');uses[index]++;return}
  if(!Array.isArray(value)||value[0]===2)return
  if(value[0]===1){for(let i=1;i<value.length;i++)visit(value[i]);return}
  if(value[0]===0){for(let i=2;i<value.length;i+=2)visit(value[i]);return}
  throw new Error('Generated task value is invalid')
 }
 Object.values(pack.tasks).forEach(visit);pack.values.forEach(visit);return uses
}
let pack
// Sharing a parent can leave a child referenced only once in the encoded
// graph. Inline those children instead of paying for both a value slot and a
// reference; rebuilding keeps indexes compact and decoded structure exact.
for(;;){pack=build(keys);const uses=referenceCounts(pack),next=keys.filter((_,index)=>uses[index]>1);if(next.length===keys.length)break;keys=next}
if(Object.keys(pack.tasks).length!==source.tasks.length)throw new Error('Duplicate task IDs')
const {unpackTask}=miniRuntime().load('utils/nativeDataPack')
for(const task of source.tasks)assert.equal(JSON.stringify(unpackTask(pack,task.id)),JSON.stringify(task),'lossless '+task.id)
const out=path.resolve(import.meta.dirname,'../utils/ieltsTaskBootstrap.js'),text='// Generated public task data; no answer keys or student data.\nmodule.exports='+JSON.stringify(pack)+'\n'
if(check){if(!fs.existsSync(out)||fs.readFileSync(out,'utf8').replace(/\r\n/g,'\n')!==text)throw new Error('Generated task bundle is stale; rebuild it from the reviewed source')}else fs.writeFileSync(out,text,'utf8')
console.log(JSON.stringify({status:check?'verified':'built',schemaVersion:pack.schemaVersion,tasks:source.tasks.length,rawBytes:Buffer.byteLength(JSON.stringify(source.tasks)),rawSha256:crypto.createHash('sha256').update(JSON.stringify(source.tasks)).digest('hex'),packedBytes:Buffer.byteLength(text),sharedValues:pack.values.length,version:pack.version}))
