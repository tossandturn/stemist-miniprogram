import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
const runtime=miniRuntime(),papers=runtime.load('utils/nativePaper'),grading=runtime.load('utils/nativePaperGrading')
function draft(){const d=papers.createPaperDraft({id:'paper-'+Math.random().toString(36).slice(2),subject:'9702'},{routeId:'cie-9702-as-physics',stage:'AS'});d.submitted=true;d.submittedAt=Date.now();d.answers={1:{photo:'local-one',revision:1},2:{photo:'local-two',revision:1}};papers.savePaperDraft(d);return d}
const context={questions:[1,2].map(number=>({number,parts:[{partId:'q'+number+'a',label:'a',marks:4}]}))}
const result={score:3,maxScore:4,confidence:0.9,provisional:true,reviewRequired:true,summary:'Show the substitution.'}
const first=draft();first.submitted=false;papers.savePaperDraft(first);assert.throws(()=>grading.selfAssess(first.storageKey,1,'2','4'));first.submitted=true;papers.savePaperDraft(first)
let calls=0
await grading.runPaperAssessment(first.storageKey,{loadContext:async()=>context,sync:async()=>{},mark:async(d,q,p,onPart)=>{calls++;if(q.number===2)throw Error('unavailable');await onPart(q.parts[0],result)}})
let saved=papers.readPaperDraft(first.storageKey),report=grading.paperReport(saved,8)
assert.equal(calls,2);assert.equal(saved.answers[1].assessment.state,'ai');assert.equal(saved.answers[2].assessment.state,'self-required')
assert.equal(report.aiScore,3);assert.equal(report.selfScore,0);assert.equal(report.complete,false);assert.equal(report.scoreSource,'partial-ai')
assert.throws(()=>grading.selfAssess(first.storageKey,1,'4','4'),'AI success cannot be overwritten by manual scoring')
assert.throws(()=>grading.selfAssess(first.storageKey,2,'5','4'))
grading.selfAssess(first.storageKey,2,'2','4');saved=papers.readPaperDraft(first.storageKey);report=grading.paperReport(saved,8)
assert.equal(report.complete,true);assert.equal(report.scoreSource,'mixed');assert.equal(report.score,5);assert.equal(report.maxScore,8)
assert.equal(grading.paperReport(saved,75).wholePaper,false)
await grading.runPaperAssessment(first.storageKey,{loadContext:async()=>context,sync:async()=>{},mark:async()=>{throw Error('must not regrade completed answers')}})
assert.equal(grading.paperReport(papers.readPaperDraft(first.storageKey),8).score,5)
const paused=draft(),wait=deferred();let active=true,started=0
const job=grading.runPaperAssessment(paused.storageKey,{active:()=>active,loadContext:async()=>context,sync:async()=>{},mark:async(d,q,p,onPart)=>{started++;await wait.promise;await onPart(q.parts[0],result)}})
await settle();active=false;wait.resolve();await job
assert.equal(started,1);assert.equal(papers.readPaperDraft(paused.storageKey).grading.status,'paused')
assert.equal(papers.readPaperDraft(paused.storageKey).answers[2].assessment.state,'pending')
assert.equal(papers.readPaperDraft(paused.storageKey).answers[1].results.q1a.score,3,'Pause must retain the already returned AI result')
let resumedParts=0
await grading.runPaperAssessment(paused.storageKey,{loadContext:async()=>context,sync:async()=>{},mark:async(d,q,p,cb)=>{resumedParts++;await cb(q.parts[0],result)}})
assert.equal(resumedParts,1,'Resuming must not pay again for the completed first question')
const missing=draft();await grading.runPaperAssessment(missing.storageKey,{loadContext:async()=>({questions:[]}),sync:async()=>{},mark:async()=>assert.fail('Missing sources cannot call AI')})
assert.equal(grading.paperReport(papers.readPaperDraft(missing.storageKey)).needsSelf,2)
const legacy=draft();legacy.selfScore='7';papers.savePaperDraft(legacy)
assert.equal(grading.paperReport(legacy,8).selfScore,0,'Old self-total remains history, not new verified grading')
legacy.answers[1].results={q1a:{...result,score:4}};papers.savePaperDraft(legacy)
let legacyCalls=0
await grading.runPaperAssessment(legacy.storageKey,{loadContext:async()=>context,sync:async()=>{},mark:async(d,q,p,cb)=>{legacyCalls++;await cb(q.parts[0],result)}})
assert.equal(papers.readPaperDraft(legacy.storageKey).answers[1].legacyAiResults.q1a.score,4)
assert.equal(legacyCalls,1,'Strictly valid legacy Q1 must migrate without a new provider call')
assert.equal(grading.paperReport(papers.readPaperDraft(legacy.storageKey)).rows[0].score,4)
const partial=papers.readPaperDraft(legacy.storageKey);partial.questionCount=3
assert.equal(grading.paperReport(partial,8).wholePaper,false,'Matching max alone cannot prove question coverage')
partial.questionCount=2;assert.equal(grading.paperReport(partial,8).wholePaper,true)
partial.answers[1].assessment.score=NaN;assert.equal(grading.paperReport(partial,8).complete,false,'Invalid cached score cannot complete a report')
{
 let marks=0
 const r=miniRuntime({modules:{'utils/nativePaperService':{
  paperContext:async()=>context,paperSources:async()=>context,syncPaperAttempt:async()=>{},
  markPaperQuestion:async(d,q,p,cb)=>{marks++;await cb(q.parts[0],result)},
 }}})
 const model=r.load('utils/nativePaper'),d=model.createPaperDraft({id:'paper-flow',subject:'9702'},{routeId:'cie-9702-as-physics',stage:'AS'})
 d.answers={1:{photo:'one',revision:1},2:{photo:'two',revision:1}};model.savePaperDraft(d)
 const page=r.page('pages/stem/paper');page.__draft=d;page.__disposed=false;page.__loadedSourceUrls=new Set();page.setData({paperId:d.paperId,routeId:d.routeId,stage:'AS',subject:'9702',photoCount:2,maxMarks:8})
 await page.submitPaper()
 assert.equal(marks,2);assert.equal(page.data.reportSummary.complete,true);assert.equal(page.data.reportSummary.scoreSource,'ai')
 assert.equal(r.load('utils/nativeRecords').recentRecords()[0].coachMode,'ai')
 await page.submitPaper();assert.equal(marks,2)
 assert.equal(model.readPaperDraft(d.storageKey).report.score,6)
}
console.log('Automatic paper assessment: AI first, per-question fallback, mixed report, partial coverage, safe pause, preserved legacy scores and no duplicate completion passed.')

