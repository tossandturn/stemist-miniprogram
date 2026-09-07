import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
const sent=[],catalog=miniRuntime().load('utils/paperCatalog')
const runtime=miniRuntime({modules:{'utils/paperCatalog':{...catalog,fetchPaperPage:async options=>{sent.push(options);return {items:[],total:0,subjectTotal:0,pairedTotal:0,page:1,pageCount:0}}}}})
const paper=runtime.page('pages/papers/index');await paper.onLoad({category:'competition',subject:'esat'})
assert.equal(paper.data.subject,'esat');assert.equal(paper.data.showStageFilter,false);assert.equal(paper.data.subjects.some(item=>/^\d/.test(item.code)),false)
const p=runtime.page('pages/papers/index');await p.onLoad({category:'alevel',subject:'9702',stage:'A2',routeId:'cie-9702-a2-physics'})
assert.equal(p.data.stage,'a2');assert.equal(p.data.routeId,'cie-9702-a2-physics');assert.equal(sent.at(-1).stage,'a2');assert.equal(sent.at(-1).routeId,p.data.routeId)
await p.chooseStage({detail:{value:p.data.stageFilters.findIndex(s=>s.id==='as')}});assert.equal(p.data.stage,'as');assert.equal(p.data.routeId,'cie-9702-as-physics');assert.equal(p.data.showRouteFilter,false)
const maths=runtime.page('pages/papers/index');await maths.onLoad({routeId:'cie-9709-a2-after-p1-p5-p3-p6',stage:'A2'});assert.equal(maths.data.subject,'9709');assert.equal(maths.data.routeId,'cie-9709-a2-after-p1-p5-p3-p6');assert.equal(maths.data.showRouteFilter,true)
const bad=runtime.page('pages/papers/index'),before=sent.length;await bad.onLoad({subject:'9702',routeId:'cie-9709-as-p1-p2'});assert.ok(bad.data.error);assert.equal(sent.length,before)
const nav=runtime.load('utils/nativeNavigation').legacyUrlToNative('https://stem.ieltsist.com/papers?subject=9702&stage=A2&routeId=cie-9702-a2-physics');assert.match(nav,/stage=A2/);assert.match(nav,/routeId=cie-9702-a2-physics/)
const delays=[deferred(),deferred()];let i=0
const race=miniRuntime({modules:{'utils/paperCatalog':{...catalog,fetchPaperPage:()=>delays[i++].promise}}}),page=race.page('pages/papers/index')
page.onLoad({subject:'9702',stage:'AS'});page.chooseStage({detail:{value:page.data.stageFilters.findIndex(s=>s.id==='a2')}})
delays[1].resolve({items:[],total:4,page:1,pageCount:1});await settle();delays[0].resolve({items:[],total:999,page:1,pageCount:34});await settle();assert.equal(page.data.matchCount,4);assert.equal(page.data.stage,'a2')
for(const item of [p,paper,maths,bad,page])item.onUnload()
console.log('Paper scope: AS/A2 and mathematical combinations survive entry, invalid routes fail, late responses cannot replace a new stage.')
