import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
let renewals=0,requests=0
const routeId='cie-9702-as-physics',ids=Array.from({length:12},(_,i)=>'q'+i)
const chapter={mode:'chapter-study',available:3,officialAvailable:0,originalAvailable:3,startable:true,fallbackKind:'original-foundation'}
const payload={routeId,paperComponents:[1,2],practicePolicy:{schemaVersion:'stem-topic-practice-policy-v1',minSourceGroups:6,minReviewedGroups:12,setSizes:[6,10,15],chapterStudy:{mode:'chapter-study',minSourceGroups:1,maxSourceGroups:15,countPolicy:'cap-to-available',formalProgressEligible:false,sourcePreferences:['official-first','original-foundation-only']}},chapterStudy:{mode:'chapter-study',catalogVersion:'v2',foundationCatalog:'v2',topicCount:1,startableTopicCount:1,gapTopicIds:['physics-topic-1']},topics:[{id:'physics-topic-1',name:'Physical quantities',questionIdsByComponent:{1:{verifiedQuestionIds:ids,studyQuestionIds:[]}},chapterStudy:chapter,componentCounts:{1:{chapterStudy:chapter},2:{chapterStudy:chapter}}}]}
const r=miniRuntime({modules:{'utils/nativeSession':{refreshNativeSession:async()=>{renewals++;throw Error('expired session must not block public chapters')},captureNativeCookie(){}}},wx:{request(options){requests++;assert.equal(options.method,'GET');assert.match(options.url,/foundationCatalog=v2/);assert.equal(options.header.Authorization,undefined);options.success({statusCode:200,data:payload})}}})
r.storage.set('stemistSessionToken','expired-fixture');r.storage.set('stemistUser',{id:'fixture-owner'});r.storage.set('stemistDraft:writing',{text:'keep existing essay'})
const original=JSON.stringify([...r.storage])
const result=await r.load('utils/inventory').fetchRouteInventory(routeId,'v2')
assert.equal(result.topics.length,1);assert.equal(renewals,0);assert.equal(requests,1);assert.equal(JSON.stringify([...r.storage]),original)
const page=r.page('pages/stem/topics');page.onLoad({routeId});await settle();assert.equal(page.data.error,'');assert.equal(page.data.topics.length,1);page.toggleTopic({currentTarget:{dataset:{id:'physics-topic-1'}}});assert.equal(page.data.canStart,true);page.onUnload()
for(const [errMsg,code] of [['request:fail url not in domain list','network_domain_blocked'],['request:fail ssl hand shake error','network_tls_error'],['request:fail timeout','network_timeout']]){
 const fail=miniRuntime({wx:{request:o=>o.fail({errMsg})}})
 await assert.rejects(()=>fail.load('utils/inventory').fetchRouteInventory(routeId),error=>error.code===code)
}
console.log('Public inventory: expired login bypassed without auth/storage changes; source counts, chapter selection and classified domain/TLS/timeout errors passed.')
