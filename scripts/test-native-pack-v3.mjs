import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {performance} from 'node:perf_hooks'
import {execFileSync} from 'node:child_process'
import {miniRuntime} from './helpers/mini-runtime.mjs'
import {MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES,WECHAT_PACKAGE_LIMIT_BYTES,nativeAppManifest,packageRootForPath,runtimePackageBudgets} from './helpers/native-app-manifest.mjs'

const root=path.resolve(import.meta.dirname,'..')
const runtime=miniRuntime(),packStarted=performance.now(),pack=runtime.load('utils/ieltsTaskBootstrap'),packLoadMs=performance.now()-packStarted,{unpackTask}=runtime.load('utils/nativeDataPack')
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex')
const fileHash=value=>crypto.createHash('sha256').update(value).digest('hex')

const fixtureManifest=nativeAppManifest({pages:['pages/index/index'],subPackages:[{root:'bundles/marking',pages:['index','history']}]})
assert.deepEqual(fixtureManifest.mainPages,['pages/index/index'])
assert.deepEqual(fixtureManifest.allPages,['pages/index/index','bundles/marking/index','bundles/marking/history'])
assert.equal(packageRootForPath('utils/page.js',fixtureManifest.subPackages),null,'shared runtime remains in the main package')
assert.equal(packageRootForPath('components/stemist-header/index.js',fixtureManifest.subPackages),null,'shared components remain in the main package')
assert.equal(packageRootForPath('bundles/marking/index.js',fixtureManifest.subPackages),'bundles/marking')
assert.throws(()=>nativeAppManifest({pages:['pages/index/index'],subPackages:[{root:'bundles/private',pages:['index'],independent:true}]}),/ordinary|independent/i)
assert.throws(()=>nativeAppManifest({pages:['pages/index/index'],subPackages:[{root:'bundles',pages:['one']},{root:'bundles/marking',pages:['two']}]}),/overlap/i)
const boundaryBudgets=runtimePackageBudgets([{path:'app.js',bytes:WECHAT_PACKAGE_LIMIT_BYTES-MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES},{path:'bundles/marking/index.js',bytes:WECHAT_PACKAGE_LIMIT_BYTES}],fixtureManifest.subPackages)
assert.equal(boundaryBudgets.mainPackageBytes,WECHAT_PACKAGE_LIMIT_BYTES-MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES)
assert.equal(boundaryBudgets.subPackages[0].bytes,WECHAT_PACKAGE_LIMIT_BYTES)
assert.throws(()=>runtimePackageBudgets([{path:'app.js',bytes:WECHAT_PACKAGE_LIMIT_BYTES-MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES+1}],[]),/Main package.*128 KiB/i)
assert.throws(()=>runtimePackageBudgets([{path:'app.js',bytes:1},{path:'bundles/marking/index.js',bytes:WECHAT_PACKAGE_LIMIT_BYTES+1}],fixtureManifest.subPackages),/Subpackage bundles\/marking exceeds.*2 MiB/i)

const v2={schemaVersion:'stemist-native-task-pack-v2',names:['id','values'],values:['shared'],tasks:{legacy:['o',0,'legacy',1,['a',['r',0],-5]]}}
assert.deepEqual(JSON.parse(JSON.stringify(unpackTask(v2,'legacy'))),{id:'legacy',values:['shared',-5]},'v2 bundles remain decodable during migration')
const v3={schemaVersion:'stemist-native-task-pack-v3',names:['id','values'],values:['shared'],tasks:{current:[0,0,'current',1,[1,-1,[2,-5]]]}}
assert.deepEqual(JSON.parse(JSON.stringify(unpackTask(v3,'current'))),{id:'current',values:['shared',-5]},'v3 distinguishes negative references from negative source numbers')

