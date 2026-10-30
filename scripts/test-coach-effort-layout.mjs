import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
const root=process.env.STEMIST_TEST_RUNTIME_ROOT||path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8')
const panel=JSON.parse(read('components/coach-panel/index.json'));assert.equal(panel.usingComponents['coach-effort'],'../coach-effort/index')
assert.match(read('components/coach-panel/index.wxml'),/<coach-effort[^>]*effort="{{reasoningEffort}}"/)
for(const page of ['pages/coach/index','pages/stem/coach']){assert.match(read(page+'.wxml'),/reasoning-effort="{{reasoningEffort}}"/);assert.match(read(page+'.wxml'),/bind:effort="chooseEffort"/)}
for(const page of ['bundles/coach/tavern','bundles/coach/admissions','bundles/coach/ieltsTeacher','bundles/marking/index']){assert.equal(JSON.parse(read(page+'.json')).usingComponents['coach-effort'],'/components/coach-effort/index');assert.match(read(page+'.wxml'),/<coach-effort/);assert.match(read(page+'.wxml'),/locked="{{effortLocked}}"/)}
console.log('Coach effort UI wiring: reusable control on all six modes and legacy academic page PASS.')
