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
  await evaluate(function(){
   const qa=getApp().__nativeQa;qa.choiceTest={phase:'assembling'}
   ;(async()=>{try{
    const inventory=require('utils/inventory.js');inventory.clearInventoryCache()
    const routeId='cie-9702-as-physics',data=await inventory.fetchRouteInventory(routeId),native=require('utils/nativePractice.js')
    if(!data.practicePolicy?.allowReviewedSubsetStudy)throw Error('Missing P1 study capability')
    const topic=data.topics.find(t=>native.selectionState(data,[t.id],[1],6).canStart)
    if(!topic)throw Error('No P1 chapter')
    const s=await native.generatePractice({routeId,stage:'AS',subjectCode:'9702',components:[1],syllabusTopicIds:[topic.id],questionCount:6})
    if(s.questions.some(q=>q.component!==1||q.answerFormat!=='single-choice'))throw Error('Not exclusively P1 MCQ')
    native.saveSession(s);qa.choiceTest={phase:'ready',sessionId:s.id,paperId:s.questions[0].paperId}
   }catch(error){qa.choiceTest={phase:'failed',message:error.message}}})()
   return true
  })
  const setup=await until(function(){const q=getApp().__nativeQa?.choiceTest;return q&&q.phase!=='assembling'?q:null},'P1 assembly',30000)
  assert.equal(setup.phase,'ready',setup.message)
  await call('automation_navigate',{action:'navigateTo',url:'/pages/stem/practice?sessionId='+encodeURIComponent(setup.sessionId)})
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
  await until(function(){const p=getCurrentPages().slice(-1)[0];return p.route==='pages/stem/paper'&&p.data.ready&&!p.data.loading},'native P1 paper',20000)
  await scrollTo('.mcq-options')
  await tap('.mcq-option[data-value="A"]')
  await call('automation_page_action',{action:'callMethod',method:'next'})
  await tap('.mcq-option[data-value="D"]')
  await call('automation_page_action',{action:'callMethod',method:'submitPaper'})
  report.paper=await until(function(){const p=getCurrentPages().slice(-1)[0];return !p.data.gradingRunning&&!p.data.gradingFinishing?{summary:p.data.reportSummary,error:p.data.error,choiceMode:p.data.choiceMode}:null},'paper objective report',45000)
  assert.equal(report.paper.error,'');assert.equal(report.paper.choiceMode,true);assert.equal(report.paper.summary.objectiveCount,2);assert.equal(report.paper.summary.aiCount,0)
  assert.equal(report.paper.summary.objectiveScore,1,'real reviewed keys must distinguish correct and incorrect selections')
  await scrollTo('.paper-report')
  await call('simulator_screenshot',{path:path.join(output,'paper-p1-abcd-report.png'),optimize:false})
  console.log(JSON.stringify({status:'pass',...report}))
 }finally{await account.end()}
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
