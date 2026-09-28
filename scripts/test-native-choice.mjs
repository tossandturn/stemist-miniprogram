import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
const calls=[]
const r=miniRuntime({modules:{'utils/api':{requestJson:async(path,body)=>{
 calls.push({path,body})
 if(path==='/api/stem/attempts')return {attempt:{attemptId:body.attemptId}}
 if(path==='/api/stem/objective-answers')return {...body,schemaVersion:'stem-objective-result-v1',available:true,source:'mark-scheme',sourceStatus:'reviewed-official-key',score:body.selectedOption==='B'?1:0,maxScore:1,correctOption:'B'}
 throw Error('Unexpected endpoint '+path)
}}}})
r.storage.set('stemistUser',{id:'student'});r.storage.set('stemistSessionToken','fixture')
const native=r.load('utils/nativePractice'),choice=r.load('utils/nativeChoice')
assert.equal(choice.isSingleChoice({subjectCode:'9702',component:1}),true)
assert.equal(choice.isSingleChoice({subjectCode:'9709',component:1}),false,'mathematics P1 is not multiple choice')
assert.equal(choice.isSingleChoice({subjectCode:'0625',component:2}),true)
assert.equal(choice.isSingleChoice({subjectCode:'0620',component:2}),true)
assert.equal(choice.isSingleChoice({subjectCode:'9702',component:1,answerFormat:'written'}),false)
const switched=choice.nextChoiceAnswer({inputMode:'photo',photo:'/app/native-practice/legacy.jpg',results:{part:{score:1}},feedback:'legacy AI feedback',attemptId:'legacy-attempt',legacyAiResults:{part:{score:1}},assessment:{state:'ai',score:1,maxMarks:1},studentAssessment:{state:'self',score:1,maxMarks:1},selfDraft:{started:true}},'A')
for(const field of ['photo','results','feedback','attemptId','legacyAiResults','assessment','studentAssessment','selfDraft'])assert.equal(Object.hasOwn(switched,field),false,`switching to ABCD must clear stale ${field}`)
assert.equal(switched.choice,'A');assert.equal(switched.inputMode,'choice');assert.equal(switched.previousAssessments.length,1)
const sameChoice=choice.nextChoiceAnswer({inputMode:'choice',choice:'B',revision:2,photo:'/app/native-practice/stale.jpg',objectiveResult:{score:1},assessment:{state:'objective',score:1,maxMarks:1}},'B')
assert.equal(Object.hasOwn(sameChoice,'photo'),false);assert.equal(sameChoice.revision,2);assert.equal(sameChoice.objectiveResult.score,1);assert.equal(sameChoice.assessment.state,'objective')
const legacySame=choice.nextChoiceAnswer({inputMode:'choice',choice:'A',revision:4,objectiveResult:{score:1},assessment:{state:'ai',score:9},studentAssessment:{state:'self',score:9},selfDraft:{score:9}},'A')
for(const field of ['assessment','studentAssessment','selfDraft'])assert.equal(Object.hasOwn(legacySame,field),false,`unchanged ABCD must not retain legacy ${field}`)
assert.equal(legacySame.revision,4);assert.equal(legacySame.objectiveResult.score,1)
const inv={practicePolicy:{schemaVersion:'stem-topic-practice-policy-v1',minSourceGroups:6,minReviewedGroups:12,setSizes:[6,10,15],allowReviewedSubsetStudy:true},paperComponents:[1,2],topics:[{id:'t1',apiStartable:true,questionIdsByComponent:{1:{verifiedQuestionIds:Array.from({length:7},(_,i)=>'p1-'+i),apiReadyQuestionIds:Array.from({length:7},(_,i)=>'p1-'+i)},2:{verifiedQuestionIds:[],apiReadyQuestionIds:[]}}}]}
const subset=native.selectionState(inv,['t1'],[1],6)
assert.equal(subset.canStart,true);assert.equal(subset.studyReady,true);assert.equal(subset.ready,false)
assert.equal(native.selectionState(inv,['t1'],[1],10).canStart,false)
inv.practicePolicy.allowReviewedSubsetStudy=false;assert.equal(native.selectionState(inv,['t1'],[1],6).canStart,false,'old servers must not silently opt into the new study contract')
inv.practicePolicy.allowReviewedSubsetStudy=true
const builder=r.page('pages/stem/topics');builder.__inventory=inv;builder.setData({loading:false,components:[1,2],selected:['t1']});builder.onlyComponent({currentTarget:{dataset:{value:1}}})
assert.deepEqual([...builder.data.components],[1]);assert.equal(builder.data.availableCount,7);assert.equal(builder.data.canStart,true)
const session={schema:1,id:'mini-set-choice-fixture',owner:'student',privacyEpoch:0,routeId:'cie-9702-as-physics',subjectCode:'9702',stage:'AS',index:0,answers:{},questions:[{id:'paper:q1',paperId:'paper',component:1,number:'1',marks:1,images:['/question-assets/paper/qp-1.jpg'],parts:[{id:'paper:q1:answer',label:'answer',marks:1,provenance:{sourceQuestionId:'paper:q1',questionPartId:'paper:q1:answer',routeId:'cie-9702-as-physics',bindingSignature:'test'}}]}]}
native.saveSession(session);native.saveChoice(session.id,'paper:q1','B')
let view=native.questionView(native.readSession(session.id),0)
assert.equal(view.choice,'B');assert.equal(view.question.choiceMode,true);assert.equal(view.answeredCount,1)
assert.equal(view.photo,'');assert.equal(calls.length,0,'choosing an option saves locally and does not expose the key')
await native.markChoice(session.id,'paper:q1')
view=native.questionView(native.readSession(session.id),0);assert.equal(view.objectiveResult.score,1)
assert.equal(calls[0].path,'/api/stem/attempts');assert.ok(calls[0].body.submittedAt)
assert.equal(calls[1].path,'/api/stem/objective-answers')
assert.doesNotMatch(JSON.stringify(calls),/imageDataUrl|mark-handwriting/)
native.saveChoice(session.id,'paper:q1','A');assert.equal(native.readSession(session.id).answers['paper:q1'].objectiveResult,null)
assert.equal(native.readSession(session.id).answers['paper:q1'].objectiveHistory[1].score,1,'prior graded revision remains preserved')
r.storage.set('stemistPrivacyEpoch',1);assert.throws(()=>native.saveChoice(session.id,'paper:q1','D'))