assert.equal(pack.schemaVersion,'stemist-native-task-pack-v3')
assert.equal(pack.version,'31191da7c62c4607b1317fcb')
assert.equal(Object.keys(pack.tasks).length,291)
assert.ok(fs.statSync(path.join(root,'utils/ieltsTaskBootstrap.js')).size<=1_000_000,'v3 task pack must retain material package headroom')

const ids=Object.keys(pack.tasks),started=performance.now(),tasks=ids.map(id=>unpackTask(pack,id)),decodeMs=performance.now()-started
const raw=JSON.stringify(tasks)
assert.equal(Buffer.byteLength(raw),2_260_008)
assert.equal(hash(raw),'2c64d9b27d730a1701bdc2d818640dfa09b7383682c50cb71fe4c21c8446d361','every decoded task field must round-trip exactly')
assert.equal(hash(ids),'38563afbc68337799fa712c4fc602cc7ff09301eff779559d72f1cd35cfed712')

const questionIds=[],imageRefs=[],sources=[],imageFields=[]
function walk(value,parts=[]){
 if(Array.isArray(value)){value.forEach((item,index)=>walk(item,parts.concat(index)));return}
 if(!value||typeof value!=='object')return
 for(const [name,item] of Object.entries(value)){
  const next=parts.concat(name)
  if(name==='id'&&/^q\d+$/.test(String(item)))questionIds.push(item)
  if(/source|version/i.test(name))sources.push([next.join('.'),item])
  if(/image/i.test(name))imageFields.push([next.join('.'),item])
  if(/(?:PageImages|Images)$/.test(name)&&Array.isArray(item))for(const image of item)if(image?.url)imageRefs.push(image.url)
  walk(item,next)
 }
}
tasks.forEach((task,index)=>walk(task,[index]))
assert.equal(questionIds.length,5760);assert.equal(hash(questionIds),'a4962811aae836bdcaccae8c8ce72595abd942ae0cb2730d3639d91164a847dd')
assert.equal(sources.length,1729);assert.equal(hash(sources),'e6af71838c40ecd532576cf7917ba12966f4f88f530b6675a1115898ac8155e8')
assert.equal(imageFields.length,435);assert.equal(hash(imageFields),'5a403bf32a592dda6a4b5c7c408d91f2f8949a01a8ec5a0c739d086e4a9f10b5')
assert.equal(imageRefs.length,2592);assert.equal(hash(imageRefs),'d17386df0d7a27c44ac1f14879da7e04eef0df213f3b28539892d6c15fa65b81')

const iconDir=path.join(root,'design-system/topic-icons'),iconFiles=fs.readdirSync(iconDir).sort()
const iconManifest=iconFiles.map(name=>[name,fileHash(fs.readFileSync(path.join(iconDir,name)))])
assert.equal(iconFiles.length,17);assert.equal(hash(iconManifest),'61fae8a47315bbae2771a54b8c9ac391f04e26e562124633b54e2650b3b654af')

const accessed=new Set(),lazyPack={...pack,values:new Proxy(pack.values,{get(target,key,receiver){if(/^\d+$/.test(String(key)))accessed.add(Number(key));return Reflect.get(target,key,receiver)}})}
const oneStarted=performance.now(),single=unpackTask(lazyPack,'cam15-w-test1-task1'),singleMs=performance.now()-oneStarted
assert.equal(single.id,'cam15-w-test1-task1');assert.ok(accessed.size<pack.values.length/4,'one task must not eagerly decode the whole shared dictionary')
assert.ok(packLoadMs<500&&singleMs<100&&decodeMs<500,`bounded load/decode cost: load=${packLoadMs.toFixed(1)}ms one=${singleMs.toFixed(1)}ms all=${decodeMs.toFixed(1)}ms`)

