import path from 'node:path'

export const WECHAT_PACKAGE_LIMIT_BYTES=2*1024*1024
export const WECHAT_OFFICIAL_COMPILE_OVERHEAD_RESERVE_BYTES=160*1024
export const MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES=224*1024

function route(value,label){
 if(typeof value!=='string'||value!==value.trim()||!value||value.includes('\\')||path.posix.isAbsolute(value))throw new Error(`${label} must be a relative Mini Program route`)
 const parts=value.split('/')
 if(parts.some(part=>!part||part==='.'||part==='..'||!/^[A-Za-z0-9._-]+$/.test(part)))throw new Error(`${label} contains an unsafe route segment`)
 return value
}

function unique(values,label){
 const seen=new Set()
 for(const value of values){if(seen.has(value))throw new Error(`${label} must be unique: ${value}`);seen.add(value)}
 return values
}

function agentSkillPath(value,label){
 if(typeof value!=='string'||value!==value.trim()||!value||value.startsWith('/')||value.includes('\\'))throw new Error(`${label} must be a relative Mini Program path without a leading slash`)
 return route(value,label)
}

export function nativeAppManifest(app){
 if(!app||typeof app!=='object'||Array.isArray(app))throw new Error('app.json must contain an object')
 if(app.subPackages!==undefined&&app.subpackages!==undefined)throw new Error('Declare subPackages only once')
 if(!Array.isArray(app.pages))throw new Error('app.pages must be an array')
 const mainPages=unique(app.pages.map((page,index)=>route(page,`app.pages[${index}]`)),'main pages')
 const rawSubPackages=app.subPackages??app.subpackages??[]
 if(!Array.isArray(rawSubPackages))throw new Error('app.subPackages must be an array')
 const subPackages=rawSubPackages.map((entry,index)=>{
  if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error(`subPackages[${index}] must be an object`)
  if(entry.independent!==undefined&&typeof entry.independent!=='boolean')throw new Error(`subPackages[${index}].independent must be boolean`)
  const root=route(entry.root,`subPackages[${index}].root`).replace(/\/$/,'')
  const independent=entry.independent===true
  if(!Array.isArray(entry.pages)||(!independent&&!entry.pages.length))throw new Error(`subPackages[${index}].pages must be a non-empty array unless the package is independent`)
  const pages=unique(entry.pages.map((page,pageIndex)=>route(page,`subPackages[${index}].pages[${pageIndex}]`)),`pages in ${root}`)
  return {root,independent,pages,pageRoutes:pages.map(page=>`${root}/${page}`)}
 })
 unique(subPackages.map(entry=>entry.root),'subpackage roots')
 for(let i=0;i<subPackages.length;i++)for(let j=i+1;j<subPackages.length;j++){
  const first=subPackages[i].root,second=subPackages[j].root
  if(first.startsWith(second+'/')||second.startsWith(first+'/'))throw new Error(`subpackage roots overlap: ${first} and ${second}`)
 }
 const subPages=subPackages.flatMap(entry=>entry.pageRoutes),allPages=unique([...mainPages,...subPages],'registered pages')
 for(const page of mainPages)if(subPackages.some(entry=>page===entry.root||page.startsWith(entry.root+'/')))throw new Error(`main page overlaps subpackage root: ${page}`)
 let agent=null
 if(app.agent!==undefined){
  if(!app.agent||typeof app.agent!=='object'||Array.isArray(app.agent))throw new Error('app.agent must be an object')
  const instruction=route(app.agent.instruction,'app.agent.instruction'),pageMetadata=route(app.agent.pageMetadata,'app.agent.pageMetadata')
  if(!Array.isArray(app.agent.skills)||!app.agent.skills.length||app.agent.skills.length>30)throw new Error('app.agent.skills must contain 1 to 30 skills')
  const skills=app.agent.skills.map((skill,index)=>{
   if(!skill||typeof skill!=='object'||Array.isArray(skill))throw new Error(`app.agent.skills[${index}] must be an object`)
   const name=String(skill.name||''),description=String(skill.description||''),skillPath=agentSkillPath(skill.path,`app.agent.skills[${index}].path`)
   if(!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)||!description.trim())throw new Error(`app.agent.skills[${index}] name and description are required`)
   const owner=subPackages.find(entry=>entry.independent&&(skillPath===entry.root||skillPath.startsWith(entry.root+'/')))
   if(!owner)throw new Error(`app.agent.skills[${index}] must live in an independent subpackage`)
   return{name,description,path:skillPath,packageRoot:owner.root}
  })
  unique(skills.map(item=>item.name),'agent skill names');unique(skills.map(item=>item.path),'agent skill paths')
  agent={instruction,pageMetadata,skills}
 }
 return {mainPages,subPackages,allPages,agent}
}

export function packageRootForPath(value,subPackages){
 const relative=route(String(value).replaceAll('\\','/'),'runtime file')
 for(const entry of subPackages)if(relative===entry.root||relative.startsWith(entry.root+'/'))return entry.root
 return null
}

export function runtimePackageBudgets(manifest,subPackages){
 if(!Array.isArray(manifest)||!Array.isArray(subPackages))throw new Error('Runtime manifest and subpackages must be arrays')
 for(const [index,item] of manifest.entries())if(!item||typeof item.path!=='string'||!Number.isSafeInteger(item.bytes)||item.bytes<0)throw new Error(`Invalid runtime manifest item ${index}`)
 const mainFiles=manifest.filter(item=>packageRootForPath(item.path,subPackages)===null)
 const mainPackageBytes=mainFiles.reduce((sum,item)=>sum+item.bytes,0),mainPackageHeadroom=WECHAT_PACKAGE_LIMIT_BYTES-mainPackageBytes,officialCompileHeadroomBytes=mainPackageHeadroom-WECHAT_OFFICIAL_COMPILE_OVERHEAD_RESERVE_BYTES
 if(mainPackageHeadroom<MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES)throw new Error('Main package must leave at least 224 KiB below this project\'s 2 MiB performance budget')
 if(officialCompileHeadroomBytes<64*1024)throw new Error('Main package must retain at least 64 KiB after the 160 KiB official compiler overhead reserve')
 const packages=subPackages.map(entry=>{
  const packageFiles=manifest.filter(item=>packageRootForPath(item.path,subPackages)===entry.root)
  const bytes=packageFiles.reduce((sum,item)=>sum+item.bytes,0),headroom=WECHAT_PACKAGE_LIMIT_BYTES-bytes
  if(headroom<0)throw new Error(`Subpackage ${entry.root} exceeds the 2 MiB package limit`)
  return {root:entry.root,pages:entry.pages,files:packageFiles.length,bytes,headroom,budget:WECHAT_PACKAGE_LIMIT_BYTES}
 })
 return {mainFiles,mainPackageBytes,mainPackageHeadroom,officialCompileHeadroomBytes,subPackages:packages,totalRuntimeFiles:manifest.length,totalRuntimeBytes:manifest.reduce((sum,item)=>sum+item.bytes,0)}
}