{
 const concurrent=draft(),gate=deferred();let count=0
 const running=grading.runPaperAssessment(concurrent.storageKey,{loadContext:async()=>context,sync:async()=>{},mark:async(d,q,p,cb)=>{count++;if(q.number===1)await gate.promise;await cb(q.parts[0],result)}})
 await settle()
 grading.selfAssess(concurrent.storageKey,1,'2','4')
 grading.selfAssess(concurrent.storageKey,2,'1','4')
 let view=grading.paperReport(papers.readPaperDraft(concurrent.storageKey),8)
 assert.equal(view.selfScore,3);assert.equal(view.pending,2);assert.equal(view.complete,false)
 gate.resolve();await running
 const restored=papers.readPaperDraft(concurrent.storageKey);view=grading.paperReport(restored,8)
 assert.equal(count,2,'Self scoring while waiting does not cancel queued AI questions')
 assert.equal(view.aiScore,6);assert.equal(view.selfScore,0);assert.equal(view.score,6,'Never add self score to AI score for the same question')
 assert.equal(view.rows[0].studentScore,2);assert.equal(view.rows[1].studentScore,1)
 assert.equal(restored.answers[1].studentAssessment.score,2,'Late AI result preserves the self assessment')
}
{
 const gate=deferred(),r=miniRuntime({modules:{'utils/nativePaperService':{paperContext:async()=>context,paperSources:async()=>context,syncPaperAttempt:async()=>{},markPaperQuestion:async(d,q,p,cb)=>{await gate.promise;await cb(q.parts[0],result)}}}})
 const model=r.load('utils/nativePaper'),d=model.createPaperDraft({id:'self-wait-page',subject:'9702'},{routeId:'cie-9702-as-physics',stage:'AS'})
 d.answers={1:{photo:'one',revision:1}};model.savePaperDraft(d)
 const page=r.page('pages/stem/paper');page.__draft=d;page.__disposed=false;page.__loadedSourceUrls=new Set();page.setData({paperId:d.paperId,routeId:d.routeId,stage:'AS',subject:'9702',photoCount:1,maxMarks:4})
 const running=page.submitPaper();await settle()
 page.chooseSelfAssessment();assert.equal(page.data.selfEditing,true)
 page.inputQuestionSelf({currentTarget:{dataset:{field:'score'}},detail:{value:'2'}})
 assert.equal(page.data.questionSelfScore,'2')
 gate.resolve();await running
 assert.equal(page.data.selfEditing,true,'AI completion must not close an active self editor')
 page.saveQuestionSelf()
 assert.equal(page.data.error,'');assert.equal(page.data.studentScore,2)
 assert.equal(model.readPaperDraft(d.storageKey).answers[1].assessment.score,3)
}
console.log('Waiting self-assessment: concurrent queued/active AI, comparison-only totals and editing across AI completion passed.')
