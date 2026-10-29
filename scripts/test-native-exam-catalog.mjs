import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'

const task=(id,extra={})=>({id,book:15,test:1,title:id,...extra})
const payload={schemaVersion:'native-ielts-catalog-v1',version:'exam-ready-v1',listeningTests:[task('cam15-l-test1')],readingTests:[task('cam15-r-test1')],speakingSets:[task('cam15-s-test1')],writingTasks:[task('cam15-w-test1-task1',{sourceAvailability:'ready',sourceRevision:'a'.repeat(64)}),task('cam15-w-test1-task2',{sourceAvailability:'ready',sourceRevision:'b'.repeat(64)}),task('cam16-w-test1-task1',{sourceAvailability:'pending-review'})]}
function setup({random}={}){
 const requests=[],creates=[],remote=deferred();let response=()=>remote.promise,time=Date.now(),createResponse=data=>({examId:'test-exam',examToken:'local-test-capability',manifest:data.manifest})
 class Clock extends Date{static now(){return time}}
 const r=miniRuntime({globals:{Date:Clock,...(random?{Math:Object.assign(Object.create(Math),{random})}:{})},modules:{
  'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async(path,data,options)=>{requests.push({path,options});return response()}},
  'utils/ieltsLearning':{requestIeltsLearning:async(path,data)=>{creates.push({path,data});return createResponse(data)}},
 }})
 r.storage.set('stemistUser',{id:'test-student'})
 return{r,remote,requests,creates,api:r.load('utils/nativeExam'),content:r.load('utils/ieltsContent'),respond:fn=>response=fn,respondCreate:fn=>createResponse=fn,advance:ms=>time+=ms}
}
{
 const s=setup(),attempt=s.api.newExam('random-exam').then(value=>({value}),error=>({error}))
 await settle();assert.equal(s.requests.length,1,'cold exam must fetch immediately, not reject from the offline writing metadata')
 assert.equal(s.creates.length,0,'do not create before the catalogue refresh finishes')
 s.remote.resolve(payload);const result=await attempt;assert.equal(result.error,undefined)
 assert.deepEqual(Array.from(result.value.sources.writing),['cam15-w-test1-task1','cam15-w-test1-task2'])
 assert.deepEqual(Array.from(result.value.sourceRevisions.writing),['a'.repeat(64),'b'.repeat(64)])
 assert.equal(s.creates.length,1)
 assert.equal((await s.api.examChoices()).length,1);assert.equal(s.requests.length,1,'fresh verified in-memory catalogue may be reused')
}
{
 const s=setup(),bootstrap=s.r.load('utils/ieltsBootstrap')
 s.r.storage.set('stemistPublicIeltsCatalog',{payload:bootstrap.catalog,at:Date.now(),builtAgainst:bootstrap.catalog.version})
 const old=await s.content.loadIeltsContent();assert.equal(s.api.completeSets(old).length,0)
 const first=s.api.examChoices(),second=s.content.loadIeltsContent({requireFresh:true});await settle()
 assert.equal(s.requests.length,1,'a restored legacy catalogue must not satisfy requireFresh; parallel callers coalesce')
 s.remote.resolve(payload);assert.equal((await first).length,1);await second
 s.advance(300001);s.respond(async()=>({...payload,version:'exam-ready-v2'}));await s.api.examChoices();assert.equal(s.requests.length,2,'expired verified data is awaited again')
}
{
 const s=setup();s.respond(async()=>{throw Error('request timeout')})
 await assert.rejects(s.api.newExam('random-exam'),/题库.*更新失败/)
 assert.equal(s.creates.length,0)
 const old=await s.content.loadIeltsContent();assert.ok(old.reading.length>0,'ordinary offline browsing is preserved after network failure')
 s.respond(async()=>payload);const choices=await s.api.examChoices();const exam=await s.api.newExam('same-test',choices[0].id)
 assert.equal(exam.context,'same-test');assert.equal(s.creates.length,1)
}
{
 const s=setup();s.respond(async()=>({...payload,writingTasks:payload.writingTasks.map(t=>({...t,sourceAvailability:'pending-review'}))}))
 await assert.rejects(s.api.newExam('random-exam'),/不能组成完整模拟/);assert.equal(s.creates.length,0,'fresh but unverified writing remains ineligible')
}
for(const mutate of [s=>s.r.storage.set('stemistUser',{id:'other'}),s=>s.r.storage.set('stemistPrivacyEpoch',1)]){
 const s=setup(),result=s.api.newExam('random-exam').catch(e=>e);await settle();mutate(s);s.remote.resolve(payload);assert.match((await result).message,/账号已变化/);assert.equal(s.creates.length,0)
}
{
 const s=setup();let cancelled=false
 const result=s.api.newExam('random-exam',undefined,{cancelled:()=>cancelled}).catch(e=>e);await settle();cancelled=true;s.remote.resolve(payload)
 assert.match((await result).message,/取消/);assert.equal(s.creates.length,0,'leaving while loading must not dispatch a new exam')
}
console.log('Native exam catalogue: cold/legacy cache, awaited refresh, concurrency, fresh TTL, offline failure/retry, source eligibility and lifecycle guards PASS')
{
 const sequence=[0,.99,.99,0,.99,.3,.99,0,0,.99,0,.7],s=setup({random:()=>sequence.shift()??.5})
 const mixed=structuredClone(payload);mixed.writingTasks=mixed.writingTasks.slice(0,2)
 for(const key of ['listeningTests','readingTests','writingTasks','speakingSets'])mixed[key]=[...mixed[key],...mixed[key].map(t=>({...t,id:t.id.replace('cam15','cam16'),title:t.title.replace('cam15','cam16'),book:16}))]
 s.respond(async()=>mixed)
 const first=await s.api.newExam('random-exam'),stable=JSON.stringify(first.sources)
 assert.deepEqual(JSON.parse(stable),{listening:'cam15-l-test1',reading:'cam16-r-test1',writing:['cam16-w-test1-task1','cam15-w-test1-task2'],speaking:'cam16-s-test1'},'random exam assembles independent modules, not one randomly selected complete set')
 assert.equal(JSON.stringify(s.api.readExam(first.key).sources),stable,'restoring an exam never redraws its sources')
 const next=await s.api.newExam('random-exam');assert.notDeepEqual(JSON.parse(JSON.stringify(next.sources)),JSON.parse(stable));assert.notEqual(next.key,first.key)
 assert.deepEqual(Array.from(s.creates[0].data.manifest.writingSourceIds),Array.from(first.sources.writing))
}
{
 const s=setup(),mixed={...payload,readingTests:[task('cam16-r-test1',{book:16})],speakingSets:[task('cam17-s-test1',{book:17})]};s.respond(async()=>mixed)
 assert.equal((await s.api.examChoices()).length,0)
 assert.ok((await s.api.newExam('random-exam')).key,'random assembly still works when no complete same-test set exists')
}
console.log('Random assembly: independent cross-paper sources, new draws, fixed restored attempts and no same-test dependency PASS')
for(const mutation of ['owner','cancel']){
 const s=setup(),capability=deferred();let cancelled=false;s.respond(async()=>payload);s.respondCreate(()=>capability.promise)
 const result=s.api.newExam('random-exam',undefined,{cancelled:()=>cancelled}).catch(e=>e);await settle();assert.equal(s.creates.length,1)
 if(mutation==='owner')s.r.storage.set('stemistUser',{id:'new-owner'});else cancelled=true
 capability.resolve({examId:'late-exam',examToken:'synthetic-capability'})
 assert.match((await result).message,/账号已变化|取消/)
 assert.equal([...s.r.storage.keys()].filter(k=>k.startsWith(s.api.PREFIX)).length,0,'late capability must not persist into another account or a cancelled page')
}
console.log('Late exam-create response: owner change and cancelled page never persist a local exam PASS')
