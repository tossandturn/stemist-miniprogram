import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime, deferred, settle } from './helpers/mini-runtime.mjs'

const routeId = 'cie-9702-as-physics'
const spec = { routeId, stage: 'AS', subjectCode: '9702', components: [1, 2], syllabusTopicIds: ['t1', 't2'], questionCount: 6 }
const ids = (start, count) => Array.from({ length: count }, (_, i) => `q${i + start}`)
function inventory() {
  return { routeId, paperComponents: [1, 2], topics: [
    { id: 't1', name: 'Units', questionIdsByComponent: { 1: { verifiedQuestionIds: ids(0, 7) }, 2: { verifiedQuestionIds: ids(7, 5) } } },
    { id: 't2', name: 'Motion', questionIdsByComponent: { 1: { verifiedQuestionIds: ids(0, 6) }, 2: { verifiedQuestionIds: ids(12, 6) } } },
  ] }
}
function payload() {
  return { schemaVersion: 'syllabus-practice-set-v1', ...spec, practiceMode: 'verified', formalProgressEligible: true,
    questionGroups: ids(0, 6).map(id => ({ id, routeId, stage: 'AS', subjectCode: '9702', paperComponent: 2, questionNumber: id, totalMarks: 2,
      studentStudyEligible: true, sourceContent: { complete: true, fileComplete: true, assetUrls: [`/question-assets/paper/qp-1.jpg`] },
      sourceRef: { paperId: 'paper', paper: 'paper.pdf', year: 2025, season: 'Nov' },
      syllabusMapping: { topicIds: ['t1'] },
      parts: [{ partId: `${id}:a`, label: 'a', marks: 2, answerKey: 'SECRET ANSWER', markSchemePoints: ['SECRET RUBRIC'], aiAssistedMarkingAvailable: true,
        markingProvenance: { sourceQuestionId: id, questionPartId: `${id}:a`, bindingSignature: 'bound' } }],
    })) }
}
const originalTopicId='t-original',originalId=`original-foundation:${routeId}:${originalTopicId}:v1`,originalPartId=originalId+':part-1'
const chapterSpec={routeId,stage:'AS',subjectCode:'9702',components:[1,2],syllabusTopicIds:[originalTopicId],questionCount:1,studyMode:'chapter-study',sourcePreference:'official-first'}
const answerContract={schemaVersion:'stem-original-foundation-answer-contract-v1',id:originalId+':answer:v1',responseType:'single-choice',submissionEndpoint:'/api/stem/original-foundation/submit',maxScore:1,scoreScope:'original-learning-only',reveal:'after-submission'}
function originalPayload(){
 const options=['A','B','C','D'].map((id,index)=>({id,text:['Speed','Velocity','Distance','Time'][index]}))
 return{schemaVersion:'syllabus-practice-set-v1',routeId,stage:'AS',subjectCode:'9702',studyMode:'chapter-study',sourcePreference:'official-first',practiceMode:'study-only',formalProgressEligible:false,
  selectedSyllabusTopicIds:[originalTopicId],available:1,count:1,limited:false,sourceAvailability:{official:0,originalFoundation:1,total:1,selectedPool:1},sourceMix:{official:0,originalFoundation:1},questionGroupIds:[originalId],questionGroups:[{
   id:originalId,questionGroupId:originalId,routeId,sourceKind:'original-foundation',sourceAuthority:'original-foundation-catalog',displaySourceLabel:'原创基础练习',studentStudyEligible:true,studyOnly:true,formalProgressEligible:false,
   originalQuestion:{schemaVersion:'stem-original-foundation-question-v1',catalogVersion:'v1',id:originalId,routeId,stage:'AS',subject:'Physics',subjectCode:'9702',topicId:originalTopicId,topicName:'Motion',sourceKind:'original-foundation',sourceAuthority:'original-foundation-catalog',displaySourceLabel:'原创基础练习',foundationBasis:'curated-foundation',prompt:'Which quantity includes direction?',answerType:'single-choice',options,responseContract:{kind:'single-choice',optionIds:['A','B','C','D']},answerContract,formalProgressEligible:false,countsTowardFormalGrade:false},
   answerContract,parts:[{partId:originalPartId,label:'main',marks:1,sourceQuestionId:originalId,questionGroupId:originalId,sourceKind:'original-foundation',sourceAuthority:'original-foundation-catalog',displaySourceLabel:'原创基础练习',originalQuestionId:originalId,originalCatalogVersion:'v1',sourceBindingProvenance:{schemaVersion:'stem-original-foundation-binding-v1',sourceQuestionId:originalId,questionPartId:originalPartId,bindingSignature:'original:'+'a'.repeat(64),reviewVersion:'v1'}}]
  }]}
}
function chapterInventory(){return{routeId,paperComponents:[1,2],practicePolicy:{schemaVersion:'stem-topic-practice-policy-v1',minSourceGroups:6,minReviewedGroups:12,setSizes:[6,10,15],chapterStudy:{mode:'chapter-study',minSourceGroups:1,maxSourceGroups:15,countPolicy:'cap-to-available',formalProgressEligible:false,sourcePreferences:['official-first','original-foundation-only']}},chapterStudy:{mode:'chapter-study',catalogVersion:'v1',topicCount:2,startableTopicCount:2,gapTopicIds:[originalTopicId]},topics:[
 {id:'t-official',name:'Units',chapterStudy:{mode:'chapter-study',available:2,officialAvailable:2,originalAvailable:0,startable:true,fallbackKind:null},componentCounts:{1:{chapterStudy:{mode:'chapter-study',available:1,officialAvailable:1,originalAvailable:0,startable:true,fallbackKind:null}},2:{chapterStudy:{mode:'chapter-study',available:1,officialAvailable:1,originalAvailable:0,startable:true,fallbackKind:null}}},questionIdsByComponent:{}},
 {id:originalTopicId,name:'Motion',chapterStudy:{mode:'chapter-study',available:1,officialAvailable:0,originalAvailable:1,startable:true,fallbackKind:'original-foundation'},componentCounts:{1:{chapterStudy:{mode:'chapter-study',available:1,officialAvailable:0,originalAvailable:1,startable:true,fallbackKind:'original-foundation'}},2:{chapterStudy:{mode:'chapter-study',available:1,officialAvailable:0,originalAvailable:1,startable:true,fallbackKind:'original-foundation'}}},questionIdsByComponent:{}}
]}}
const originalResult=(selectedOptionId='B')=>({schemaVersion:'stem-original-foundation-result-v1',routeId,syllabusTopicId:originalTopicId,questionId:originalId,selectedOptionId,correct:selectedOptionId==='B',score:selectedOptionId==='B'?1:0,maxScore:1,scoreScope:'original-learning-only',formalProgressEligible:false,countsTowardFormalGrade:false,correctOptionId:'B',solution:{summary:'Velocity includes direction.',markPoints:[{id:'direction',awarded:selectedOptionId==='B',marks:selectedOptionId==='B'?1:0,maxMarks:1,reason:'Identifies velocity as a vector.'}]},ownerId:'student-a'})
const v2Kinds=[['concept','retrieve'],['application','apply'],['transfer','transfer']]
const chapterSpecV2={...chapterSpec,questionCount:3,foundationCatalog:'v2'}
function originalPayloadV2(){
 const groups=v2Kinds.map(([itemKind,skillFocus],index)=>{
  const id=`original-foundation:${routeId}:${originalTopicId}:v2:${itemKind}`,partId=id+':part-1',answer={schemaVersion:'stem-original-foundation-answer-contract-v2',id:id+':answer:v2',responseType:'single-choice',submissionEndpoint:'/api/stem/original-foundation/submit',maxScore:1,scoreScope:'original-learning-only',reveal:'after-submission',foundationCatalog:'v2'},options=['A','B','C','D'].map((id,n)=>({id,text:`${itemKind} option ${n+1}`}))
  const misconceptionId=itemKind==='transfer'?'vector-scalar':null
  return{id,questionGroupId:id,routeId,sourceKind:'original-foundation',sourceAuthority:'original-foundation-catalog',displaySourceLabel:'原创基础练习',studentStudyEligible:true,studyOnly:true,formalProgressEligible:false,foundationCatalog:'v2',itemKind,skillFocus,
   originalQuestion:{schemaVersion:'stem-original-foundation-question-v2',catalogVersion:'v2',foundationCatalog:'v2',id,routeId,stage:'AS',subject:'Physics',subjectCode:'9702',topicId:originalTopicId,topicName:'Motion',sourceKind:'original-foundation',sourceAuthority:'original-foundation-catalog',displaySourceLabel:'原创基础练习',foundationBasis:'curated-foundation',itemKind,skillFocus,misconceptionId,prompt:`${itemKind} prompt`,answerType:'single-choice',options,responseContract:{kind:'single-choice',optionIds:['A','B','C','D']},answerContract:answer,formalProgressEligible:false,countsTowardFormalGrade:false},answerContract:answer,
   parts:[{partId,label:'main',marks:1,sourceQuestionId:id,questionGroupId:id,sourceKind:'original-foundation',sourceAuthority:'original-foundation-catalog',displaySourceLabel:'原创基础练习',originalQuestionId:id,originalCatalogVersion:'v2',foundationCatalog:'v2',itemKind,skillFocus,sourceBindingProvenance:{schemaVersion:'stem-original-foundation-binding-v2',sourceQuestionId:id,questionPartId:partId,bindingSignature:'original:'+String(index+1).repeat(64),reviewVersion:'v2'}}]}
 })
 return{schemaVersion:'syllabus-practice-set-v1',routeId,stage:'AS',subjectCode:'9702',studyMode:'chapter-study',sourcePreference:'official-first',foundationCatalog:'v2',practiceMode:'study-only',formalProgressEligible:false,selectedSyllabusTopicIds:[originalTopicId],available:3,count:3,limited:false,sourceAvailability:{official:0,originalFoundation:3,total:3,selectedPool:3},sourceMix:{official:0,originalFoundation:3},questionGroupIds:groups.map(g=>g.id),questionGroups:groups}
}
const originalResultV2=(question,selectedOptionId='B')=>({schemaVersion:'stem-original-foundation-result-v2',foundationCatalog:'v2',catalogVersion:'v2',routeId,syllabusTopicId:originalTopicId,questionId:question.id,itemKind:question.itemKind,skillFocus:question.skillFocus,selectedOptionId,correct:selectedOptionId==='B',score:selectedOptionId==='B'?1:0,maxScore:1,scoreScope:'original-learning-only',formalProgressEligible:false,countsTowardFormalGrade:false,correctOptionId:'B',solution:{summary:'Learning summary.',explanation:'Concept explanation.',nextStep:'Try the next item.',markPoints:[{id:'learning-point',awarded:selectedOptionId==='B',marks:selectedOptionId==='B'?1:0,maxMarks:1,reason:'Server-checked response.'}]},feedback:{schemaVersion:'stem-original-foundation-feedback-v2',outcome:selectedOptionId==='B'?'correct':'incorrect',misconceptionId:question.misconceptionId,summary:'Learning feedback.',explanation:'Why the choice works.',nextStep:'Continue the chapter.'},ownerId:'student-a'})
let passed = 0
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`) }

await check('unique availability and per-topic 12-group floor, not summed or lowered', () => {
  const { selectionState } = miniRuntime().load('utils/nativePractice')
  const both = selectionState(inventory(), ['t1', 't2'], [1, 2], 6)
  assert.equal(both.availableCount, 18)
  assert.equal(both.canStart, true)
  assert.equal(selectionState(inventory(), ['t1', 't2'], [1], 6).canStart, false)
  assert.equal(selectionState(inventory(), ['t1'], [3], 6).canStart, false)
  assert.equal(selectionState(inventory(), [], [1, 2], 6).canStart, false)
})
await check('chapter-study caps presets to one selected chapter without lowering legacy gates',()=>{
 const {selectionState}=miniRuntime().load('utils/nativePractice'),inventory=chapterInventory()
 const original=selectionState(inventory,[originalTopicId],[1,2],1,'chapter-study')
 assert.deepEqual([...original.sizes],[1]);assert.equal(original.availableCount,1);assert.equal(original.canStart,true);assert.equal(original.fallbackKind,'original-foundation')
 const official=selectionState(inventory,['t-official'],[1,2],2,'chapter-study');assert.deepEqual([...official.sizes],[1,2]);assert.equal(official.canStart,true)
 assert.equal(selectionState(inventory,[originalTopicId,'t-official'],[1,2],1,'chapter-study').canStart,false,'chapter learning cannot be blocked or inflated by another selected chapter')
 assert.equal(selectionState(inventory,[originalTopicId],[1,2],1).canStart,false,'non-opt-in path retains the formal 6/12 contract')
})
await check('reject incomplete, wrong route, duplicate and malformed sets', () => {
  const { validatePracticeSet } = miniRuntime().load('utils/nativePractice')
  assert.equal(validatePracticeSet(payload(), spec).questions.length, 6)
  for (const corrupt of [p => p.routeId = 'wrong', p => p.questionGroups[0].sourceContent.complete = false, p => p.questionGroups[1] = p.questionGroups[0], p => p.questionGroups[0].sourceContent.assetUrls = ['https://evil.test/a.jpg'], p => p.questionGroups[0].sourceContent.assetUrls = ['/question-assets/other-paper/qp-1.jpg'], p => p.questionGroups.pop(), p => p.practiceMode = 'unavailable']) {
    const p = payload(); corrupt(p); assert.throws(() => validatePracticeSet(p, spec))
  }
  assert.throws(() => validatePracticeSet({}, spec))
})
await check('only current question reaches renderer; no answers or provenance in setData', () => {
  const native = miniRuntime().load('utils/nativePractice')
  const s = native.createSession(payload(), spec)
  const view = native.questionView(s, 0)
  assert.equal(view.question.id, 'q0')
  assert.equal(view.question.images.length, 1)
  assert.doesNotMatch(JSON.stringify(view), /SECRET|bindingSignature|markingProvenance|questionGroups/)
  assert.equal(view.navItems.length, 6)
})
await check('original foundation schema is strict and renders prompt/options without an official image',()=>{
 const native=miniRuntime().load('utils/nativePractice'),session=native.createSession(originalPayload(),chapterSpec),view=native.questionView(session,0)
 assert.equal(view.question.original,true);assert.equal(view.question.prompt,'Which quantity includes direction?');assert.equal(view.question.images.length,0);assert.equal(view.question.sourceLabel,'原创基础练习');assert.equal(view.question.fullPage,false)
 assert.deepEqual(view.question.options.map(item=>item.label),['A','B','C','D']);assert.doesNotMatch(JSON.stringify(view),/bindingSignature|correctOption|solution|answerContract/)
 const corruptions=[p=>p.questionGroups[0].id='invented',p=>p.questionGroups[0].originalQuestion.routeId='wrong',p=>p.questionGroups[0].originalQuestion.topicId='other',p=>p.questionGroups[0].originalQuestion.options[1].id='A',p=>p.questionGroups[0].originalQuestion.answerKey='B',p=>p.questionGroups[0].sourceRef={paperId:'fake'},p=>p.questionGroups[0].parts[0].sourceBindingProvenance.bindingSignature='bad',p=>p.formalProgressEligible=true,p=>p.questionGroupIds[0]='other']
 for(const corrupt of corruptions){const value=originalPayload();corrupt(value);assert.throws(()=>native.validatePracticeSet(value,chapterSpec))}
 const three=originalPayload();three.questionGroups[0].originalQuestion.options.pop();three.questionGroups[0].originalQuestion.responseContract.optionIds.pop();assert.equal(native.createSession(three,chapterSpec).questions[0].choiceOptions.length,3)
 const limited=originalPayload();limited.limited=true;limited.partial=true;assert.equal(native.validatePracticeSet(limited,{...chapterSpec,questionCount:3}).questions.length,1)
})
await check('v2 foundation capability admits three strictly bound learning items while v1 remains unchanged',()=>{
 const native=miniRuntime().load('utils/nativePractice'),session=native.createSession(originalPayloadV2(),chapterSpecV2)
 assert.equal(session.foundationCatalog,'v2');assert.equal(session.questions.length,3);assert.deepEqual(session.questions.map(q=>q.itemKind),['concept','application','transfer']);assert.deepEqual(session.questions.map(q=>q.skillFocus),['retrieve','apply','transfer'])
 assert.deepEqual(session.questions.map(q=>native.questionView(session,session.questions.indexOf(q)).question.kindLabel),['概念理解','应用练习','迁移练习'])
 assert.ok(session.questions.every(q=>q.images.length===0&&q.studyOnly&&q.originalCatalogVersion==='v2'))
 const corruptions=[p=>delete p.foundationCatalog,p=>delete p.questionGroups[0].foundationCatalog,p=>p.questionGroups[0].itemKind='transfer',p=>p.questionGroups[0].parts[0].skillFocus='transfer',p=>p.questionGroups[0].id=p.questionGroups[0].id.replace(':concept',':application'),p=>p.questionGroups[0].originalQuestion.foundationCatalog='v1',p=>p.questionGroups[0].originalQuestion.itemKind='transfer',p=>p.questionGroups[0].originalQuestion.skillFocus='apply',p=>p.questionGroups[0].originalQuestion.misconceptionId='invented',p=>p.questionGroups[0].answerContract.foundationCatalog='v1',p=>p.questionGroups[0].parts[0].sourceBindingProvenance.schemaVersion='stem-original-foundation-binding-v1']
 for(const corrupt of corruptions){const value=originalPayloadV2();corrupt(value);assert.throws(()=>native.validatePracticeSet(value,chapterSpecV2))}
 assert.equal(native.createSession(originalPayload(),chapterSpec).foundationCatalog,undefined,'saved/default v1 stays capability-free')
})
await check('public assembly does not forward stale bearer and timeout is not empty bank', async () => {
  let request
  const runtime = miniRuntime({ wx: { request: options => { request = options; options.fail({ errMsg: 'request:fail timeout' }) } } })
  runtime.storage.set('stemistSessionToken', 'test-token')
  await assert.rejects(runtime.load('utils/nativePractice').generatePractice(spec), /超时/)
  assert.equal(request.header.Authorization, undefined)
})
await check('chapter builder defaults new contracts and clearly labels original fallback',async()=>{
 const requests=[];const runtime=miniRuntime({modules:{'utils/inventory':{fetchRouteInventory:async()=>chapterInventory()},'utils/api':{requestJson:async(path,body)=>{requests.push({path,body});return originalPayload()}}}})
 const page=runtime.page('pages/stem/topics');page.onLoad({routeId});await settle();assert.equal(page.data.studyMode,'chapter-study','new server contract defaults to chapter learning');page.toggleTopic({currentTarget:{dataset:{id:originalTopicId}}});assert.equal(page.data.canStart,true,'one original-backed chapter starts without a mode switch');await page.start()
 assert.equal(page.data.studyMode,'chapter-study');assert.equal(page.data.topics.find(item=>item.id===originalTopicId).sourceLabel,'原创基础练习');assert.deepEqual([...page.data.counts.map(item=>item.value)],[1])
 assert.equal(requests[0].body.studyMode,'chapter-study');assert.equal(requests[0].body.sourcePreference,'official-first');assert.deepEqual([...requests[0].body.syllabusTopicIds],[originalTopicId])
 page.chooseStudyMode({currentTarget:{dataset:{mode:''}}});await page.refresh();assert.equal(page.data.studyMode,'','an explicit legacy-mode choice survives refresh')
})
await check('v2 builder requests capability, defaults to three, and shows actual official/original counts',async()=>{
 const inventoryV2=chapterInventory();inventoryV2.foundationCatalog='v2';inventoryV2.chapterStudy={...inventoryV2.chapterStudy,catalogVersion:'v2',foundationCatalog:'v2'}
 const original=inventoryV2.topics.find(t=>t.id===originalTopicId);original.chapterStudy={...original.chapterStudy,available:3,originalAvailable:3};for(const item of Object.values(original.componentCounts))item.chapterStudy={...item.chapterStudy,available:3,originalAvailable:3}
 const requests=[],runtime=miniRuntime({modules:{'utils/inventory':{fetchRouteInventory:async(route,catalog)=>{requests.push({path:'inventory',route,catalog});return inventoryV2}},'utils/api':{requestJson:async(path,body)=>{requests.push({path,body});return originalPayloadV2()}}}})
 const page=runtime.page('pages/stem/topics');page.onLoad({routeId});await settle();assert.equal(requests[0].catalog,'v2');page.toggleTopic({currentTarget:{dataset:{id:originalTopicId}}})
 assert.equal(page.data.questionCount,3);assert.equal(page.data.canStart,true);assert.deepEqual([...page.data.counts.map(item=>item.value)],[1,3]);const topic=page.data.topics.find(item=>item.id===originalTopicId);assert.equal(topic.officialAvailable,0);assert.equal(topic.originalAvailable,3)
 await page.start();assert.equal(requests[1].body.foundationCatalog,'v2');assert.equal(runtime.storage.get([...runtime.storage.keys()].find(k=>k.startsWith('stemistNativePractice:'))).foundationCatalog,'v2')
})
await check('original submit uses stateless scorer then non-formal history with revision guards',async()=>{
 const requests=[];const runtime=miniRuntime({modules:{'utils/api':{requestJson:async(path,body)=>{requests.push({path,body});if(path==='/api/stem/original-foundation/submit')return originalResult(body.response.selectedOptionId);if(path==='/api/stem/attempts')return{attempt:{attemptId:body.attemptId}};throw Error('unexpected '+path)}}}})
 const native=runtime.load('utils/nativePractice'),session=native.createSession(originalPayload(),chapterSpec);native.saveSession(session);native.saveChoice(session.id,originalId,'B')
 await assert.rejects(()=>native.markChoice(session.id,originalId),/登录/);assert.equal(requests.length,0)
 runtime.storage.set('stemistUser',{id:'student-a'});runtime.storage.set('stemistSessionToken','fixture');await native.markChoice(session.id,originalId)
 assert.deepEqual(requests.map(item=>item.path),['/api/stem/original-foundation/submit','/api/stem/attempts'])
 assert.equal(JSON.stringify(requests[0].body),JSON.stringify({routeId,syllabusTopicId:originalTopicId,questionId:originalId,response:{selectedOptionId:'B'}}))
 const history=requests[1].body;assert.equal(history.mode,'topic');assert.equal(history.paperId,undefined);assert.equal(history.studyMode,'chapter-study');assert.equal(history.sourcePreference,'official-first');assert.equal(history.markingParts.length,1);assert.equal(history.markingParts[0].unitPartId,originalPartId);assert.equal(history.markingParts[0].provenance.bindingSignature,'original:'+'a'.repeat(64));assert.equal(history.attempt.studyMode,'chapter-study');assert.equal(history.attempt.sourcePreference,history.sourcePreference);assert.equal(history.attempt.formalResult,false);assert.equal(history.attempt.scoreResult.scoreScope,'original-learning-only');assert.equal(history.attempt.answers[originalPartId],'B')
 assert.doesNotMatch(JSON.stringify(history),/markingGrant|officialScore|gradeEstimate/)
 const saved=native.readSession(session.id).answers[originalId];assert.equal(saved.objectiveResult.correct,true);assert.equal(saved.objectiveResult.correctOptionId,'B');assert.equal(saved.objectiveHistory[1].scoreScope,'original-learning-only')
})
await check('v2 scorer and history carry immutable capability and server-only learning feedback',async()=>{
 const requests=[],runtime=miniRuntime({modules:{'utils/api':{requestJson:async(path,body)=>{requests.push({path,body});if(path==='/api/stem/original-foundation/submit'){const question=originalPayloadV2().questionGroups.find(g=>g.id===body.questionId).originalQuestion;return originalResultV2(question,body.response.selectedOptionId)}if(path==='/api/stem/attempts')return{attempt:{attemptId:body.attemptId}};throw Error('unexpected '+path)}}}})
 runtime.storage.set('stemistUser',{id:'student-a'});runtime.storage.set('stemistSessionToken','fixture')
 const native=runtime.load('utils/nativePractice'),session=native.createSession(originalPayloadV2(),chapterSpecV2),question=session.questions[0];native.saveSession(session);native.saveChoice(session.id,question.id,'B');const result=await native.markChoice(session.id,question.id)
 assert.equal(requests[0].body.foundationCatalog,'v2');assert.equal(requests[1].body.foundationCatalog,'v2');assert.equal(requests[1].body.attempt.foundationCatalog,'v2');assert.equal(result.feedback.schemaVersion,'stem-original-foundation-feedback-v2');assert.equal(result.solution.explanation,'Concept explanation.');assert.equal(result.formalProgressEligible,false)
 const bad=originalResultV2(originalPayloadV2().questionGroups[0].originalQuestion);bad.itemKind='transfer';assert.throws(()=>native.validateOriginalResult(bad,{routeId,syllabusTopicId:originalTopicId,questionId:question.id,selectedOptionId:'B',optionIds:['A','B','C','D'],ownerId:'student-a',foundationCatalog:'v2',itemKind:'concept',skillFocus:'retrieve'}))
})
await check('malformed or late original score cannot overwrite a newer answer',async()=>{
 const gate=deferred(),requests=[];const runtime=miniRuntime({modules:{'utils/api':{requestJson:async(path,body)=>{requests.push({path,body});if(path==='/api/stem/original-foundation/submit')return gate.promise;return{attempt:{attemptId:body.attemptId}}}}}})
 runtime.storage.set('stemistUser',{id:'student-a'});runtime.storage.set('stemistSessionToken','fixture')
 const native=runtime.load('utils/nativePractice'),session=native.createSession(originalPayload(),chapterSpec);native.saveSession(session);native.saveChoice(session.id,originalId,'A')
 const pending=native.markChoice(session.id,originalId);await settle();native.saveChoice(session.id,originalId,'C');gate.resolve(originalResult('A'));await assert.rejects(pending,/作答或账号已变化/)
 assert.equal(native.readSession(session.id).answers[originalId].objectiveResult,null);assert.equal(requests.filter(item=>item.path==='/api/stem/attempts').length,0)
 const expected={routeId,syllabusTopicId:originalTopicId,questionId:originalId,selectedOptionId:'B',optionIds:['A','B','C','D']}
 for(const edit of [r=>r.questionId='other',r=>r.ownerId='student-b',r=>r.formalProgressEligible=true,r=>r.scoreScope='official',r=>r.correctOptionId='E',r=>r.solution.markPoints[0].marks=2,r=>r.grade='A']){const result=originalResult();edit(result);assert.throws(()=>native.validateOriginalResult(result,{...expected,ownerId:'student-a'}))}
})
await check('private session ownership and explicit logout invalidate delayed writes', () => {
  const runtime = miniRuntime()
  const native = runtime.load('utils/nativePractice')
  runtime.storage.set('stemistUser', { id: 'student-a' })
  const session = native.createSession(payload(), spec)
  native.saveSession(session)
  runtime.storage.set('stemistUser', { id: 'student-b' })
  assert.equal(native.readSession(session.id), null)
  assert.throws(() => native.saveSession(session), /账号/)
  runtime.storage.set('stemistUser', { id: 'student-a' })
  runtime.load('utils/session').clearLocalSession()
  assert.equal(native.readSession(session.id), null)
  assert.throws(() => native.saveSession(session), /结束/)
})
await check('recent practice pointers are selection-aware and legacy route pointers never cross chapters',()=>{
 const runtime=miniRuntime(),native=runtime.load('utils/nativePractice'),make=(topic)=>{const body=payload();for(const group of body.questionGroups)group.syllabusMapping.topicIds=[topic];return native.createSession(body,{...spec,syllabusTopicIds:[topic]})}
 const first=make('t1');native.saveSession(first);const second=make('t2');native.saveSession(second)
 const scope=topic=>({studyMode:'',foundationCatalog:'',sourcePreference:'',topicIds:[topic],components:[1,2]})
 assert.equal(native.recentSession(routeId,scope('t1')).id,first.id);assert.equal(native.recentSession(routeId,scope('t2')).id,second.id)
 for(const key of [...runtime.storage.keys()])if(key.startsWith(`stemistNativeRecent:${routeId}:`))runtime.storage.delete(key)
 assert.equal(native.recentSession(routeId,scope('t2')).id,second.id,'matching old draft remains resumable');assert.equal(native.recentSession(routeId,scope('t1')),null,'route-only old pointer cannot masquerade as another chapter')
 runtime.storage.set('stemistNativeRecent:other-route',second.id);assert.equal(native.recentSession('other-route'),null,'a corrupted route pointer cannot expose another route')
 const legacyRuntime=miniRuntime(),legacyNative=legacyRuntime.load('utils/nativePractice'),legacy=legacyNative.createSession(originalPayload(),chapterSpec);legacyNative.saveSession(legacy)
 assert.equal(legacyNative.recentSession(routeId,{studyMode:'chapter-study',foundationCatalog:'v2',sourcePreference:'official-first',topicIds:[originalTopicId],components:[1,2]}).id,legacy.id,'a selected v2 chapter still offers its matching saved v1 draft')
})
await check('builder routes natively and locks repeated generation', async () => {
  const wait = deferred(); let calls = 0
  const runtime = miniRuntime({ modules: { 'utils/inventory': { fetchRouteInventory: async () => inventory() }, 'utils/api': { requestJson: async () => { calls++; return wait.promise } } } })
  const page = runtime.page('pages/stem/topics')
  page.onLoad({ routeId }); await settle()
  page.toggleTopic({ currentTarget: { dataset: { id: 't1' } } })
  page.chooseCount({ currentTarget: { dataset: { count: 6 } } })
  const pending = page.start(); await settle(); page.start()
  assert.equal(calls, 1)
  assert.equal(page.data.busy, true)
  wait.resolve({ ...payload(), syllabusTopicIds: ['t1'] }); await pending
  assert.match(runtime.calls.at(-1).url, /^\/pages\/stem\/practice\?sessionId=/)
  assert.equal(page.data.busy, false)
})
await check('marking requires authentic identity and keeps grants/images off persistence', async () => {
  const requests = []
  const runtime = miniRuntime({ modules: { 'utils/image': { readAsJpegDataUrl: async () => 'data:image/jpeg;base64,cGhvdG8=' }, 'utils/api': { requestJson: async (path, body) => {
    requests.push({ path, body })
    if (path.endsWith('/attempts')) return { attempt: { attemptId: body.attemptId } }
    if (path.endsWith('/capabilities')) return { capabilities: [{ questionPartId: 'q0:a', markingGrant: 'test-grant' }] }
    return { mode: 'vision', providerStatus: 'connected', score: 1, maxScore: 2, confidence: 0.8, summary: 'Check units.', reviewRequired: true }
  } } } })
  const native = runtime.load('utils/nativePractice')
  const session = native.createSession(payload(), spec)
  session.answers.q0 = { photo: 'wxfile://usr/native-practice/test.jpg', revision: 1, results: {}, attemptId: 'native-test-q0' }
  native.saveSession(session)
  await assert.rejects(native.markQuestion(session.id, 'q0'), /登录/)
  assert.equal(requests.length, 0)
  runtime.storage.set('stemistUser', { id: 'student-a' }); runtime.storage.set('stemistSessionToken', 'test-token')
  await native.markQuestion(session.id, 'q0')
  assert.deepEqual(requests.map(r => r.path), ['/api/stem/attempts', '/api/stem/marking/capabilities', '/api/ai/mark-handwriting'])
  assert.equal(requests[2].body.provenance.sourceQuestionId, 'q0')
  assert.doesNotMatch(JSON.stringify(requests[0].body), /base64|markingGrant|wxfile/)
  assert.doesNotMatch(JSON.stringify([...runtime.storage.values()].filter(v => typeof v === 'object')), /test-grant|base64/)
  assert.equal(native.readSession(session.id).answers.q0.results['q0:a'].score, 1)
})
await check('parallel marking reports pending instead of a false second success', async () => {
  const imageGate = deferred()
  const runtime = miniRuntime({ modules: { 'utils/image': { readAsJpegDataUrl: () => imageGate.promise }, 'utils/api': { requestJson: async (path, body) => {
    if (path.endsWith('/attempts')) return { attempt: { attemptId: body.attemptId } }
    if (path.endsWith('/capabilities')) return { capabilities: [{ questionPartId: 'q0:a', markingGrant: 'test-grant' }] }
    return { mode: 'vision', providerStatus: 'connected', score: 1, maxScore: 2, confidence: 0.8, summary: 'Checked.', reviewRequired: true }
  } } } })
  runtime.storage.set('stemistUser', { id: 'student-a' }); runtime.storage.set('stemistSessionToken', 'test-token')
  const native = runtime.load('utils/nativePractice'), session = native.createSession(payload(), spec)
  session.answers.q0 = { photo: 'wxfile://usr/native-practice/test.jpg', revision: 1, results: {}, attemptId: 'native-test-q0' }
  native.saveSession(session)
  const first = native.markQuestion(session.id, 'q0'); await settle()
  await assert.rejects(() => native.markQuestion(session.id, 'q0'), /正在批改/)
  imageGate.resolve('data:image/jpeg;base64,cGhvdG8='); await first
  assert.equal(native.readSession(session.id).answers.q0.results['q0:a'].score, 1)
})
await check('durable crop binds one question, retake clears stale marking only after copy succeeds', async () => {
  const copied = [], removed = []
  let failCopy = false
  const runtime = miniRuntime({ wx: { env: { USER_DATA_PATH: 'wxfile://usr' }, getFileSystemManager: () => ({ mkdirSync() {}, accessSync() {}, copyFile: options => { copied.push(options); failCopy ? options.fail({}) : options.success({}) }, unlink: options => removed.push(options.filePath) }) } })
  const native = runtime.load('utils/nativePractice'), session = native.createSession(payload(), spec)
  native.saveSession(session)
  const context = { sessionId: session.id, questionId: 'q0', privacyEpoch: native.epoch() }
  await native.attachPhoto(context, 'wxfile://temp/photo.jpg')
  const first = native.readSession(session.id).answers.q0
  assert.match(first.photo, /^wxfile:\/\/usr\/native-practice\/mini-set-/)
  failCopy = true
  await assert.rejects(native.attachPhoto(context, 'wxfile://temp/new.jpg'), /未保存/)
  assert.equal(native.readSession(session.id).answers.q0.photo, first.photo)
  assert.equal(removed.length, 0)
  failCopy = false
  await native.attachPhoto(context, 'wxfile://temp/new.jpg')
  assert.equal(native.readSession(session.id).answers.q0.revision, 2)
  assert.deepEqual(removed, [first.photo])
})
await check('logout during async photo copy cannot recreate private evidence', async () => {
  let copy; const removed = []
  const runtime = miniRuntime({ wx: { env: { USER_DATA_PATH: 'wxfile://usr' }, getFileSystemManager: () => ({ mkdirSync() {}, accessSync() {}, copyFile: options => { copy = options }, unlink: options => removed.push(options.filePath) }) } })
  const native = runtime.load('utils/nativePractice'), session = native.createSession(payload(), spec)
  native.saveSession(session)
  const pending = native.attachPhoto({ sessionId: session.id, questionId: 'q0', privacyEpoch: native.epoch() }, 'temp.jpg')
  await settle(); runtime.load('utils/session').clearLocalSession(); copy.success({})
  await assert.rejects(pending, /结束/)
  assert.equal(native.readSession(session.id), null)
  assert.deepEqual(removed, [copy.destPath])
})
await check('401 preserves an owned draft behind reauthentication, not a dead end', () => {
  const runtime = miniRuntime(), native = runtime.load('utils/nativePractice')
  runtime.storage.set('stemistUser', { id: 'student-a' })
  const session = native.createSession(payload(), spec); native.saveSession(session)
  runtime.load('utils/session').clearLocalSession({ preserveDrafts: true })
  const page = runtime.page('pages/stem/practice'); page.onLoad({ sessionId: session.id })
  assert.equal(page.data.question, null)
  assert.equal(page.data.authRequired, true)
  runtime.storage.set('stemistUser', { id: 'student-a' })
  runtime.storage.set('stemistSessionToken', 'test-token')
  page.onShow()
  assert.equal(page.data.question.id, 'q0')
})
await check('invalid AI scores and offline success cannot become marking feedback', () => {
  const { verifiedResult } = miniRuntime().load('utils/nativePractice')
  for (const result of [{ mode: 'offline' }, { mode: 'vision', providerStatus: 'connected', score: 3, maxScore: 2, confidence: .8 }, { mode: 'vision', providerStatus: 'connected', score: 1, maxScore: 2, confidence: NaN }]) assert.throws(() => verifiedResult(result, { marks: 2 }))
})
await check('late assembly response after logout never creates a new-account session', async () => {
  const pending = deferred()
  const runtime = miniRuntime({ modules: { 'utils/api': { requestJson: () => pending.promise } } })
  const native = runtime.load('utils/nativePractice'), generation = native.generatePractice(spec)
  runtime.load('utils/session').clearLocalSession(); pending.resolve(payload())
  await assert.rejects(generation, /账号/)
})
const practiceWxml=fs.readFileSync('pages/stem/practice.wxml','utf8'),topicsWxml=fs.readFileSync('pages/stem/topics.wxml','utf8'),topicsWxss=fs.readFileSync('pages/stem/topics.wxss','utf8'),practiceWxss=fs.readFileSync('pages/stem/practice.wxss','utf8'),appWxss=fs.readFileSync('app.wxss','utf8')
assert.match(practiceWxml,/question\.prompt/);assert.match(practiceWxml,/原创基础练习/);assert.match(practiceWxml,/不计正式进度/);assert.match(practiceWxml,/kindLabel/);assert.match(practiceWxml,/feedback\.nextStep/);assert.match(topicsWxml,/chapter-study/);assert.match(topicsWxml,/真题.*officialAvailable/);assert.match(topicsWxml,/原创.*originalAvailable/)
assert.match(topicsWxss,/\.option-chip\s*\{[^}]*min-height:\s*44px/);assert.match(topicsWxss,/\.device-tablet\.landscape \.builder-layout\s*\{[^}]*grid-template-columns:/);assert.match(topicsWxss,/\.device-phone \.builder-layout[^}]*flex-direction:\s*column/);assert.match(practiceWxss,/\.device-tablet\.landscape \.native-question-layout\s*\{[^}]*grid-template-columns:/);assert.match(practiceWxss,/\.device-phone \.native-question-layout[^}]*display:\s*block/);assert.match(appWxss,/\.mcq-options button\.mcq-option\s*\{[^}]*min-height:\s*52px/)
console.log(`Native practice: ${passed} checks passed.`)
