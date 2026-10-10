import assert from 'node:assert/strict'
import fs from 'node:fs'
import {deferred,miniRuntime,settle} from './helpers/mini-runtime.mjs'

const routeId='ap-physics-1-mcq-study',topicId='ap-p1-ek-1-a',questionId='ap1-2017-q1',sessionId='cps_00000000-0000-4000-8000-000000000001'
const catalogPayload={schemaVersion:'curriculum-practice-catalog.v1',releaseId:'apib-release-20261004',routes:[
 {id:routeId,board:'ap',course:'physics-1',label:'AP Physics 1 MCQ',authority:'ai-provisional',formalProgressEligible:false,questionCount:40,topics:[{id:topicId,label:'Essential Knowledge 1.A',sourceId:'1.A',dimension:'official-essential-knowledge',routeId,questionCount:12}]},
 {id:'ap-physics-c-em-mcq-study',board:'ap',course:'physics-c-em',label:'AP Physics C: Electricity and Magnetism MCQ',authority:'ai-provisional',formalProgressEligible:false,questionCount:105,topics:[{id:'ap-c-em-topic-electrostatics',label:'Electrostatics',sourceId:'Electrostatics',dimension:'official-topic',routeId:'ap-physics-c-em-mcq-study',questionCount:20}]},
]}
const regionSha='b'.repeat(64),regionUrl=`/api/stem/curriculum-practice/source/${encodeURIComponent(questionId)}/asset_ap1_q1/${regionSha}.png`
const questionPayload={question:{id:questionId,paperId:'ap-physics-1-2017',questionNumber:1,routeId,topicIds:[topicId],answerMode:'single',options:['A','B','C','D'],source:{questionPdfSha256:'a'.repeat(64),pages:[1],regions:[{assetId:'asset_ap1_q1',url:regionUrl,sha256:regionSha,bytes:2048,width:1200,height:800,page:1,region:[0,0,1200,800]}]},quality:{label:'AI checked',authority:'ai-provisional',formalProgressEligible:false}}}
const draftSession={id:sessionId,routeId,topicId,status:'draft',questionIds:[questionId,'ap1-2017-q2'],questionCount:2,createdAt:'2026-10-04T00:00:00.000Z',updatedAt:'2026-10-04T00:00:00.000Z'}
const submittedSession={...draftSession,status:'submitted',answers:[{questionId,selectedOptions:['A'],unanswered:false},{questionId:'ap1-2017-q2',selectedOptions:[],unanswered:true}],result:{score:1,maxScore:2,items:[{questionId,correct:true,unanswered:false},{questionId:'ap1-2017-q2',correct:false,unanswered:true}]},submittedAt:'2026-10-04T00:05:00.000Z',updatedAt:'2026-10-04T00:05:00.000Z'}
const clone=value=>JSON.parse(JSON.stringify(value))

function serviceRuntime({getJson,requestJson}={}){
 const calls=[]
 const api={
  getJson:async(path,options)=>{calls.push({kind:'get',path,options});return getJson?getJson(path,options):path.includes('/questions/')?clone(questionPayload):path.endsWith('/history')?{sessions:[clone(submittedSession)]}:path.includes('/sessions/')?{session:clone(draftSession)}:{...clone(catalogPayload),routes:[clone(catalogPayload.routes[0])]}},
  requestJson:async(path,body,options)=>{calls.push({kind:'post',path,body,options});if(requestJson)return requestJson(path,body,options);return path.endsWith('/submit')?{session:clone(submittedSession),duplicate:false}:{session:clone(draftSession)}},
 }
 const runtime=miniRuntime({modules:{'utils/api':api,'utils/apiOrigin':{DEFAULT_API_BASE:'https://stem.ieltsist.com',safeApiBase:()=>''}}})
 runtime.storage.set('stemistUser',{id:'student-a'});runtime.storage.set('stemistSessionToken','token-a')
 return{...runtime,calls,service:runtime.load('bundles/curricula/practiceService')}
}

