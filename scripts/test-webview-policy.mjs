import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const r=miniRuntime(),route=r.load('utils/nativeNavigation').legacyUrlToNative
for(const url of ['http://stem.ieltsist.com/','https://evil.example/','https://stem.ieltsist.com.evil.example/','https://user@stem.ieltsist.com/'])assert.equal(route(url),'')
assert.match(route('https://stem.ieltsist.com/papers?subject=9702&routeId=cie-9702-as-physics&paperId=paper-1'),/^\/pages\/stem\/paper\?/)
assert.match(route('https://stem.ieltsist.com/practice?category=competition&family=admissions&subject=esat&routeId=uatuk-esat-admissions'),/^\/pages\/papers\/index\?category=competition/)
assert.equal(route('https://ieltsist.com/?module=speaking'),'/pages/ielts/library?module=speaking')
assert.equal(route('https://ieltsist.com/#exam'),'/pages/ielts/exam?mode=random-exam')
const app=JSON.parse(fs.readFileSync(new URL('../app.json',import.meta.url),'utf8'))
for(const page of app.pages)assert.doesNotMatch(fs.readFileSync(path.resolve(import.meta.dirname,'..',page+'.wxml'),'utf8'),/<web-view\b/)
for(const feature of r.load('utils/ieltsCatalog').IELTS_FEATURES){assert.equal(feature.kind,'native');assert.ok(app.pages.includes(feature.nativePage.split('?')[0].slice(1)))}
console.log('All learning entries are native; legacy own-site links resolve safely without a WebView.')
