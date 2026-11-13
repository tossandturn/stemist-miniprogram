import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const portable=value=>value.replaceAll('\\','/')
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex')
const regular=(root,relative,max=1024*1024)=>{const target=path.join(root,relative),stat=fs.lstatSync(target);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=max&&fs.realpathSync(target)===target);const bytes=fs.readFileSync(target);return{path:portable(relative),bytes:bytes.length,sha256:sha256(bytes)}}
const safeSkillPath=value=>{assert.equal(typeof value,'string');assert.equal(value,value.trim());assert.ok(value&&!value.startsWith('/')&&!value.includes('\\'),'AI skill path must be a relative Mini Program path without a leading slash');const parts=value.split('/');assert.ok(parts.every(part=>part&&part!=='.'&&part!=='..'&&/^[A-Za-z0-9._-]+$/.test(part)));return value}
const skillFiles=(root,relative)=>{const output=[];function walk(directory){for(const name of fs.readdirSync(path.join(root,directory))){const child=path.join(directory,name),stat=fs.lstatSync(path.join(root,child));assert.ok(!stat.isSymbolicLink());if(stat.isDirectory())walk(child);else if(stat.isFile())output.push(regular(root,child,2*1024*1024))}}walk(relative);return output.sort((a,b)=>a.path.localeCompare(b.path,'en'))}

export function aiSkillUploadContract({root,appManifest}){
 assert.ok(path.isAbsolute(root));const skills=appManifest?.agent?.skills||[];assert.ok(skills.length>0)
 return{skills:skills.map(skill=>{
  const skillPath=safeSkillPath(skill.path),requiredFiles=['SKILL.md','index.js','mcp.json'].map(name=>skillPath+'/'+name),owner=appManifest.subPackages.find(entry=>entry.independent&&(skillPath===entry.root||skillPath.startsWith(entry.root+'/')));assert.ok(owner,'AI skill must remain inside an independent subpackage')
  const required=requiredFiles.map(file=>regular(root,file,file.endsWith('SKILL.md')?16_000:file.endsWith('mcp.json')?128_000:2*1024*1024)),mcp=JSON.parse(fs.readFileSync(path.join(root,skillPath,'mcp.json'),'utf8'));assert.ok(Array.isArray(mcp.apis)&&mcp.apis.length>0)
  const apiNames=mcp.apis.map(api=>{assert.ok(api&&typeof api==='object'&&!Array.isArray(api));assert.match(api.name||'',/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);assert.ok(typeof api.description==='string'&&api.description.trim());assert.equal(api.inputSchema?.type,'object');return api.name});assert.equal(new Set(apiNames).size,apiNames.length)
  const compact=JSON.stringify(mcp,(key,value)=>key==='outputSchema'?undefined:value);assert.ok(Buffer.byteLength(compact,'utf8')<=24_000)
  const index=fs.readFileSync(path.join(root,skillPath,'index.js'),'utf8'),created=[...index.matchAll(/createSkill\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match=>match[1]),registered=[...index.matchAll(/registerAPI\(\s*['"]([^'"]+)['"]/g)].map(match=>match[1]);assert.deepEqual(created,[skillPath]);assert.deepEqual(registered,apiNames)
  return{name:skill.name,path:skillPath,packageRoot:owner.root,requiredFiles,apiNames,files:skillFiles(root,skillPath),required:required.map(file=>({path:file.path,bytes:file.bytes,sha256:file.sha256}))}
 })}
}

export function nativeUploadProjectConfig(original,{appId,projectName='stemist-native'}={}){
 assert.ok(original&&typeof original==='object'&&!Array.isArray(original));assert.ok(appId==='touristappid'||/^wx[a-f0-9]{16}$/.test(appId||''));assert.match(projectName,/^[A-Za-z0-9._-]{3,80}$/)
 return{appid:appId,projectname:projectName,compileType:'miniprogram',libVersion:original.libVersion,miniprogramRoot:'./',setting:{...original.setting,urlCheck:true,minified:true,minifyWXSS:true,compileHotReLoad:false,ignoreUploadUnusedFiles:false,ignoreDevUnusedFiles:false},packOptions:{ignore:[],include:[]}}
}