{
 const h=serviceRuntime(),catalog=await h.service.fetchCatalog({routeId,topicId})
 assert.equal(h.calls[0].path,`/api/stem/curriculum-practice/catalog?routeId=${encodeURIComponent(routeId)}&topicId=${encodeURIComponent(topicId)}`)
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].options)),{timeout:12000,stemAuth:false})
 assert.equal(catalog.routes[0].id,routeId);assert.equal(catalog.routes[0].questionCount,40);assert.equal(catalog.routes[0].topics[0].questionCount,12);assert.equal(catalog.routes[0].formalProgressEligible,false)
 const question=await h.service.fetchQuestion(questionId)
 assert.equal(h.calls[1].path,`/api/stem/curriculum-practice/questions/${encodeURIComponent(questionId)}`);assert.equal(h.calls[1].options.stemAuth,false)
 assert.equal(question.source.regions[0].imageUrl,'https://stem.ieltsist.com'+regionUrl);assert.deepEqual([...question.options],['A','B','C','D']);assert.equal(question.quality.formalProgressEligible,false)
 for(const edit of [
  value=>{value.routes[0].authority='official'},value=>{value.routes[0].formalProgressEligible=true},value=>{value.routes[0].id='other-route'},value=>{value.routes[0].topics[0].routeId='other-route'},value=>{value.routes[0].topics[0].questionCount=-1},
 ]){const value=clone(catalogPayload);edit(value);assert.throws(()=>h.service.normalizeCatalog(value),/题库|练习|目录/)}
 for(const edit of [
  value=>{value.question.answerKey='A'},value=>{value.question.options=['B','A']},value=>{value.question.quality.authority='official'},value=>{value.question.quality.formalProgressEligible=true},value=>{value.question.source.questionPdfSha256='bad'},value=>{value.question.source.regions[0].url=`/api/stem/curriculum-practice/source/${questionId}/asset_ap1_q1`},value=>{value.question.source.regions[0].url=`/api/stem/curriculum-practice/source/other/asset_ap1_q1/${regionSha}.png`},value=>{value.question.source.regions[0].sha256='c'.repeat(64)},value=>{value.question.source.regions[0].url=`/api/stem/curriculum-practice/source/${questionId}/asset_ap1_q1/${'c'.repeat(64)}.png`},value=>{value.question.source.regions[0].url=`/api/stem/curriculum-practice/source/${questionId}/other_asset/${regionSha}.png`},value=>{value.question.source.regions[0].region=[0,0,0,1]},
 ]){const value=clone(questionPayload);edit(value);assert.throws(()=>h.service.normalizeQuestion(value,questionId),/题目|原图|来源|练习/)}
}

{
 const h=serviceRuntime(),scope=h.service.scope();assert.deepEqual(JSON.parse(JSON.stringify(scope)),{owner:'student-a',epoch:0})
 const created=await h.service.createSession({routeId,topicId,count:2},scope);assert.equal(created.id,sessionId);assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].body)),{routeId,topicId,count:2})
 const restored=await h.service.getSession(sessionId,scope);assert.equal(restored.status,'draft')
 const history=await h.service.fetchHistory(scope);assert.equal(history[0].result.score,1)
 const submitted=await h.service.submitSession(sessionId,{submissionId:'submission-mini-0001',answers:[{questionId,selectedOptions:['A']}],confirmUnanswered:true},scope)
 assert.equal(submitted.session.status,'submitted');assert.equal(submitted.session.result.score,1);assert.equal(submitted.duplicate,false)
 assert.equal(h.calls.at(-1).body.submissionId,'submission-mini-0001');assert.equal(h.calls.at(-1).body.confirmUnanswered,true)
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls.at(-1).body.answers)),[{questionId,selectedOptions:['A']}])
 for(const edit of [value=>{value.session.result.items[0].correctOption='A'},value=>{value.session.result.maxScore=3},value=>{value.session.answers[0].selectedOptions=['D','A']},value=>{value.session.routeId='other-route'}]){const value={session:clone(submittedSession),duplicate:false};edit(value);assert.throws(()=>h.service.normalizeSubmit(value,{sessionId,routeId,questionIds:draftSession.questionIds}),/结果|练习|会话/)}
}

