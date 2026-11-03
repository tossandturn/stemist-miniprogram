import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'

const root=path.resolve(import.meta.dirname,'..'),attributePath=path.join(root,'.gitattributes')
assert.equal(fs.existsSync(attributePath),true,'reviewed SVG checkout needs a targeted LF attribute')
const attributes=fs.readFileSync(attributePath,'utf8')
assert.match(attributes,/^bundles\/coach\/icons\/\*\.svg text eol=lf$/m)
assert.doesNotMatch(attributes,/^(?:\*|bundles\/coach\/\*)\s/m,'the fix must not rewrite unrelated repository files')
const iconRoot=path.join(root,'bundles','coach','icons'),provenance=JSON.parse(fs.readFileSync(path.join(iconRoot,'provenance.json'),'utf8')),files=provenance.files.map(item=>`bundles/coach/icons/${item.name}`)
const attr=execFileSync('git',['check-attr','text','eol','--',...files],{cwd:root,encoding:'utf8'})
for(const file of files){assert.match(attr,new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}: text: set`));assert.match(attr,new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}: eol: lf`))}

const workspace=path.dirname(root),temporary=fs.mkdtempSync(path.join(workspace,'stemist-icons-eol-'))
const tracked=files.filter(file=>{try{execFileSync('git',['ls-files','--error-unmatch',file],{cwd:root,stdio:'ignore'});return true}catch{return false}}),untracked=files.filter(file=>!tracked.includes(file)),checkoutFiles=['.gitattributes',...tracked]
try{
 const prefix=temporary.replaceAll('\\','/')+'/'
 execFileSync('git',['-c','core.autocrlf=true','checkout-index',`--prefix=${prefix}`,'--stdin'],{cwd:root,input:checkoutFiles.join('\n')+'\n',stdio:['pipe','pipe','pipe']})
 const manifestSource=path.join(iconRoot,'provenance.json'),manifestTarget=path.join(temporary,'bundles','coach','icons','provenance.json')
 fs.mkdirSync(path.dirname(manifestTarget),{recursive:true});fs.copyFileSync(manifestSource,manifestTarget)
 for(const file of untracked){const source=path.join(root,file),target=path.join(temporary,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target)}
 assert.equal(fs.existsSync(path.join(temporary,'.gitattributes')),true)
 const checkedProvenance=JSON.parse(fs.readFileSync(path.join(temporary,'bundles','coach','icons','provenance.json'),'utf8'))
 for(const record of checkedProvenance.files){const bytes=fs.readFileSync(path.join(temporary,'bundles','coach','icons',record.name));assert.equal(bytes.includes(Buffer.from('\r\n')),false,`${record.name} must stay LF in an autocrlf checkout`);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.packagedSha256,`${record.name} checkout bytes must match reviewed provenance`)}
}finally{
 const resolved=path.resolve(temporary)
 if(path.dirname(resolved)!==path.resolve(workspace)||!path.basename(resolved).startsWith('stemist-icons-eol-'))throw new Error('Refusing to clean an unexpected test directory')
 fs.rmSync(resolved,{recursive:true,force:true})
}

console.log('Original Tavern SVGs retain reviewed LF hashes in an autocrlf checkout.')
