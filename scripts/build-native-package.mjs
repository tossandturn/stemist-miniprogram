// Produce a clean upload directory without changing the user's IDE settings.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'..')
const index=process.argv.indexOf('--out')
if(index<0||!process.argv[index+1])throw new Error('Supply --out with a new directory under the workspace parent.')
const out=path.resolve(process.argv[index+1]),relative=path.relative(path.dirname(root),out)
if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||out===root||out.startsWith(root+path.sep)||fs.existsSync(out))throw new Error('Output must be a new sibling workspace directory; existing paths are never overwritten.')
const files=['app.js','app.json','app.wxss','sitemap.json']
function walk(directory){for(const name of fs.readdirSync(path.join(root,directory))){const relative=path.join(directory,name),stat=fs.lstatSync(path.join(root,relative));if(stat.isSymbolicLink())throw new Error('Symlinks are not part of the native upload package');if(stat.isDirectory())walk(relative);else if(stat.isFile())files.push(relative)}}
for(const dir of ['pages','components','utils','design-system','third_party'])walk(dir)
const changed=execFileSync('git',['diff','HEAD','--name-only','--',...files],{cwd:root,encoding:'utf8'}).trim()
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','--',...files],{cwd:root,encoding:'utf8'}).trim()
if(changed||untracked)throw new Error('Commit the reviewed runtime files before packaging.')
fs.mkdirSync(out)
const manifest=[]
for(const name of files){
 if(/(^|[\\/])(?:\.env|node_modules|\.git|.*\.sqlite)/i.test(name)||/\.(?:pdf|zip|tar|pem|key)$/i.test(name))throw new Error('Excluded payload type in runtime tree')
 const source=path.join(root,name),target=path.join(out,name),bytes=fs.readFileSync(source)
 if(/<web-view\b/i.test(bytes.toString('utf8')))throw new Error('A WebView remains in the upload tree')
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target)
 manifest.push({path:name.replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')})
}
const total=manifest.reduce((sum,item)=>sum+item.bytes,0)
if(total>2*1024*1024)throw new Error('Runtime exceeds this project\'s 2 MiB performance budget')
const original=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8'))
const config={appid:original.appid,projectname:'stemist-native',compileType:'miniprogram',libVersion:original.libVersion,miniprogramRoot:'./',setting:{...original.setting,urlCheck:true,minified:true,minifyWXSS:true,compileHotReLoad:false},packOptions:{ignore:[],include:[]}}
fs.writeFileSync(path.join(out,'project.config.json'),JSON.stringify(config,null,2)+'\n','utf8')
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
const receipt={schemaVersion:'stemist-native-upload-v1',commit,runtimeBytes:total,files:manifest,originalProjectConfigChanged:false}
fs.writeFileSync(out+'-manifest.json',JSON.stringify(receipt,null,2)+'\n','utf8')
console.log(JSON.stringify({directory:out,manifest:out+'-manifest.json',commit,runtimeFiles:manifest.length,runtimeBytes:total,webViews:0,originalProjectConfigChanged:false}))
