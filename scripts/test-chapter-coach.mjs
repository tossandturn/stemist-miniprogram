import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const routeId='cie-9702-as-physics', qid='paper:q1'
const session={id:'mini-set-review',owner:'student',privacyEpoch:0,stage:'AS',subjectCode:'9702',routeId,index:0,
 questions:[{id:qid,number:'1',paperId:'paper',marks:1,answerFormat:'single-choice',sourceLabel:'9702 s25 qp 12',images:['/question-assets/paper/qp-1.jpg'],choiceOptions:[{label:'A',text:'2 N'},{label:'B',text:'4 N'}]}],
 answers:{[qid]:{choice:'A',revision:1,objectiveResult:{available:true,score:0,maxScore:1,selectedOption:'A',correctOption:'B'}}}}
const runtime=miniRuntime({wx:{env:{USER_DATA_PATH:'/owned'}},modules:{'utils/nativePractice':{readSession:id=>id===session.id?structuredClone(session):null}}})
runtime.storage.set('stemistUser',{id:'student'})
const service=runtime.load('bundles/coach/practiceReview')
const review=service.captureReview(session.id,qid)
assert.equal(review.context.question.id,qid)
assert.equal(review.context.stage,'AS')
assert.equal(review.context.responseStatus,'answered')
assert.equal(review.context.attemptId,undefined,'do not invent a persisted attempt')
assert.match(review.message,/A.*2 N/)
assert.match(review.message,/标准答案.*B/)
assert.equal(review.assets[0].url,'https://stem.ieltsist.com/question-assets/paper/qp-1.jpg')
assert.equal(service.currentReview(review),true)
session.answers[qid].revision++
assert.equal(service.currentReview(review),false,'changed answer must cancel preparation')
session.answers[qid].revision--
runtime.storage.set('stemistPrivacyEpoch',1)
assert.equal(service.currentReview(review),false)
runtime.storage.delete('stemistPrivacyEpoch')
for(const result of [{available:false,score:null,maxScore:1},{available:true,score:1,maxScore:1},null]){
 const prior=session.answers[qid].objectiveResult;session.answers[qid].objectiveResult=result
 assert.throws(()=>service.captureReview(session.id,qid),/错题|结果/)
 session.answers[qid].objectiveResult=prior
}
for(const url of ['https://evil.test/x.jpg','/question-assets/paper/ms-1.jpg','/question-assets/other/qp-1.jpg','/question-assets/paper/../qp-1.jpg']){
 session.questions[0].images=[url];assert.throws(()=>service.captureReview(session.id,qid),/题图/)
}
session.questions[0].images=['/question-assets/paper/qp-1.jpg']
// Real governed assets use zero-padded page names (for example qp-03.jpg).
// Preserve the exact asset URL while validating its numerical page binding.
session.questions[0].sourceRegions=[{url:'/question-assets/paper/qp-03.jpg',page:3,region:[.078431,.060606,.931373,.196970],imageSize:[1020,1320]}]
const padded=service.captureReview(session.id,qid)
assert.equal(padded.assets[0].page,3)
assert.equal(padded.assets[0].url,'https://stem.ieltsist.com/question-assets/paper/qp-03.jpg')
assert.deepEqual(Array.from(padded.assets[0].imageSize),[1020,1320])
for(const value of [
 {...session.questions[0].sourceRegions[0],page:4},
 {...session.questions[0].sourceRegions[0],url:'/question-assets/paper/qp-00.jpg',page:0},
 {...session.questions[0].sourceRegions[0],url:'/question-assets/paper/qp-1001.jpg',page:1001},
 {...session.questions[0].sourceRegions[0],url:'/question-assets/other/qp-03.jpg'},
]){session.questions[0].sourceRegions=[value];assert.throws(()=>service.captureReview(session.id,qid),/题图/)}
delete session.questions[0].sourceRegions
const region='/api/stem/practice-source-image?routeId='+routeId+'&sourceQuestionId='+encodeURIComponent(qid)+'&region=0&v='+'a'.repeat(64)
session.questions[0].sourceRegions=[{url:region+'&view=region',page:1,region:[0,.25,1,.75],imageSize:[1000,1400],renderedImageSize:[1000,700]}]
assert.equal(service.captureReview(session.id,qid).assets[0].cropped,true)
session.questions[0].sourceRegions[0].url=region.replace(encodeURIComponent(qid),'other')+'&view=region'
assert.throws(()=>service.captureReview(session.id,qid),/题图/)
delete session.questions[0].sourceRegions
session.questions[0].original=true;session.questions[0].prompt='Find the force.'
const original=service.captureReview(session.id,qid)
assert.match(original.context.question.prompt,/Find the force.*A.*2 N.*B.*4 N/s)
assert.match(original.message,/原创.*非官方/)
assert.equal(original.assets.length,0,'original text must not borrow official images')
assert.equal(original.context.paper,undefined)
delete session.questions[0].original
session.answers[qid]={revision:2,photo:'/owned/native-practice/mini-set-review-0-2-123.jpg',results:{a:{score:1,maxScore:2,summary:'Check units.'}}}
const written=service.captureReview(session.id,qid)
assert.equal(written.assets.at(-1).kind,'answer')
assert.match(written.message,/AI 参考/)
session.answers[qid].photo='/owned/native-practice/mini-set-other-0-2-123.jpg'
assert.throws(()=>service.captureReview(session.id,qid),/作答照片/)

const panels=service.planPanels([{width:1200,height:1400,id:'q'},{width:1200,height:1300,id:'answer'}])
assert.equal(panels.length,2)
assert.deepEqual(Array.from(panels.flatMap(p=>p.blocks.map(b=>b.id))),['q','answer'])
assert.ok(panels.every(p=>p.height<=2048&&p.width<=2048))
assert.throws(()=>service.planPanels(Array.from({length:4},(_,id)=>({width:1200,height:1700,id}))),/过长|过多/)
assert.throws(()=>service.planPanels([{width:0,height:1}]),/图片/)
console.log('Chapter Coach: current question, mistakes, source binding, originals, written ownership, revision/epoch and bounded complete image layout passed.')
