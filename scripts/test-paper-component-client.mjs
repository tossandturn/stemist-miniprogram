import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const base={schemaVersion:'native-paper-catalog-v1',filterVersion:'native-paper-filters-v1',componentFilterVersion:'native-paper-components-v1',subject:'9702',stage:'as',routeId:'cie-9702-as-physics',year:null,season:'all',component:'1',query:'',page:1,pageCount:1,total:1,version:'fixture',facets:{years:[2025],seasons:[],paperComponents:[{value:'1',label:'P1'},{value:'2',label:'P2'}]},items:[{id:'paper11',subject:'9702',kind:'qp',file:'9702_s25_qp_11.pdf',paperComponent:1,stages:['as'],routeIds:['cie-9702-as-physics']}]}
const spec={subject:'9702',stage:'as',routeId:'cie-9702-as-physics',component:'1'}
let requested=''
const runtime=miniRuntime({modules:{'utils/api':{getJson:async url=>{requested=url;return base}}}})
const result=await runtime.load('utils/paperCatalog').fetchPaperPage(spec)
assert.match(requested,/component=1/);assert.equal(result.items[0].paperComponent,1)
for(const patch of [{component:'2'},{componentFilterVersion:undefined},{items:[{...base.items[0],paperComponent:2}]}]){
 const r=miniRuntime({modules:{'utils/api':{getJson:async()=>({...base,...patch})}}})
 await assert.rejects(()=>r.load('utils/paperCatalog').fetchPaperPage(spec))
}
for(const component of ['P1','01','0','10',''])await assert.rejects(()=>runtime.load('utils/paperCatalog').fetchPaperPage({...spec,component}))
const scopes=[]
const r=miniRuntime({modules:{'utils/paperCatalog':{PAPER_SUBJECTS:[{code:'9702',label:'Physics'}],fetchPaperPage:async scope=>{scopes.push(scope);return{...base,items:[],facets:base.facets,component:scope.component,subjectTotal:1,pairedTotal:1}}}}})
const page=r.page('pages/papers/index');page.onLoad({subject:'9702',stage:'as'});await settle()
assert.equal(page.data.component,'all');assert.equal(page.data.componentOptions[1].value,'1')
await page.chooseComponent({detail:{value:'1'}});assert.equal(scopes.at(-1).component,'1')
await page.clearFilters();assert.equal(scopes.at(-1).component,'all')
console.log('Paper component client: transmitted filter, fail-closed echo/row checks, invalid values, native picker and reset passed.')