{
 const h=serviceRuntime(),scope=h.service.scope(),draft=h.service.createDraft(draftSession,scope,{routeLabel:'AP Physics 1 MCQ',topicLabel:'Essential Knowledge 1.A'})
 draft.answers[questionId]=['A'];draft.index=1;h.service.saveDraft(draft,scope)
 assert.deepEqual([...h.service.readDraft(sessionId,scope).answers[questionId]],['A']);assert.equal(h.service.recentDraft(scope,routeId).sessionId,sessionId)
 h.storage.set('stemistUser',{id:'student-b'});assert.equal(h.service.readDraft(sessionId,h.service.scope()),null);assert.equal(h.service.recentDraft(h.service.scope(),routeId),null)
 h.storage.set('stemistUser',{id:'student-a'});const restored=h.service.readDraft(sessionId,h.service.scope());restored.answers[questionId]=['B'];restored.submissionId='submission-mini-0001';h.service.saveDraft(restored,h.service.scope());assert.equal(h.service.readDraft(sessionId,h.service.scope()).submissionId,'submission-mini-0001')
 assert.match(h.service.newSubmissionId(),/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/)
 const submittedDraft=h.service.createDraft(submittedSession,h.service.scope(),{});submittedDraft.answers={[questionId]:['A']};h.service.saveDraft(submittedDraft,h.service.scope());const draftKey=[...h.storage.keys()].find(key=>key.includes(encodeURIComponent(sessionId))&&!key.includes('recent:')),tampered=clone(h.storage.get(draftKey));tampered.result.items[0].correctOption='A';h.storage.set(draftKey,tampered);assert.equal(h.service.readDraft(sessionId,h.service.scope()),null,'local storage cannot inject an answer or invented result field');const contradictory=clone(submittedDraft);contradictory.result.items[0]={questionId,correct:false,unanswered:true};contradictory.result.score=0;h.storage.set(draftKey,contradictory);assert.equal(h.service.readDraft(sessionId,h.service.scope()),null,'a locally selected answer cannot be relabelled as unanswered')
}

{
 const gate=deferred(),h=serviceRuntime({getJson:()=>gate.promise}),scope=h.service.scope(),pending=h.service.getSession(sessionId,scope)
 h.storage.set('stemistUser',{id:'student-b'});h.storage.set('stemistSessionToken','token-b');gate.resolve({session:clone(draftSession)})
 await assert.rejects(pending,/账号/)
 const guest=serviceRuntime();guest.storage.delete('stemistSessionToken');guest.storage.delete('stemistUser');await assert.rejects(()=>guest.service.createSession({routeId,count:1},guest.service.scope()),/登录/);assert.equal(guest.calls.length,0)
}
{
 const h=serviceRuntime({requestJson:async()=>({session:{...clone(draftSession),questionIds:[questionId],questionCount:1}})});await assert.rejects(()=>h.service.createSession({routeId,topicId,count:2},h.service.scope()),/会话|范围|题量/)
}

console.log('Curriculum practice service contract passed.')

