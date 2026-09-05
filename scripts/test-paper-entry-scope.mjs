import assert from 'node:assert/strict'
import { miniRuntime, settle } from './helpers/mini-runtime.mjs'
const runtime=miniRuntime({modules:{'utils/api':{getJson:async()=>({schemaVersion:2,items:[]})}}})
const paper=runtime.page('pages/papers/index')
paper.onLoad({category:'competition',subject:'esat'});await settle()
assert.equal(paper.data.subject,'esat')
assert.equal(paper.data.showStageFilter,false)
assert.equal(paper.data.subjects.some(item=>/^\d/.test(item.code)),false)
const academic=runtime.page('pages/papers/index');academic.onLoad({category:'alevel',subject:'9702'});await settle()
academic.chooseStage({detail:{value:'3'}})
assert.equal(academic.data.stage,'a2')
academic.data.catalog={items:Array.from({length:81},(_,i)=>({id:'paper-'+i,subject:'9702',year:2020,file:'paper-'+i+'.pdf',stages:['a2']}))}
academic.applyFilters();assert.equal(academic.data.items.length,30)
academic.loadMore();academic.loadMore();assert.equal(academic.data.items.length,81)
assert.equal(academic.data.hasMore,false)
console.log('Paper filters, category isolation and full-catalog pagination passed.')