const removed=[]
const switchRuntime=miniRuntime({wx:{env:{USER_DATA_PATH:'/app'},getFileSystemManager:()=>({unlink:options=>{removed.push(options.filePath);options.success?.({})}})}})
switchRuntime.storage.set('stemistUser',{id:'student'});switchRuntime.storage.set('stemistPrivacyEpoch',0)
const switchNative=switchRuntime.load('utils/nativePractice')
const switchSession={schema:1,id:'mini-set-choice-switch',owner:'student',privacyEpoch:0,routeId:'cie-9702-as-physics',subjectCode:'9702',stage:'AS',index:0,answers:{'paper:q1':{photo:'/app/native-practice/mini-set-choice-switch-0-1-old.jpg',revision:1,results:{part:{score:1}},feedback:'old',attemptId:'old'}},questions:[{id:'paper:q1',paperId:'paper',component:1,number:'1',marks:1,images:['/question-assets/paper/qp-1.jpg'],parts:[{id:'paper:q1:answer',label:'answer',marks:1,provenance:{sourceQuestionId:'paper:q1',questionPartId:'paper:q1:answer',routeId:'cie-9702-as-physics',bindingSignature:'test'}}]}]}
switchNative.saveSession(switchSession);switchNative.saveChoice(switchSession.id,'paper:q1','C')
const switchedTopic=switchNative.readSession(switchSession.id).answers['paper:q1']
assert.equal(switchedTopic.choice,'C');assert.equal(Object.hasOwn(switchedTopic,'photo'),false);assert.deepEqual(removed,['/app/native-practice/mini-set-choice-switch-0-1-old.jpg'])

const paperRemoved=[]
const paperSwitchRuntime=miniRuntime({wx:{env:{USER_DATA_PATH:'/app'},getFileSystemManager:()=>({unlink:options=>{paperRemoved.push(options.filePath);options.success?.({})}})}})
const paperSwitch=paperSwitchRuntime.load('utils/nativePaper')
let paperSwitchDraft=paperSwitch.createPaperDraft({id:'paper-choice-switch',subject:'9702'},{routeId:'cie-9702-as-physics',stage:'AS'})
const paperPhoto='/app/native-paper/'+paperSwitchDraft.id+'-q1-r1-old.jpg'
paperSwitchDraft.answers[1]={photo:paperPhoto,revision:1,results:{part:{score:1}},feedback:'old',attemptId:'old'};paperSwitch.savePaperDraft(paperSwitchDraft)
paperSwitch.savePaperChoice(paperSwitchDraft.storageKey,1,'D');paperSwitchDraft=paperSwitch.readPaperDraft(paperSwitchDraft.storageKey)
assert.equal(paperSwitchDraft.answers[1].choice,'D');assert.equal(Object.hasOwn(paperSwitchDraft.answers[1],'photo'),false);assert.deepEqual(paperRemoved,[paperPhoto])

