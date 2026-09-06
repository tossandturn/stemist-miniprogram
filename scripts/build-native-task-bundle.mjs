import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const arg=process.argv.indexOf('--source');if(arg<0)throw new Error('Supply --source with a verified public native task snapshot')
const source=JSON.parse(fs.readFileSync(process.argv[arg+1],'utf8'))
if(!/^[a-f0-9]{24}$/.test(source.version)||!Array.isArray(source.tasks)||source.tasks.length>1500)throw new Error('Invalid source snapshot')
const counts=new Map(),names=[],nameIds=new Map()
function walk(value){
 if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).some(key=>['__proto__','constructor','prototype','$r','answer','answerKey','expectedAnswer','token','password'].includes(key)))throw new Error('Private or unsupported source field')
 const key=JSON.stringify(value)
 if(key.length>32)counts.set(key,(counts.get(key)||0)+1)
 if(value&&typeof value==='object')Object.values(value).forEach(walk)
 if(value&&typeof value==='object'&&!Array.isArray(value))for(const name of Object.keys(value))if(!nameIds.has(name)){nameIds.set(name,names.length);names.push(name)}
}
source.tasks.forEach(walk)
const keys=[...counts].filter(([,count])=>count>1).map(([key])=>key),refs=new Map(keys.map((key,index)=>[key,index]))
function encode(value,own=''){
 const key=JSON.stringify(value)
 if(refs.has(key)&&own!==key)return ['r',refs.get(key)]
 if(Array.isArray(value))return ['a',...value.map(item=>encode(item))]
 if(value&&typeof value==='object')return ['o',...Object.entries(value).flatMap(([name,item])=>[nameIds.get(name),encode(item)])]
 return value
}
const pack={schemaVersion:'stemist-native-task-pack-v2',version:source.version,names,values:keys.map(key=>encode(JSON.parse(key),key)),tasks:Object.fromEntries(source.tasks.map(task=>[task.id,encode(task)]))}
if(Object.keys(pack.tasks).length!==source.tasks.length)throw new Error('Duplicate task IDs')
const {unpackTask}=miniRuntime().load('utils/nativeDataPack')
for(const task of source.tasks)assert.equal(JSON.stringify(unpackTask(pack,task.id)),JSON.stringify(task),'lossless '+task.id)
const out=path.resolve(import.meta.dirname,'../utils/ieltsTaskBootstrap.js'),text='// Generated public task data; no answer keys or student data.\nmodule.exports='+JSON.stringify(pack)+'\n'
fs.writeFileSync(out,text,'utf8')
console.log(JSON.stringify({status:'built',tasks:source.tasks.length,rawBytes:Buffer.byteLength(JSON.stringify(source.tasks)),packedBytes:Buffer.byteLength(text),sharedValues:pack.values.length,version:pack.version}))
