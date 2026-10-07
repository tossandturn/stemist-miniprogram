// Mechanical whitespace-only compaction. Uses an existing local PostCSS install;
// never removes comments, changes values/selectors, or merges/reorders rules.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
const require=createRequire(import.meta.url)
const postcss=require('../../alevel-learning-platform/node_modules/postcss')
const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2),write=args.includes('--write')
const explicit=args.filter(arg=>arg!=='--write')
assert(!write||explicit.length,'Writing requires exact source paths')
const files=explicit.length?explicit:execFileSync('git',['ls-files','--','*.wxss'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(file=>!file.startsWith('bundles/'))
const structural=node=>Object.fromEntries(Object.entries(node.toJSON()).filter(([key])=>!['source','raws','inputs'].includes(key)).map(([key,value])=>[key,key==='nodes'?value.map(child=>strip(child)):value]))
const strip=node=>Object.fromEntries(Object.entries(node).filter(([key])=>!['source','raws','inputs'].includes(key)).map(([key,value])=>[key,key==='nodes'?value.map(strip):value]))
const results=[]
for(const file of files){
 const target=path.resolve(root,file)
 assert(target.startsWith(root+path.sep)&&file.endsWith('.wxss'),'Exact workspace WXSS only')
 const before=fs.readFileSync(target,'utf8'),ast=postcss.parse(before,{from:target}),shape=structural(ast)
 ast.walk(node=>{
  if(/^\s*$/.test(node.raws.before||''))node.raws.before=node.type==='decl'?'':'\n'
  if(node.type==='decl'&&/^\s*:\s*$/.test(node.raws.between||''))node.raws.between=':'
  else if(node.type==='rule'&&/^\s*$/.test(node.raws.between||''))node.raws.between=''
  if(/^\s*$/.test(node.raws.after||''))node.raws.after=''
 })
 ast.raws.after='\n'
 const after=ast.toString().replace(/^\s+/,''),reparsed=postcss.parse(after,{from:target})
 assert.deepEqual(structural(reparsed),shape,'CSS structure changed: '+file)
 const saved=Buffer.byteLength(before)-Buffer.byteLength(after)
 if(write&&saved>0)fs.writeFileSync(target,after,'utf8')
 results.push({file,saved,before:Buffer.byteLength(before),after:Buffer.byteLength(after),astEquivalent:true,written:write&&saved>0})
}
console.log(JSON.stringify(results.sort((a,b)=>b.saved-a.saved).slice(0,12),null,2))
