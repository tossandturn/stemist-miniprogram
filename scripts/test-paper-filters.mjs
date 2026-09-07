import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const calls=[]
const rows=Array.from({length:90},(_,i)=>({id:'paper-'+i,subject:'9702',kind:'qp',year:2025-Math.floor(i/30),seasonKey:['spring','summer','winter'][i%3],season:['Mar','Jun','Nov'][i%3],seasonLabel:['春季','夏季','秋冬季'][i%3],file:'paper-'+i+'.pdf',stages:['as'],routeIds:['cie-9702-as-physics'],markScheme:null}))
let ignoreFilters=false
const runtime=miniRuntime({modules:{'utils/api':{getJson:async(path,options)=>{
 assert.equal(options.stemAuth,false);const q=Object.fromEntries(new URL(path,'https://example.test').searchParams);calls.push(q)
 const selected=rows.filter(r=>(!q.year||r.year===Number(q.year))&&(!q.season||q.season==='all'||r.seasonKey===q.season))
 return {schemaVersion:'native-paper-catalog-v1',subject:q.subject,stage:q.stage,routeId:q.routeId,query:q.query,page:1,pageSize:30,pageCount:1,total:selected.length,subjectTotal:rows.length,pairedTotal:0,version:'season-source-v1',items:selected.slice(0,30),...(!ignoreFilters?{filterVersion:'native-paper-filters-v1',year:q.year?Number(q.year):null,season:q.season||'all',facets:{years:[2025,2024,2023],seasons:[{value:'spring',label:'春季'},{value:'summer',label:'夏季'},{value:'winter',label:'秋冬季'}]}}:{})}
}}}})
const api=runtime.load('utils/paperCatalog')
const spring=await api.fetchPaperPage({subject:'9702',stage:'as',routeId:'cie-9702-as-physics',year:2024,season:'spring'})
assert.equal(calls[0].year,'2024');assert.equal(calls[0].season,'spring');assert.equal(spring.total,10);assert.ok(spring.items.every(i=>i.year===2024&&i.seasonKey==='spring'))
await api.fetchPaperPage({subject:'9702',year:2024,season:'summer'});assert.equal(calls.length,2,'different seasons cannot share an unfiltered cache')
ignoreFilters=true;await assert.rejects(()=>api.fetchPaperPage({subject:'9702',year:2023,season:'winter'}),/筛选/);ignoreFilters=false
const page=runtime.page('pages/papers/index');await page.onLoad({subject:'9702',stage:'AS',routeId:'cie-9702-as-physics'})
assert.equal(page.data.filterReady,true);assert.ok(page.data.yearOptions.length>1)
await page.chooseYear({detail:{value:2}});await page.chooseSeason({detail:{value:2}})
assert.equal(page.data.year,'2024');assert.equal(page.data.season,'summer');assert.equal(page.data.routeId,'cie-9702-as-physics');assert.equal(page.data.stage,'as');assert.equal(page.data.items.length,10)
ignoreFilters=true;await page.chooseYear({detail:{value:3}});assert.match(page.data.error,/筛选/);assert.equal(page.data.catalog,false);assert.equal(page.data.items.length,0);assert.equal(page.__pageItems.length,0,'failed new filters cannot retain clickable papers under a different scope');ignoreFilters=false
await page.clearFilters();assert.equal(page.data.year,'all');assert.equal(page.data.season,'all');assert.equal(page.data.routeId,'cie-9702-as-physics');page.onUnload();await settle()
console.log('Paper filters: server-side year/season, scoped cache, rejected ignored filters, AS route retention, reset and source facets passed.')