const secondQuestion={...clone(questionPayload.question),id:'ap1-2017-q2',questionNumber:2,answerMode:'multiple',options:['A','B','C','D','E'],source:{...clone(questionPayload.question.source),regions:[{...clone(questionPayload.question.source.regions[0]),assetId:'asset_ap1_q2',url:`/api/stem/curriculum-practice/source/ap1-2017-q2/asset_ap1_q2/${regionSha}.png`,imageUrl:`https://stem.ieltsist.com/api/stem/curriculum-practice/source/ap1-2017-q2/asset_ap1_q2/${regionSha}.png`}]}}
function pageRuntime({recent=null,questionGate=null,failFirstSubmit=false,failAnswerSave=false,submitError=null}={}){
 const serviceCalls=[],modalCalls=[];let saved=recent?clone(recent):null,submissionCalls=0
 const session={...clone(draftSession),questionIds:[questionId,secondQuestion.id],questionCount:2}
 const service={
  scope:()=>({owner:'student-a',epoch:0}),current:()=>true,
  fetchCatalog:async()=>clone(catalogPayload),fetchHistory:async()=>[clone(submittedSession)],
  createSession:async(input)=>{serviceCalls.push({kind:'create',input:clone(input)});return clone(session)},
  getSession:async id=>{serviceCalls.push({kind:'getSession',id});return id===sessionId?clone(session):clone(submittedSession)},
  fetchQuestion:async id=>{serviceCalls.push({kind:'question',id});if(questionGate)return questionGate.promise;return clone(id===questionId?{...questionPayload.question,source:{...questionPayload.question.source,regions:questionPayload.question.source.regions.map(region=>({...region,imageUrl:'https://stem.ieltsist.com'+region.url}))}}:secondQuestion)},
  createDraft:(value,scope,labels)=>({schemaVersion:'stemist-curriculum-practice-draft-v1',owner:scope.owner,epoch:scope.epoch,sessionId:value.id,routeId:value.routeId,topicId:value.topicId,routeLabel:labels.routeLabel,topicLabel:labels.topicLabel,questionIds:value.questionIds.slice(),index:0,answers:{},status:value.status,result:value.result||null,submissionId:'',createdAt:value.createdAt,updatedAt:Date.now()}),
  saveDraft:value=>{if(failAnswerSave&&Object.keys(value.answers||{}).length)throw Error('本机空间不足，选择题答案尚未保存。');saved=clone(value);serviceCalls.push({kind:'save',draft:clone(value)});return clone(value)},readDraft:id=>saved?.sessionId===id?clone(saved):null,recentDraft:()=>saved?clone(saved):null,newSubmissionId:()=> 'submission-mini-fixed-0001',
  submitSession:async(id,input)=>{submissionCalls++;serviceCalls.push({kind:'submit',id,input:clone(input)});if(submitError)throw submitError;if(failFirstSubmit&&submissionCalls===1)throw Error('网络连接失败，答案已保留。');return{session:clone(submittedSession),duplicate:submissionCalls>1}},
 }
 const runtime=miniRuntime({
  wx:{showModal:options=>{modalCalls.push(options);options.success?.({confirm:true,cancel:false})},pageScrollTo(){},previewImage(){},showToast(){}},
  modules:{'bundles/curricula/practiceService':service,'utils/page':{deviceState:value=>({deviceClass:'device-phone',orientation:'portrait',isTablet:false,...value}),syncDevice(){}}},
 })
 runtime.storage.set('stemistUser',{id:'student-a'});runtime.storage.set('stemistSessionToken','token-a')
 const page=runtime.page('bundles/curricula/practice')
 assert.notEqual(typeof page.route,'function','Application methods must not shadow native Page.route metadata')
 page.route='bundles/curricula/practice'
 return{...runtime,page,serviceCalls,modalCalls,get saved(){return saved}}
}

