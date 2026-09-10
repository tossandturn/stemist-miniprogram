import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let calls=0,version='a'.repeat(24),fail=false,omitDetailVersion=false
const item={id:'test-qp',subject:'9702',kind:'qp',stages:['a2'],routeIds:['cie-9702-a2-physics'],file:'test.pdf',localUrl:'/local-pdf/9702/test.pdf',markScheme:null}
const r=miniRuntime({modules:{'utils/api':{getJson:async(path,options)=>{
 calls++;assert.match(path,/^\/api\/stem\/paper-catalog\?/);assert.equal(options.stemAuth,false);if(fail)throw Error('network timeout')
 const q=Object.fromEntries(new URL(path,'https://example.test').searchParams)
 if(q.id)return {schemaVersion:'native-paper-detail-v1',subject:q.subject,...(omitDetailVersion?{}:{version}),paper:{...item,id:q.id}}
 return {schemaVersion:'native-paper-catalog-v1',...q,page:Number(q.page),pageSize:30,total:1,pageCount:1,subjectTotal:1,pairedTotal:0,version,items:[item]}
}}}}),api=r.load('utils/paperCatalog')
const scope={subject:'9702',stage:'a2',routeId:'cie-9702-a2-physics'}
await Promise.all([api.fetchPaperPage(scope),api.fetchPaperPage(scope)]);assert.equal(calls,1,'coalesce the same page request')
await api.fetchPaperDetail('9702',item.id);assert.equal(calls,1,'opening a listed paper uses its bounded detail cache')
await api.fetchPaperDetail('9702','another-qp');assert.equal(calls,2,'deep links fetch one detail, not a subject catalog')
omitDetailVersion=true;const legacy=await api.fetchPaperDetail('9702','legacy-qp');assert.equal(legacy.id,'legacy-qp');assert.equal(legacy.sourceVersion,'','a legacy detail without version remains usable but cannot enter the cross-page public cache');omitDetailVersion=false
for(let i=1;i<8;i++)await api.fetchPaperPage({...scope,query:'query'+i})
const before=calls;await api.fetchPaperPage(scope);assert.equal(calls,before+1,'old pages are evicted after six queries')
version='b'.repeat(24);await api.fetchPaperPage({...scope,query:'new-version'});const after=calls;await api.fetchPaperPage(scope);assert.equal(calls,after+1,'new source version invalidates older pages')
fail=true;const failedAt=calls;await assert.rejects(()=>api.fetchPaperPage({...scope,query:'uncached'}));assert.equal(calls,failedAt+1,'a timeout never falls back to a multi-megabyte download')
console.log('Paper page service: public/coalesced requests, bounded caches, source version invalidation, exact detail and no bulk fallback passed.')
