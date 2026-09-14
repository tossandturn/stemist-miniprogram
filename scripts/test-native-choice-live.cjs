// Opt-in real API/native-page MCQ acceptance under an isolated QA identity.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const account=require('./helpers/native-qa-account.cjs')
const output=process.argv[process.argv.indexOf('--output')+1]
if(!process.argv.includes('--run-production')||!output)throw Error('Use --run-production --output <QA directory>')
const tap=selector=>call('automation_element_action',{action:'tap',selector,'wait-for-selector':selector})
async function scrollTo(selector){
 const source='function(){return new Promise(resolve=>{const q=wx.createSelectorQuery();q.select('+JSON.stringify(selector)+').boundingClientRect();q.selectViewport().scrollOffset();q.exec(r=>resolve(Math.max(0,(r[0]?.top||0)+(r[1]?.scrollTop||0)-100)))})}'
 const top=await evaluate(source)
 await call('automation_viewport_action',{action:'pageScrollTo','scroll-top':top})
}
async function main(){
 const report={cameraUsed:false,aiCalls:0}
 fs.mkdirSync(output,{recursive:true})
 try{
  await account.begin()
  await evaluate(function(){require('utils/inventory.js').clearInventoryCache();return true})
  await call('automation_navigate',{action:'navigateTo',url:'/pages/stem/topics?routeId=cie-9702-as-physics'})
  await until(function(){const p=getCurrentPages().slice(-1)[0];return !p.data.loading&&p.data.topics?.length},'chapter builder inventory',20000)
  await scrollTo('.component-shortcuts');await tap('.component-shortcuts button[data-value="1"]')
  for(const id of ['physics-9702-topic-01','physics-9702-topic-02']){const selector='.topic-choice[data-id="'+id+'"]';await scrollTo(selector);await tap(selector)}
  await scrollTo('.set-options');await tap('button[data-count="6"]')
  report.builder=await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {available:p.data.availableCount,count:p.data.questionCount,canStart:p.data.canStart,components:p.data.components,selected:p.data.selected.length}})
  assert.deepEqual(report.builder,{available:12,count:6,canStart:true,components:[1],selected:2})
  await call('simulator_screenshot',{path:path.join(output,'builder-7-plus-5-ready.png'),optimize:false})
  await scrollTo('.start-native-practice');await tap('.start-native-practice')
  await until(function(){const p=getCurrentPages().slice(-1)[0];return p.route==='pages/stem/practice'&&p.data.total===6},'actual start button assembly',30000)
  const mapping=await evaluate(function(){const p=getCurrentPages().slice(-1)[0],s=require('utils/nativePractice.js').readSession(p.data.sessionId);return s.questions.every(q=>q.component===1&&q.answerFormat==='single-choice'&&q.sourceRegions.length===q.images.length&&q.choiceOptions.length===4)})
  assert.equal(mapping,true,'every generated source must have its own verified focus and A-D options')
  await until(function(){const p=getCurrentPages().slice(-1)[0];return p.data.question?.images.length&&p.data.question.images.every(i=>i.loaded&&i.cropped)},'cropped source question',20000)
  await call('simulator_screenshot',{path:path.join(output,'topic-exact-focus.png'),optimize:false})
  await scrollTo('.mcq-options')
  await tap('.mcq-option[data-value="B"]')
  const chosen=await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {choice:p.data.choice,photo:p.data.photo,choiceMode:p.data.question.choiceMode,total:p.data.total}})
  assert.deepEqual(chosen,{choice:'B',photo:'',choiceMode:true,total:6})
  await call('automation_page_action',{action:'callMethod',method:'submit'})
  report.topic=await until(function(){const p=getCurrentPages().slice(-1)[0];return !p.data.busy?{result:p.data.objectiveResult,error:p.data.error}:null},'topic objective scoring',30000)
  assert.equal(report.topic.error,'');assert.equal(report.topic.result.available,true)
  await scrollTo('.mcq-options')
  await call('simulator_screenshot',{path:path.join(output,'topic-p1-abcd.png'),optimize:false})
  // Pin the official paper for reproducible correct/incorrect option checks.
  await call('automation_navigate',{action:'navigateTo',url:'/pages/stem/paper?subject=9702&routeId=cie-9702-as-physics&paperId=cie-9702-9702_m25_qp_12'})
  await until(function(){const p=getCurrentPages().slice(-1)[0];return p.route==='pages/stem/paper'&&p.data.ready&&!p.data.loading&&p.data.sourceFocused&&p.data.sourceViews.length&&p.data.sourceLoadedCount===p.data.sourceImages.length},'native P1 paper focus',20000)
  const firstFocus=await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {number:p.data.questionNumber,style:p.data.sourceViews[0].imageStyle}})
  await call('simulator_screenshot',{path:path.join(output,'paper-q1-exact-focus.png'),optimize:false})
  await scrollTo('.mcq-options')
  await tap('.mcq-option[data-value="A"]')
  await call('automation_page_action',{action:'callMethod',method:'next'})
  const secondFocus=await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {number:p.data.questionNumber,style:p.data.sourceViews[0].imageStyle}})
  assert.equal(secondFocus.number,2);assert.notEqual(firstFocus.style,secondFocus.style,'same original page must use a different crop for Q2')
  await tap('.mcq-option[data-value="D"]')
  await call('automation_page_action',{action:'callMethod',method:'submitPaper'})
  report.paper=await until(function(){const p=getCurrentPages().slice(-1)[0];return !p.data.gradingRunning&&!p.data.gradingFinishing?{summary:p.data.reportSummary,error:p.data.error,choiceMode:p.data.choiceMode}:null},'paper objective report',45000)
  if(report.paper.summary?.objectiveCount!==2){
   const diagnostic=await evaluate(async function(){const p=getCurrentPages().slice(-1)[0],service=require('utils/nativePaperService.js');let stage='context';try{const c=await service.paperContext(p.__draft);stage='sync';await service.syncPaperAttempt(p.__draft,c,p.data.maxMarks);stage='objective';const result=await service.markPaperChoice(p.__draft,c.questions.find(q=>q.number===1),p.__draft.answers[1].choice);return {stage,available:result.available,rows:p.data.reportRows}}catch(e){return {stage,code:e.code||'',status:e.statusCode||0,message:e.message,rows:p.data.reportRows}}})
   console.log(JSON.stringify({failedPaper:report.paper,diagnostic}))
  }
  assert.equal(report.paper.error,'');assert.equal(report.paper.choiceMode,true);assert.equal(report.paper.summary.objectiveCount,2);assert.equal(report.paper.summary.aiCount,0)
  assert.equal(report.paper.summary.objectiveScore,1,'real reviewed keys must distinguish correct and incorrect selections')
  await scrollTo('.paper-report')
  await call('simulator_screenshot',{path:path.join(output,'paper-p1-abcd-report.png'),optimize:false})
  console.log(JSON.stringify({status:'pass',...report}))
 }finally{await account.end()}
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