{
 const h=pageRuntime({failFirstSubmit:true});await h.page.onLoad({routeId});await settle()
 assert.equal(h.page.data.phase,'setup');assert.equal(h.page.data.routeId,routeId);assert.equal(h.page.data.routeOptions.length,2);assert.equal(h.page.data.count,10);assert.deepEqual([...h.page.data.countOptions.map(item=>item.value)],[1,5,10,20,30,40])
 h.page.chooseRoute({detail:{value:1}});assert.equal(h.page.data.routeId,'ap-physics-c-em-mcq-study');assert.deepEqual([...h.page.data.countOptions.map(item=>item.value)],[1,5,10,20,30,40,50],'UI must never offer a count above the authenticated API maximum');h.page.chooseRoute({detail:{value:0}})
 await h.page.start();assert.equal(h.page.data.phase,'practice');assert.equal(h.page.data.total,2);assert.equal(h.page.data.question.id,questionId);assert.equal(h.page.data.question.sourceLabel,'2017 · AP Physics 1 MCQ');assert.equal(h.page.data.question.source.regions.length,1);assert.deepEqual(h.serviceCalls.filter(call=>call.kind==='question').map(call=>call.id),[questionId],'only the current question may load')
 h.page.toggleOption({currentTarget:{dataset:{option:'A'}}});h.page.toggleOption({currentTarget:{dataset:{option:'B'}}});assert.deepEqual([...h.page.data.selectedOptions],['B']);assert.equal(h.page.data.answeredCount,1)
 await h.page.next();assert.equal(h.page.data.question.id,secondQuestion.id);h.page.toggleOption({currentTarget:{dataset:{option:'C'}}});h.page.toggleOption({currentTarget:{dataset:{option:'A'}}});assert.deepEqual([...h.page.data.selectedOptions],['A','C']);assert.equal(h.page.data.selectionCount,2);h.page.toggleOption({currentTarget:{dataset:{option:'A'}}});h.page.toggleOption({currentTarget:{dataset:{option:'C'}}});assert.deepEqual([...h.page.data.selectedOptions],[])
 const firstSubmitId=h.saved.submissionId;await h.page.submit();assert.equal(h.modalCalls.length,1,'incomplete practice requires an explicit visible confirmation');assert.match(h.page.data.error,/网络/);assert.equal(h.saved.submissionId,'submission-mini-fixed-0001');const retryId=h.saved.submissionId
 await h.page.submit();const submits=h.serviceCalls.filter(call=>call.kind==='submit');assert.equal(submits.length,2);assert.equal(submits[0].input.submissionId,retryId);assert.equal(submits[1].input.submissionId,retryId,'retry must keep the same idempotency key');assert.equal(submits[1].input.confirmUnanswered,true);assert.equal(h.page.data.phase,'result');assert.equal(h.page.data.result.score,1);assert.equal(firstSubmitId,'')
 const share=h.page.onShareAppMessage();assert.match(share.path,new RegExp('routeId='+routeId));assert.doesNotMatch(share.path,/session|answer|submission|selected/i)
 await h.page.previous();assert.equal(h.page.data.question.id,questionId);assert.equal(h.serviceCalls.filter(call=>call.kind==='question').length,2,'visited questions use the bounded local cache without preloading')
}

{
 const seed={schemaVersion:'stemist-curriculum-practice-draft-v1',owner:'student-a',epoch:0,sessionId,routeId,topicId,routeLabel:'AP Physics 1 MCQ',topicLabel:'Essential Knowledge 1.A',questionIds:[questionId,secondQuestion.id],index:1,answers:{[questionId]:['B']},status:'draft',result:null,submissionId:'',createdAt:draftSession.createdAt,updatedAt:Date.now()}
 const h=pageRuntime({recent:seed});await h.page.onLoad({routeId});await settle();assert.equal(h.page.data.resumeVisible,true);assert.match(h.page.data.resumeLabel,/1 \/ 2/);await h.page.resume();assert.equal(h.page.data.phase,'practice');assert.equal(h.page.data.index,1);assert.equal(h.page.data.answeredCount,1)
}