const p=miniRuntime(),papers=p.load('utils/nativePaper'),grading=p.load('utils/nativePaperGrading')
let draft=papers.createPaperDraft({id:'paper-choice',subject:'9702'}, {routeId:'cie-9702-as-physics',stage:'AS'})
papers.savePaperDraft(draft);papers.savePaperChoice(draft.storageKey,1,'A');papers.savePaperChoice(draft.storageKey,2,'B')
draft=papers.readPaperDraft(draft.storageKey);draft.submitted=true;draft.submittedAt=Date.now();draft.questionCount=2;papers.savePaperDraft(draft)
await grading.runPaperAssessment(draft.storageKey,{loadContext:async()=>({questions:[]}),sync:async()=>{},mark:()=>assert.fail('MCQ never uses photo AI'),markObjective:async(d,q,selectedOption)=>({source:'mark-scheme',sourceQuestionId:q.sourceQuestionId,available:true,score:selectedOption==='B'?1:0,maxScore:1,selectedOption,correctOption:'B'}),paperMax:2})
const report=grading.paperReport(papers.readPaperDraft(draft.storageKey),2)
assert.equal(report.objectiveCount,2);assert.equal(report.aiCount,0);assert.equal(report.score,1);assert.equal(report.scoreSource,'objective');assert.equal(report.wholePaper,true)
assert.throws(()=>papers.savePaperChoice(draft.storageKey,1,'B'),'submitted paper cannot silently change')

const syncBodies=[],syncRuntime=miniRuntime({modules:{'utils/api':{requestJson:async(path,body)=>{syncBodies.push({path,body});return{attempt:{attemptId:body.attemptId}}}}}})
const syncPapers=syncRuntime.load('utils/nativePaper'),syncService=syncRuntime.load('utils/nativePaperService')
let syncDraft=syncPapers.createPaperDraft({id:'paper-choice-sync',subject:'9702'},{routeId:'cie-9702-as-physics',stage:'AS'})
syncPapers.savePaperDraft(syncDraft);syncPapers.savePaperChoice(syncDraft.storageKey,1,'A');syncPapers.savePaperChoice(syncDraft.storageKey,2,'B');syncDraft=syncPapers.readPaperDraft(syncDraft.storageKey)
syncDraft.answers[4]={};syncPapers.savePaperDraft(syncDraft)
await syncService.syncPaperAttempt(syncDraft,{questions:[]},2)
assert.equal(syncBodies.at(-1).body.attempt.evidence.kind,'single-choice','choice-only papers must not claim photo or mixed evidence');assert.equal(syncBodies.at(-1).body.attempt.evidence.count,2,'empty answer objects must not inflate evidence count')
syncDraft.answers[3]={photo:'/app/native-paper/answer.jpg',revision:1};syncPapers.savePaperDraft(syncDraft);await syncService.syncPaperAttempt(syncDraft,{questions:[]},3)
assert.equal(syncBodies.at(-1).body.attempt.evidence.kind,'mixed-answers')
delete syncDraft.answers[1];delete syncDraft.answers[2];syncPapers.savePaperDraft(syncDraft);await syncService.syncPaperAttempt(syncDraft,{questions:[]},3)
assert.equal(syncBodies.at(-1).body.attempt.evidence.kind,'photo')
syncDraft.answers={4:{}};syncPapers.savePaperDraft(syncDraft);await assert.rejects(()=>syncService.syncPaperAttempt(syncDraft,{questions:[]},3),/先选择或拍摄/)

const retryRuntime=miniRuntime(),retryPapers=retryRuntime.load('utils/nativePaper'),retryGrading=retryRuntime.load('utils/nativePaperGrading')
let retryDraft=retryPapers.createPaperDraft({id:'paper-choice-retry',subject:'9702'},{routeId:'cie-9702-as-physics',stage:'AS'})
retryPapers.savePaperDraft(retryDraft);retryPapers.savePaperChoice(retryDraft.storageKey,1,'A');retryPapers.savePaperChoice(retryDraft.storageKey,2,'B')
retryDraft=retryPapers.readPaperDraft(retryDraft.storageKey);retryDraft.submitted=true;retryDraft.submittedAt=Date.now();retryDraft.questionCount=2;retryPapers.savePaperDraft(retryDraft)
let objectiveCalls=0
await assert.rejects(()=>retryGrading.runPaperAssessment(retryDraft.storageKey,{loadContext:async()=>({questions:[]}),sync:async()=>{throw Object.assign(Error('transport detail'),{code:'network_timeout'})},mark:()=>assert.fail('MCQ never uses photo AI'),markObjective:async()=>{objectiveCalls++}}),/标准答案核对暂时未完成，请重试/)
let retrySaved=retryPapers.readPaperDraft(retryDraft.storageKey),retryReport=retryGrading.paperReport(retrySaved,2)
assert.deepEqual([retrySaved.answers[1].assessment.state,retrySaved.answers[2].assessment.state],['pending','pending']);assert.equal(objectiveCalls,0)
assert.equal(retryReport.objectiveCount,0);assert.equal(retryReport.objectiveScore,0);assert.equal(retryReport.needsSelf,0);assert.equal(retryReport.pending,2)
await retryGrading.runPaperAssessment(retryDraft.storageKey,{loadContext:async()=>({questions:[]}),sync:async()=>{},mark:()=>assert.fail('MCQ never uses photo AI'),markObjective:async(d,q,selectedOption)=>{objectiveCalls++;return{source:'mark-scheme',available:true,score:1,maxScore:1,selectedOption,correctOption:selectedOption}}})
retryReport=retryGrading.paperReport(retryPapers.readPaperDraft(retryDraft.storageKey),2);assert.equal(objectiveCalls,2);assert.equal(retryReport.objectiveCount,2);assert.equal(retryReport.objectiveScore,2)

