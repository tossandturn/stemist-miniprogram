import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root=path.resolve(import.meta.dirname,'..'),target=path.join(root,'utils','ieltsBootstrap.js')
const option=name=>{const i=process.argv.indexOf(name);return i<0?'':process.argv[i+1]||''}
const sourcePath=option('--source'),modulePath=option('--source-module'),out=path.resolve(option('--out')||target),check=process.argv.includes('--check')
if(Boolean(sourcePath)===Boolean(modulePath))throw new Error('Supply exactly one explicit --source JSON or --source-module JavaScript input')
if(out!==target)throw new Error('Bootstrap output must remain utils/ieltsBootstrap.js')

function readModule(file){
 const resolved=path.resolve(file),source=fs.readFileSync(resolved,'utf8')
 if(Buffer.byteLength(source)>600000||path.extname(resolved)!=='.js')throw new Error('Invalid bootstrap module input')
 return{value:readModuleSource(source,resolved),source}
}
function readModuleSource(source,filename='ieltsBootstrap.js'){const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports,Array},{filename,timeout:2000});return module.exports}

let value,inputSource
if(modulePath){({value,source:inputSource}=readModule(modulePath))}
else{
 const raw=fs.readFileSync(path.resolve(sourcePath),'utf8'),catalog=JSON.parse(raw)
 if(Buffer.byteLength(raw)>600000)throw new Error('Invalid or non-public bootstrap payload')
 value={schemaVersion:'stemist-ielts-bootstrap-v1',source:'https://ieltsist.com/api/native/ielts/catalog',sha256:crypto.createHash('sha256').update(raw).digest('hex'),catalog};inputSource=raw
}

const semanticJson=JSON.stringify(value)
if(value?.schemaVersion!=='stemist-ielts-bootstrap-v1'||value.source!=='https://ieltsist.com/api/native/ielts/catalog'||!/^[a-f0-9]{64}$/.test(value.sha256)||value.catalog?.schemaVersion!=='native-ielts-catalog-v1'||Buffer.byteLength(semanticJson)>600000||/"(?:questions|answer|answerKey|token|password|aiBaseUrl)"\s*:/i.test(semanticJson))throw new Error('Invalid or non-public bootstrap payload')
for(const key of ['listeningTests','readingTests','writingTasks','speakingSets'])if(!Array.isArray(value.catalog[key]))throw new Error('Incomplete catalog')

const keys=[],keyIndex=new Map(),counts=new Map()
function scan(item){
 if(typeof item==='string')counts.set(item,(counts.get(item)||0)+1)
 else if(Array.isArray(item))item.forEach(scan)
 else if(item&&typeof item==='object')for(const [key,child] of Object.entries(item)){if(!keyIndex.has(key)){keyIndex.set(key,keys.length);keys.push(key)}scan(child)}
 else if(item!==null&&typeof item!=='boolean'&&(typeof item!=='number'||!Number.isFinite(item)))throw new Error('Bootstrap contains a non-JSON value')
}
scan(value)
const score=({count,bytes})=>count*(bytes-5)-bytes
let strings=[...counts].filter(([,count])=>count>1).map(([text,count])=>({text,count,bytes:JSON.stringify(text).length})).sort((a,b)=>score(b)-score(a)||(a.text<b.text?-1:a.text>b.text?1:0)).map(item=>item.text)
for(;;){const next=strings.filter((text,index)=>{const bytes=JSON.stringify(text).length,count=counts.get(text),reference=4+String(index).length;return count*bytes>bytes+1+count*reference});if(next.length===strings.length)break;strings=next}
const stringIndex=new Map(strings.map((text,index)=>[text,index]))
function pack(item){
 if(typeof item==='string')return stringIndex.has(item)?[2,stringIndex.get(item)]:item
 if(Array.isArray(item))return[0,...item.map(pack)]
 if(item&&typeof item==='object'){const packed=[1];for(const [key,child] of Object.entries(item))packed.push(keyIndex.get(key),pack(child));return packed}
 return item
}
const data=pack(value)
const generated=`// Generated public metadata bootstrap. No questions, answers or user data.\nconst K=${JSON.stringify(keys)},S=${JSON.stringify(strings)},D=${JSON.stringify(data)};function U(v){if(!Array.isArray(v))return v;if(v[0]===2)return S[v[1]];if(v[0]===0)return v.slice(1).map(U);const o={};for(let i=1;i<v.length;i+=2)o[K[v[i]]]=U(v[i+1]);return o}module.exports=U(D)\n`
if(JSON.stringify(readModuleSource(generated))!==semanticJson)throw new Error('Packed bootstrap changed exported metadata or property order')
if(check){if(!fs.existsSync(out)||fs.readFileSync(out,'utf8').replace(/\r\n/g,'\n')!==generated)throw new Error('Generated bootstrap is stale; rebuild it from the explicit source module')}
else fs.writeFileSync(out,generated,'utf8')
const semanticSha256=crypto.createHash('sha256').update(semanticJson).digest('hex'),bytes=Buffer.byteLength(generated)
console.log(JSON.stringify({status:check?'verified':'built',file:out,inputBytes:Buffer.byteLength(inputSource),bytes,savedBytes:Buffer.byteLength(inputSource)-bytes,inputSha256:crypto.createHash('sha256').update(inputSource).digest('hex'),semanticSha256,keys:keys.length,pooledStrings:strings.length}))
