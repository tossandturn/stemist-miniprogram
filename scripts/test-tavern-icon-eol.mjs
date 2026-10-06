import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'

const root=path.resolve(import.meta.dirname,'..'),attributePath=path.join(root,'.gitattributes')
assert.equal(fs.existsSync(attributePath),true,'licensed SVG checkout needs a targeted LF attribute')
const attributes=fs.readFileSync(attributePath,'utf8')
assert.match(attributes,/^bundles\/coach\/icons\/\*\.svg text eol=lf$/m)
assert.doesNotMatch(attributes,/^(?:\*|bundles\/coach\/\*)\s/m,'the fix must not rewrite unrelated repository files')
const iconRoot=path.join(root,'bundles','coach','icons'),provenance=JSON.parse(fs.readFileSync(path.join(iconRoot,'provenance.json'),'utf8')),files=provenance.files.map(item=>`bundles/coach/icons/${item.name}`)
const attr=execFileSync('git',['check-attr','text','eol','--',...files],{cwd:root,encoding:'utf8'})
for(const file of files){assert.match(attr,new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}: text: set`));assert.match(attr,new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}: eol: lf`))}

const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'stemist-icons-eol-')),checkout=path.join(temporary,'checkout')
fs.mkdirSync(checkout)
try{
 const prefix=checkout.replaceAll('\\','/')+'/'
 execFileSync('git',['-c','core.autocrlf=true','checkout-index','--all',`--prefix=${prefix}`],{cwd:root,stdio:'pipe'})
 const checkedProvenance=JSON.parse(fs.readFileSync(path.join(checkout,'bundles','coach','icons','provenance.json'),'utf8'))
 for(const record of checkedProvenance.files){const bytes=fs.readFileSync(path.join(checkout,'bundles','coach','icons',record.name));assert.equal(bytes.includes(Buffer.from('\r\n')),false,`${record.name} must stay LF in an autocrlf checkout`);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.packagedSha256,`${record.name} checkout bytes must match reviewed provenance`)}
}finally{
 const resolved=path.resolve(temporary),safeRoot=path.resolve(os.tmpdir())+path.sep
 if(!resolved.startsWith(safeRoot)||!path.basename(resolved).startsWith('stemist-icons-eol-'))throw new Error('Refusing to clean an unexpected test directory')
 fs.rmSync(resolved,{recursive:true,force:true})
}

console.log('Licensed Tavern SVGs retain reviewed LF hashes in an autocrlf checkout.')