const unknownRuntime=miniRuntime(),unknownPapers=unknownRuntime.load('utils/nativePaper'),unknownGrading=unknownRuntime.load('utils/nativePaperGrading')
let unknownDraft=unknownPapers.createPaperDraft({id:'paper-choice-unknown',subject:'9702'},{routeId:'cie-9702-as-physics',stage:'AS'})
unknownPapers.savePaperDraft(unknownDraft);unknownPapers.savePaperChoice(unknownDraft.storageKey,1,'A');unknownDraft=unknownPapers.readPaperDraft(unknownDraft.storageKey);unknownDraft.submitted=true;unknownDraft.submittedAt=Date.now();unknownDraft.questionCount=1;unknownPapers.savePaperDraft(unknownDraft)
await unknownGrading.runPaperAssessment(unknownDraft.storageKey,{loadContext:async()=>({questions:[]}),sync:async()=>{},mark:()=>assert.fail('MCQ never uses photo AI'),markObjective:async(d,q,selectedOption)=>({source:'unavailable',available:false,score:null,maxScore:1,selectedOption,correctOption:null})})
const unknownSaved=unknownPapers.readPaperDraft(unknownDraft.storageKey),unknownReport=unknownGrading.paperReport(unknownSaved,1)
assert.equal(unknownSaved.answers[1].assessment.state,'self-required');assert.equal(unknownReport.objectiveCount,0);assert.equal(unknownReport.objectiveScore,0);assert.equal(unknownReport.needsSelf,1)

const v=r.load('utils/nativeObjectiveAnswer').validateObjectiveResult,expected={attemptId:'a',mode:'topic',routeId:'r',stage:'AS',paperId:'p',sourceQuestionId:'p:q1',selectedOption:'A'}
assert.throws(()=>v({...expected,schemaVersion:'stem-objective-result-v1',available:true,score:1,maxScore:1,correctOption:'B',source:'mark-scheme',sourceStatus:'reviewed-official-key'},expected))
assert.equal(v({...expected,schemaVersion:'stem-objective-result-v1',available:false,score:null,maxScore:1,correctOption:null,source:'unavailable'},expected).available,false)
const deferredGrade=deferred()
const race=miniRuntime({modules:{'utils/api':{requestJson:async(path,body)=>path.endsWith('/attempts')?{attempt:{attemptId:body.attemptId}}:deferredGrade.promise}}})
race.storage.set('stemistUser',{id:'student'});race.storage.set('stemistSessionToken','fixture')
const raceNative=race.load('utils/nativePractice');raceNative.saveSession(session);raceNative.saveChoice(session.id,'paper:q1','A')
const gradingPromise=raceNative.markChoice(session.id,'paper:q1')
await settle();raceNative.saveChoice(session.id,'paper:q1','C')
deferredGrade.resolve({schemaVersion:'stem-objective-result-v1',attemptId:session.id+'-q0-r1',mode:'topic',routeId:session.routeId,stage:'AS',paperId:'paper',sourceQuestionId:'paper:q1',selectedOption:'A',available:true,source:'mark-scheme',sourceStatus:'reviewed-official-key',score:0,maxScore:1,correctOption:'B'})
await assert.rejects(gradingPromise,/作答或账号已变化/)
assert.equal(raceNative.readSession(session.id).answers['paper:q1'].choice,'C')
assert.equal(raceNative.readSession(session.id).answers['paper:q1'].objectiveResult,null,'late grade cannot overwrite a newer selected answer')
console.log('Native MCQ: classification, ABCD persistence, submitted owned grading, no photo/AI, revision retention and separate objective paper reports passed.')