const declaredApp=nativeAppManifest(JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')))
const runtimeFileSet=new Set(['app.js','app.json','app.wxss','sitemap.json']),legacyOnly=['utils/skillPage.js','utils/speakingTicket.js','pages/webview/index.js','pages/webview/index.json','pages/webview/index.wxml','pages/webview/index.wxss']
const portable=value=>value.replaceAll('\\','/')
function collect(directory,{skipSubRoots=false}={}){for(const name of fs.readdirSync(path.join(root,directory))){const relative=path.join(directory,name),normalized=portable(relative),stat=fs.lstatSync(path.join(root,relative));if(relative.startsWith('design-system'+path.sep)&&name.endsWith('.md')||legacyOnly.includes(normalized))continue;if(stat.isDirectory()){if(skipSubRoots&&declaredApp.subPackages.some(entry=>entry.root===normalized))continue;collect(relative,{skipSubRoots})}else if(stat.isFile())runtimeFileSet.add(relative)}}
for(const directory of ['pages','components','utils','design-system','third_party'])collect(directory,{skipSubRoots:true})
for(const entry of declaredApp.subPackages)collect(entry.root)
const runtimeFiles=[...runtimeFileSet],portableRuntimeFiles=new Set(runtimeFiles.map(portable)),mainRuntimeFiles=runtimeFiles.filter(file=>packageRootForPath(portable(file),declaredApp.subPackages)===null)
for(const page of declaredApp.allPages)for(const extension of ['.js','.json','.wxml','.wxss'])assert.ok(portableRuntimeFiles.has(page+extension),`packager file collection must include ${page+extension}`)
const runtimeBytes=mainRuntimeFiles.reduce((total,file)=>total+fs.statSync(path.join(root,file)).size,0),totalRuntimeBytes=runtimeFiles.reduce((total,file)=>total+fs.statSync(path.join(root,file)).size,0),budget=WECHAT_PACKAGE_LIMIT_BYTES,targetHeadroom=MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES
assert.ok(runtimeBytes<=budget-targetHeadroom,`main package ${runtimeBytes} must leave at least ${targetHeadroom} bytes below 2 MiB`)
const subPackageStats=declaredApp.subPackages.map(entry=>{const packageFiles=runtimeFiles.filter(file=>packageRootForPath(portable(file),declaredApp.subPackages)===entry.root),bytes=packageFiles.reduce((total,file)=>total+fs.statSync(path.join(root,file)).size,0);assert.ok(bytes<=budget,`subpackage ${entry.root} ${bytes} exceeds 2 MiB`);return{root:entry.root,pages:entry.pages,files:packageFiles.length,bytes,headroom:budget-bytes,budget}})
const packageCheck=JSON.parse(execFileSync(process.execPath,['scripts/build-native-package.mjs','--check-only'],{cwd:root,encoding:'utf8'}))
assert.equal(packageCheck.runtimeFiles,mainRuntimeFiles.length);assert.equal(packageCheck.runtimeBytes,runtimeBytes);assert.equal(packageCheck.headroom,budget-runtimeBytes);assert.equal(packageCheck.minimumHeadroom,targetHeadroom)
assert.equal(packageCheck.mainPackageBytes,runtimeBytes);assert.equal(packageCheck.totalRuntimeFiles,runtimeFiles.length);assert.equal(packageCheck.totalRuntimeBytes,totalRuntimeBytes);assert.deepEqual(packageCheck.subPackages,subPackageStats)

console.log(JSON.stringify({status:'pass',schemaVersion:pack.schemaVersion,tasks:tasks.length,questions:questionIds.length,imageReferences:imageRefs.length,icons:iconFiles.length,packBytes:fs.statSync(path.join(root,'utils/ieltsTaskBootstrap.js')).size,runtimeFiles:mainRuntimeFiles.length,runtimeBytes,headroom:budget-runtimeBytes,totalRuntimeFiles:runtimeFiles.length,totalRuntimeBytes,subPackages:subPackageStats,sharedValues:pack.values.length,packLoadMs:Number(packLoadMs.toFixed(2)),singleTaskSharedReads:accessed.size,singleDecodeMs:Number(singleMs.toFixed(2)),decodeAllMs:Number(decodeMs.toFixed(2))}))