{
 const gate=deferred(),h=pageRuntime({questionGate:gate}),loaded=h.page.onLoad({routeId});await loaded;const pending=h.page.start();await settle();h.page.onUnload();gate.resolve(clone(questionPayload.question));await pending;assert.equal(h.page.data.question,null,'late question data cannot render after unload')
}
{
 const h=pageRuntime();await h.page.onLoad({routeId});await h.page.start()
 h.page.imageLoaded({currentTarget:{dataset:{id:'asset_ap1_q1'}}})
 assert.equal(h.page.data.question.source.regions[0].loaded,true)
 h.page.toggleOption({currentTarget:{dataset:{option:'A'}}});await h.page.submit()
 assert.equal(h.page.data.question.source.regions[0].loaded,true,'result re-render must preserve a real onLoad state for the same immutable image')
 const changed={...h.page.data.question,options:h.page.data.question.options.map(item=>item.value),source:{...h.page.data.question.source,regions:h.page.data.question.source.regions.map(region=>({...region,imageUrl:region.imageUrl+'?fixture=changed'}))}}
 h.page.renderQuestion(changed,0)
 assert.equal(h.page.data.question.source.regions[0].loaded,false,'a changed image URL still requires a real image load event')
}
{
 const h=pageRuntime({failAnswerSave:true});await h.page.onLoad({routeId});await h.page.start();h.page.toggleOption({currentTarget:{dataset:{option:'A'}}});assert.deepEqual([...h.page.data.selectedOptions],[],'an unsaved answer cannot masquerade as durable');assert.match(h.page.data.error,/本机空间/)
}
{
 const error=Object.assign(Error('This session belongs to a stale release.'),{code:'curriculum_practice_release_mismatch',statusCode:409}),h=pageRuntime({submitError:error});await h.page.onLoad({routeId});await h.page.start();h.page.toggleOption({currentTarget:{dataset:{option:'A'}}});await h.page.submit();assert.match(h.page.data.error,/题库版本已更新/);assert.doesNotMatch(h.page.data.error,/session|release/i);assert.deepEqual([...h.page.data.selectedOptions],['A']);assert.deepEqual([...h.saved.answers[questionId]],['A'],'localized failure preserves the selected choice')
}

const root=new URL('..',import.meta.url),practiceWxml=fs.readFileSync(new URL('bundles/curricula/practice.wxml',root),'utf8'),practiceWxss=fs.readFileSync(new URL('bundles/curricula/practice.wxss',root),'utf8'),practiceJson=JSON.parse(fs.readFileSync(new URL('bundles/curricula/practice.json',root),'utf8'))
assert.match(practiceWxml,/lazy-load="\{\{true\}\}"/);assert.match(practiceWxml,/question\.options/);assert.match(practiceWxml,/已作答/);assert.match(practiceWxml,/不计正式/);assert.match(practiceWxml,/selectedOptions\.length/);assert.match(practiceWxml,/retryQuestion/);assert.match(practiceWxml,/AI 核对 · 不计正式进度或成绩/);assert.match(practiceWxml,/练习范围/);assert.match(practiceWxml,/question\.sourceLabel/);assert.doesNotMatch(practiceWxml,/question\.paperId/)
assert.match(practiceWxss,/\.answer-option[^}]*min-height:\s*48px/);assert.match(practiceWxss,/\.device-tablet\.landscape \.practice-layout[^}]*grid-template-columns:/);assert.match(practiceWxss,/\.device-phone \.practice-layout[^}]*display:\s*block/)
assert.equal(practiceJson.enableShareAppMessage,true);assert.equal(practiceJson.enableShareTimeline,undefined);assert.equal(practiceJson.usingComponents['stemist-header'],'/components/stemist-header/index');assert.equal(practiceJson.usingComponents['app-nav'],'/components/app-nav/index')
console.log('Curriculum practice page: setup, lazy questions, drafts, multiple choice, retry, results, sharing and responsive contracts passed.')

