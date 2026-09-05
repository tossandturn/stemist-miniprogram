import assert from 'node:assert/strict'
import { miniRuntime, settle } from './helpers/mini-runtime.mjs'
let inventoryCalls=0
const runtime=miniRuntime({modules:{'utils/api':{getJson:async()=>{inventoryCalls++;return {topics:[]}}}}})
const competition=runtime.page('pages/practice/index')
competition.onLoad({category:'competition'});competition.onShow()
assert.equal(runtime.calls[0].url,'/pages/papers/index?category=competition')
assert.equal(inventoryCalls,0,'competition must not load Topic inventory')
const alevel=runtime.page('pages/practice/index')
alevel.onLoad({category:'alevel',routeId:'cie-9709-a2-after-p1-p5-p3-p6'})
await settle()
assert.equal(alevel.data.routeId,'cie-9709-a2-after-p1-p5-p3-p6')
assert.equal(alevel.data.subjectCode,'9709')
assert.equal(alevel.data.stage,'A2')
const ielts=runtime.page('pages/practice/index');ielts.onLoad({category:'ielts'})
assert.equal(ielts.data.routeId,'')
console.log('Competition papers-only routing and exact A-Level resume passed.')
