import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const data=Array.from({length:4000},(_,i)=>({id:'paper-'+i,subject:'9702',year:2025-Math.floor(i/200),file:`9702_${i}_qp.pdf`,stages:['as'],routeIds:['cie-9702-as-physics'],kind:'qp',localUrl:`/local-pdf/9702/9702_${i}_qp.pdf`}))
let calls=0
const runtime=miniRuntime({modules:{'utils/paperCatalog':{PAPER_SUBJECTS:[{code:'9702',label:'Physics'}],fetchPaperPage:async({page=1,query=''})=>{calls++;const rows=data.filter(p=>!query||p.file.includes(query));return {items:rows.slice((page-1)*30,page*30),page,pageCount:Math.ceil(rows.length/30),total:rows.length,subjectTotal:data.length,pairedTotal:0}}}}})
const p=runtime.page('pages/papers/index');await p.onLoad({category:'alevel',subject:'9702'})
assert.equal(calls,1);assert.equal(p.data.items.length,30);assert.equal(p.__pageItems.length,30)
assert.ok(JSON.stringify(p.data).length<20000);assert.ok(!p.__catalog&&!p.__matches,'the page does not download or retain the whole catalog')
for(let i=0;i<50;i++)await p.loadMore()
assert.equal(calls,51);assert.equal(p.data.items.length,30);assert.equal(p.__pageItems.length,30);assert.equal(p.data.pageNumber,51)
await p.previousPage();assert.equal(p.data.pageNumber,50)
p.setData({query:'9702_3999'});await p.loadCatalog();assert.equal(p.data.items.length,1);assert.equal(p.data.pageNumber,1)
p.onUnload()
console.log('Native catalog performance: 4,000 source records, only 30 downloaded/rendered per page, 50 page transitions passed.')
