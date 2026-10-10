// Produce a clean upload directory without changing the user's IDE settings.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES,WECHAT_PACKAGE_LIMIT_BYTES,nativeAppManifest,packageRootForPath,runtimePackageBudgets} from './helpers/native-app-manifest.mjs'
import {MINIMUM_MAIN_PACKAGE_SAVINGS_BYTES,NATIVE_PACKAGE_TRANSFORM,transformNativePackageFile} from './helpers/native-package-transform.mjs'

const root=path.resolve(import.meta.dirname,'..'),checkOnly=process.argv.includes('--check-only')
const MAX_RUNTIME_BYTES=WECHAT_PACKAGE_LIMIT_BYTES,MINIMUM_HEADROOM=MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES
const app=nativeAppManifest(JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')))
let out=''
if(!checkOnly){
 const index=process.argv.indexOf('--out')
 if(index<0||!process.argv[index+1])throw new Error('Supply --out with a new directory under the workspace parent.')
 out=path.resolve(process.argv[index+1]);const relative=path.relative(path.dirname(root),out)
 if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||out===root||out.startsWith(root+path.sep)||fs.existsSync(out))throw new Error('Output must be a new sibling workspace directory; existing paths are never overwritten.')
}
const files=new Set(['app.js','app.json','app.wxss','sitemap.json'])
const legacyOnly=new Set(['utils/skillPage.js','utils/speakingTicket.js','pages/webview/index.js','pages/webview/index.json','pages/webview/index.wxml','pages/webview/index.wxss',...['js','json','wxml','wxss'].map(ext=>'components/text-practice/index.'+ext)])
const normalized=value=>value.replaceAll('\\','/')
const isSubRoot=relative=>app.subPackages.some(entry=>normalized(relative)===entry.root)
function walk(directory,{skipSubRoots=false}={}){
 const absolute=path.join(root,directory)
 if(!fs.existsSync(absolute)||!fs.statSync(absolute).isDirectory())throw new Error('Declared runtime directory is missing: '+normalized(directory))
 for(const name of fs.readdirSync(absolute)){
  const relative=path.join(directory,name),portable=normalized(relative),stat=fs.lstatSync(path.join(root,relative))
  if(stat.isSymbolicLink())throw new Error('Symlinks are not part of the native upload package')
  if(relative.startsWith('design-system'+path.sep)&&name.endsWith('.md')||legacyOnly.has(portable))continue
  if(stat.isDirectory()){if(skipSubRoots&&isSubRoot(relative))continue;walk(relative,{skipSubRoots})}
  else if(stat.isFile())files.add(relative)
 }
}
for(const directory of ['pages','components','utils','design-system','third_party'])walk(directory,{skipSubRoots:true})
for(const entry of app.subPackages)walk(entry.root)
const runtimeFiles=[...files].sort((a,b)=>normalized(a).localeCompare(normalized(b),'en'))
// Retained source-only compatibility components must never be silently excluded
// if a future native page or subpackage starts using them again.
for(const file of runtimeFiles.filter(name=>name.endsWith('.json'))){
 const declaration=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))
 for(const component of Object.values(declaration.usingComponents||{})){
  const resolved=component.startsWith('/')?component.slice(1):normalized(path.relative(root,path.resolve(root,path.dirname(file),component)))
  if(legacyOnly.has(resolved+'.js'))throw Error('A registered component is excluded from the runtime: '+file+' -> '+resolved)
 }
}
for(const file of runtimeFiles.filter(name=>name.endsWith('.js')))for(const match of fs.readFileSync(path.join(root,file),'utf8').matchAll(/require\(['"]([^'"]+)['"]\)/g)){
 const dependency=normalized(path.relative(root,path.resolve(root,path.dirname(file),match[1]+'.js')))
 if(legacyOnly.has(dependency))throw Error('A runtime import requires an excluded legacy module: '+file)
}
if(!checkOnly){
 const changed=execFileSync('git',['diff','HEAD','--name-only','--',...runtimeFiles],{cwd:root,encoding:'utf8'}).trim()
 const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','--',...runtimeFiles],{cwd:root,encoding:'utf8'}).trim()
 if(changed||untracked)throw new Error('Commit the reviewed runtime files before packaging.')
}
const manifest=[]
for(const name of runtimeFiles){
 if(/(^|[\\/])(?:\.env|node_modules|\.git|.*\.sqlite)/i.test(name)||/\.(?:pdf|zip|tar|pem|key)$/i.test(name))throw new Error('Excluded payload type in runtime tree')
 const source=path.join(root,name),sourceBytes=fs.readFileSync(source)
 if(/<web-view\b/i.test(sourceBytes.toString('utf8')))throw new Error('A WebView remains in the upload tree')
 const transformed=transformNativePackageFile(normalized(name),sourceBytes)
 manifest.push({path:normalized(name),sourceBytes:sourceBytes.length,sourceSha256:crypto.createHash('sha256').update(sourceBytes).digest('hex'),bytes:transformed.bytes.length,sha256:crypto.createHash('sha256').update(transformed.bytes).digest('hex'),transform:transformed.transform,output:transformed.bytes})
}
const receiptFiles=manifest.map(({output,...item})=>item)
const runtimeManifestSha256=crypto.createHash('sha256').update(JSON.stringify(receiptFiles.map(({path,bytes,sha256,transform})=>({path,bytes,sha256,transform})))).digest('hex')
const sourceManifestSha256=crypto.createHash('sha256').update(JSON.stringify(receiptFiles.map(({path,sourceBytes,sourceSha256})=>({path,sourceBytes,sourceSha256})))).digest('hex')
const {mainFiles,mainPackageBytes,mainPackageHeadroom,subPackages,totalRuntimeFiles,totalRuntimeBytes}=runtimePackageBudgets(manifest,app.subPackages)
const sourceMainPackageBytes=manifest.filter(item=>packageRootForPath(item.path,app.subPackages)===null).reduce((sum,item)=>sum+item.sourceBytes,0)
const sourceTotalRuntimeBytes=manifest.reduce((sum,item)=>sum+item.sourceBytes,0),mainPackageSavingsBytes=sourceMainPackageBytes-mainPackageBytes,totalRuntimeSavingsBytes=sourceTotalRuntimeBytes-totalRuntimeBytes
if(mainPackageSavingsBytes<MINIMUM_MAIN_PACKAGE_SAVINGS_BYTES)throw new Error(`Native package transform must recover at least 35 KiB in the main package; recovered ${mainPackageSavingsBytes} bytes`)
const summary={status:'pass',transform:NATIVE_PACKAGE_TRANSFORM,runtimeManifestSha256,sourceManifestSha256,runtimeFiles:mainFiles.length,runtimeBytes:mainPackageBytes,headroom:mainPackageHeadroom,minimumHeadroom:MINIMUM_HEADROOM,budget:MAX_RUNTIME_BYTES,mainPackageFiles:mainFiles.length,sourceMainPackageBytes,mainPackageBytes,mainPackageSavingsBytes,mainPackageHeadroom,totalRuntimeFiles,sourceTotalRuntimeBytes,totalRuntimeBytes,totalRuntimeSavingsBytes,subPackages,webViews:0}
if(checkOnly){console.log(JSON.stringify(summary));process.exit(0)}
fs.mkdirSync(out)
for(const item of manifest){const target=path.join(out,item.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,item.output)}
const original=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8'))
const config={appid:original.appid,projectname:'stemist-native',compileType:'miniprogram',libVersion:original.libVersion,miniprogramRoot:'./',setting:{...original.setting,urlCheck:true,minified:true,minifyWXSS:true,compileHotReLoad:false},packOptions:{ignore:[],include:[]}}
fs.writeFileSync(path.join(out,'project.config.json'),JSON.stringify(config,null,2)+'\n','utf8')
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
const receipt={schemaVersion:'stemist-native-upload-v3',commit,transform:NATIVE_PACKAGE_TRANSFORM,runtimeManifestSha256,sourceManifestSha256,runtimeBytes:mainPackageBytes,runtimeHeadroomBytes:mainPackageHeadroom,minimumHeadroomBytes:MINIMUM_HEADROOM,sourceMainPackageBytes,mainPackageSavingsBytes,mainPackage:{files:mainFiles.length,bytes:mainPackageBytes,headroom:mainPackageHeadroom,budget:MAX_RUNTIME_BYTES},subPackages,totalRuntimeFiles,sourceTotalRuntimeBytes,totalRuntimeBytes,totalRuntimeSavingsBytes,files:receiptFiles,originalProjectConfigChanged:false}
fs.writeFileSync(out+'-manifest.json',JSON.stringify(receipt,null,2)+'\n','utf8')
console.log(JSON.stringify({directory:out,manifest:out+'-manifest.json',commit,...summary,originalProjectConfigChanged:false}))
