// Produce a clean upload directory without changing the user's IDE settings.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES,WECHAT_PACKAGE_LIMIT_BYTES,nativeAppManifest,runtimePackageBudgets} from './helpers/native-app-manifest.mjs'

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
const legacyOnly=new Set(['utils/skillPage.js','utils/speakingTicket.js','pages/webview/index.js','pages/webview/index.json','pages/webview/index.wxml','pages/webview/index.wxss'])
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
 const source=path.join(root,name),bytes=fs.readFileSync(source)
 if(/<web-view\b/i.test(bytes.toString('utf8')))throw new Error('A WebView remains in the upload tree')
 manifest.push({path:normalized(name),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')})
}
const {mainFiles,mainPackageBytes,mainPackageHeadroom,subPackages,totalRuntimeFiles,totalRuntimeBytes}=runtimePackageBudgets(manifest,app.subPackages)
const summary={status:'pass',runtimeFiles:mainFiles.length,runtimeBytes:mainPackageBytes,headroom:mainPackageHeadroom,minimumHeadroom:MINIMUM_HEADROOM,budget:MAX_RUNTIME_BYTES,mainPackageFiles:mainFiles.length,mainPackageBytes,mainPackageHeadroom,totalRuntimeFiles,totalRuntimeBytes,subPackages,webViews:0}
if(checkOnly){console.log(JSON.stringify(summary));process.exit(0)}
fs.mkdirSync(out)
for(const item of manifest){const source=path.join(root,item.path),target=path.join(out,item.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target)}
const original=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8'))
const config={appid:original.appid,projectname:'stemist-native',compileType:'miniprogram',libVersion:original.libVersion,miniprogramRoot:'./',setting:{...original.setting,urlCheck:true,minified:true,minifyWXSS:true,compileHotReLoad:false},packOptions:{ignore:[],include:[]}}
fs.writeFileSync(path.join(out,'project.config.json'),JSON.stringify(config,null,2)+'\n','utf8')
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
const receipt={schemaVersion:'stemist-native-upload-v2',commit,runtimeBytes:mainPackageBytes,runtimeHeadroomBytes:mainPackageHeadroom,minimumHeadroomBytes:MINIMUM_HEADROOM,mainPackage:{files:mainFiles.length,bytes:mainPackageBytes,headroom:mainPackageHeadroom,budget:MAX_RUNTIME_BYTES},subPackages,totalRuntimeFiles,totalRuntimeBytes,files:manifest,originalProjectConfigChanged:false}
fs.writeFileSync(out+'-manifest.json',JSON.stringify(receipt,null,2)+'\n','utf8')
console.log(JSON.stringify({directory:out,manifest:out+'-manifest.json',commit,...summary,originalProjectConfigChanged:false}))