function indexRuntime({board='ap',practiceCatalog=catalogPayload,practiceError=null}={}){
 const practiceCalls=[]
 const runtime=miniRuntime({modules:{
  'bundles/curricula/service':{KNOWN_BOARDS:{ap:'AP',ib:'IB'},fetchCurriculumPapers:async()=>({items:[],courses:[{id:'physics-1',label:'AP Physics 1',subject:'Physics'},{id:'physics-c-em',label:'AP Physics C: Electricity and Magnetism',subject:'Physics'},{id:'calculus-ab',label:'AP Calculus AB',subject:'Mathematics'}],filters:{levels:[],years:[],sessions:[],papers:[]},summary:{papers:0,downloadable:0,sourceOnly:0},total:0,page:1,pages:0})},
  'bundles/curricula/practiceService':{fetchCatalog:async filters=>{practiceCalls.push(filters);if(practiceError)throw practiceError;return clone(practiceCatalog)}},
  'utils/page':{deviceState:value=>({deviceClass:'device-phone',orientation:'portrait',isTablet:false,...value}),syncDevice(){}},
  'utils/pdfDownload':{formatBytes:value=>String(value),initialPdfDownloadState:()=>({visible:false,active:false,itemId:''}),createPdfDownloadController:()=>({setScope(){},resume(){},suspend(){},dispose(){}})},
 }})
 const page=runtime.page('bundles/curricula/index')
 return{...runtime,page,practiceCalls,load:()=>page.onLoad({board})}
}
{
 const h=indexRuntime();await h.load();await settle();assert.equal(h.practiceCalls.length,1);assert.equal(h.page.data.practiceRoutes.length,2);assert.equal(h.page.data.visiblePracticeRoutes.length,2);assert.equal(h.page.data.practiceExpanded,false);assert.equal(h.page.data.practiceRoutes[0].questionCount,40);h.page.togglePractice();assert.equal(h.page.data.practiceExpanded,true);h.page.openPractice({currentTarget:{dataset:{route:routeId}}});assert.equal(h.calls.at(-1).url,`/bundles/curricula/practice?routeId=${routeId}`)
 const physicsOne=h.page.data.courseOptions.findIndex(option=>option.value==='physics-1');await h.page.chooseCourse({detail:{value:physicsOne}});assert.deepEqual([...h.page.data.visiblePracticeRoutes.map(route=>route.course)],['physics-1']);assert.equal(h.page.data.practiceExpanded,false)
 const calculus=h.page.data.courseOptions.findIndex(option=>option.value==='calculus-ab');await h.page.chooseCourse({detail:{value:calculus}});assert.equal(h.page.data.visiblePracticeRoutes.length,0,'unrelated Physics practice must disappear for Calculus')
 const ib=indexRuntime({board:'ib'});await ib.load();await settle();assert.equal(ib.practiceCalls.length,0);assert.equal(ib.page.data.practiceRoutes.length,0)
 const empty=indexRuntime({practiceCatalog:{...catalogPayload,routes:catalogPayload.routes.map(route=>({...route,questionCount:0}))}});await empty.load();await settle();assert.equal(empty.page.data.practiceRoutes.length,0,'entry remains hidden without actual released questions')
 const failed=indexRuntime({practiceError:Error('practice unavailable')});await failed.load();await settle();assert.equal(failed.page.data.practiceRoutes.length,0);assert.equal(failed.page.data.error,'','practice discovery failure must not break the PDF library')
}
const indexWxml=fs.readFileSync(new URL('bundles/curricula/index.wxml',root),'utf8'),indexWxss=fs.readFileSync(new URL('bundles/curricula/index.wxss',root),'utf8')
assert.match(indexWxml,/选择题练习/);assert.match(indexWxml,/visiblePracticeRoutes/);assert.match(indexWxml,/practiceExpanded/);assert.match(indexWxml,/不计正式/);assert.doesNotMatch(indexWxml,/item\.questionCount|item\.topicCount/);assert.match(indexWxss,/\.practice-entry/)
console.log('Curriculum index exposes practice only for real AP catalog counts without changing the PDF library contract.')
const nativeQaSource=fs.readFileSync(new URL('scripts/test-curriculum-practice-native-live.cjs',root),'utf8')
assert.match(nativeQaSource,/--expected-device/);assert.match(nativeQaSource,/--expected-orientation/);assert.match(nativeQaSource,/\.practice-progress/);assert.match(nativeQaSource,/\.submit-practice/);assert.match(nativeQaSource,/windowWidth/);assert.match(nativeQaSource,/tabletNativeVerified/);assert.doesNotMatch(nativeQaSource,/automation_page_action[^\n]*setData|deviceClass:\s*['"]device-tablet/)
