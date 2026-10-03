// Opt-in production/native Chapter Study acceptance. Uses one generated QA
// account, real public inventory/original content and a synthetic A selection.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs'),account=require('./helpers/native-qa-account.cjs')
if(!process.argv.includes('--run-production'))throw Error('Explicit --run-production required: this creates an isolated QA account and submits one synthetic answer.')
const outputIndex=process.argv.indexOf('--output')
if(outputIndex<0||!process.argv[outputIndex+1])throw Error('Pass --output <QA evidence directory>.')
const output=path.resolve(process.argv[outputIndex+1]),routeId='cie-9700-as-biology'
const tap=selector=>call('automation_element_action',{action:'tap',selector,'wait-for-selector':selector})
const shot=name=>call('simulator_screenshot',{path:path.join(output,name+'.png'),optimize:false})
async function scrollTo(selector){
 const source='function(){return new Promise(resolve=>{const q=wx.createSelectorQuery();q.select('+JSON.stringify(selector)+').boundingClientRect();q.selectViewport().scrollOffset();q.exec(r=>resolve(Math.max(0,(r[0]?.top||0)+(r[1]?.scrollTop||0)-100)))})}'
 await call('automation_viewport_action',{action:'pageScrollTo','scroll-top':await evaluate(source)})
}
async function geometry(selector){
 const source='function(){return new Promise(resolve=>{const q=wx.createSelectorQuery();q.select('+JSON.stringify(selector)+').boundingClientRect();q.exec(r=>{const w=wx.getWindowInfo();resolve(r[0]?{...r[0],viewportWidth:w.windowWidth,viewportHeight:w.windowHeight}:null)})})}'
 return evaluate(source)
}
async function main(){
 fs.mkdirSync(output,{recursive:true})
 const report={status:'pending',routeId,account:'generated-isolated',answerFixture:'synthetic-A',content:'public-original-foundation-only',screenshots:[]}
 try{
  await account.begin()
  await evaluate(function(){require('utils/inventory.js').clearInventoryCache();return true})
  await call('automation_navigate',{action:'navigateTo',url:'/pages/stem/topics?routeId='+routeId})
  const builder=await until(function(){const p=getCurrentPages().at(-1);if(p?.route!=='pages/stem/topics'||p.data.loading||!p.data.topics?.length)return null;return{studyMode:p.data.studyMode,chapterStudyAvailable:p.data.chapterStudyAvailable,topics:p.data.topics.map(t=>({id:t.id,count:t.count,sourceLabel:t.sourceLabel,startable:t.startable})),questionCount:p.data.questionCount,canStart:p.data.canStart,error:p.data.error}},'real Biology chapter inventory',30000)
  assert.equal(builder.error,'');assert.equal(builder.studyMode,'chapter-study');assert.equal(builder.chapterStudyAvailable,true);assert.equal(builder.topics.length,12,'Biology AS must expose all 12 real chapters')
  assert.ok(builder.topics.every(topic=>topic.count===1&&topic.sourceLabel==='原创基础练习'&&topic.startable),'every official gap must expose one clearly labelled original fallback')
  assert.equal(builder.canStart,false)
  const first=builder.topics[0],topicSelector='.topic-choice[data-id="'+first.id+'"]'
  await scrollTo(topicSelector);await tap(topicSelector)
  const selected=await until(function(){const p=getCurrentPages().at(-1);return p.data.selected?.length===1?{id:p.data.selected[0],studyMode:p.data.studyMode,available:p.data.availableCount,count:p.data.questionCount,counts:p.data.counts.map(x=>x.value),canStart:p.data.canStart,label:p.data.topics.find(t=>t.id===p.data.selected[0])?.sourceLabel,error:p.data.error}:null},'first Biology chapter selected')
  assert.deepEqual(selected,{id:first.id,studyMode:'chapter-study',available:1,count:1,counts:[1],canStart:true,label:'原创基础练习',error:''})
  report.builder=selected;await shot('chapter-study-biology-builder');report.screenshots.push('chapter-study-biology-builder.png')
  await scrollTo('.start-native-practice');await tap('.start-native-practice')
  const practice=await until(function(){const p=getCurrentPages().at(-1);if(p?.route!=='pages/stem/practice'||!p.data.question)return null;const s=require('utils/nativePractice.js').readSession(p.data.sessionId),q=p.data.question;return{sessionId:p.data.sessionId,questionId:q.id,prompt:q.prompt,labels:q.options.map(o=>o.label).join(''),optionText:q.options.every(o=>Boolean(o.text)),images:q.images.length,original:q.original,sourceLabel:q.sourceLabel,studyOnly:q.studyOnly,studyMode:s?.studyMode,formalProgressEligible:s?.formalProgressEligible,owner:s?.owner,error:p.data.error}},'native original-foundation practice',30000)
  assert.equal(practice.error,'');assert.equal(practice.original,true);assert.equal(practice.sourceLabel,'原创基础练习');assert.equal(practice.studyOnly,true);assert.equal(practice.studyMode,'chapter-study');assert.equal(practice.formalProgressEligible,false);assert.equal(practice.images,0);assert.equal(practice.labels,'ABCD');assert.equal(practice.optionText,true);assert.ok(practice.prompt.length>20)
  const promptRect=await geometry('.question-column .answer-panel'),optionsRect=await geometry('.mcq-options')
  for(const rect of [promptRect,optionsRect]){assert.ok(rect&&rect.height>=44);assert.ok(rect.left>=0&&rect.right<=rect.viewportWidth+1)}
  report.practice={questionId:practice.questionId,promptVisible:true,labels:practice.labels,images:0,formalProgressEligible:false,phoneGeometry:{prompt:promptRect,options:optionsRect}}
  await shot('chapter-study-original-prompt');report.screenshots.push('chapter-study-original-prompt.png')
  await scrollTo('.mcq-options');await tap('.mcq-option[data-value="A"]')
  const chosen=await evaluate(function(){const p=getCurrentPages().at(-1);return{choice:p.data.choice,photo:p.data.photo,busy:p.data.busy}})
  assert.deepEqual(chosen,{choice:'A',photo:'',busy:false});await shot('chapter-study-synthetic-a-selected');report.screenshots.push('chapter-study-synthetic-a-selected.png')
  await scrollTo('.answer-panel .primary');await tap('.answer-panel .primary')
  const scored=await until(function(){const p=getCurrentPages().at(-1);return !p.data.busy&&(p.data.objectiveResult||p.data.error)?{result:p.data.objectiveResult,error:p.data.error,status:p.data.status}:null},'real original-foundation scorer and attempt persistence',30000)
  assert.equal(scored.error,'');assert.equal(scored.result.original,true);assert.equal(scored.result.scoreScope,'original-learning-only');assert.equal(scored.result.formalProgressEligible,false);assert.equal(scored.result.countsTowardFormalGrade,false);assert.equal(scored.result.selectedOptionId,'A');assert.ok(/^[A-D]$/.test(scored.result.correctOptionId));assert.ok(scored.result.solution?.summary&&scored.result.solution.markPoints?.length)
  const local=await evaluate(function(){const p=getCurrentPages().at(-1),s=require('utils/nativePractice.js').readSession(p.data.sessionId),q=s.questions[s.index],a=s.answers[q.id],qa=getApp().__nativeQa;return{ownerMatches:s.owner===qa.id,attemptId:a.attemptId,resultScope:a.objectiveResult?.scoreScope,formal:a.objectiveResult?.formalProgressEligible,studyMode:s.studyMode,sourcePreference:s.sourcePreference}})
  assert.equal(local.ownerMatches,true);assert.match(local.attemptId,/^mini-set-/);assert.equal(local.resultScope,'original-learning-only');assert.equal(local.formal,false);assert.equal(local.studyMode,'chapter-study');assert.equal(local.sourcePreference,'official-first')
  await evaluate(function(){const app=getApp(),p=getCurrentPages().at(-1),s=require('utils/nativePractice.js').readSession(p.data.sessionId),q=s.questions[s.index],attemptId=s.answers[q.id].attemptId,token=wx.getStorageSync('stemistSessionToken');app.__chapterStudyLive={status:'pending'};wx.request({url:'https://stem.ieltsist.com/api/stem/attempts',method:'GET',timeout:15000,header:{Authorization:'Bearer '+token},success:r=>{const attempts=r.data?.attempts||[],matches=attempts.filter(a=>a.attemptId===attemptId),hit=matches[0];app.__chapterStudyLive={status:'done',http:r.statusCode,matches:matches.length,total:attempts.length,ownerMatches:s.owner===app.__nativeQa?.id,sourceKind:hit?.binding?.parts?.[0]?.sourceKind||'',studyMode:hit?.attempt?.studyMode||'',sourcePreference:hit?.attempt?.sourcePreference||'',scoreScope:hit?.attempt?.scoreResult?.scoreScope||''}},fail:()=>{app.__chapterStudyLive={status:'failed'}}});return true})
  const history=await until(function(){const q=getApp().__chapterStudyLive;return q&&q.status!=='pending'?q:null},'private attempt history echo',20000)
  assert.deepEqual(history,{status:'done',http:200,matches:1,total:1,ownerMatches:true,sourceKind:'original-foundation',studyMode:'chapter-study',sourcePreference:'official-first',scoreScope:'original-learning-only'})
  report.result={selectedOptionId:'A',score:scored.result.score,maxScore:scored.result.maxScore,correct:scored.result.correct,scoreScope:scored.result.scoreScope,formalProgressEligible:false,privateHistoryEcho:true}
  await scrollTo('.answer-column .choice-result');await shot('chapter-study-original-result');report.screenshots.push('chapter-study-original-result.png')
  report.status='pass';fs.writeFileSync(path.join(output,'chapter-study-native-live.json'),JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report))
 }finally{
  await evaluate(function(){delete getApp().__chapterStudyLive;return true}).catch(()=>{})
  await account.end()
 }
}
main().catch(error=>{console.error(String(error.message||'Chapter Study native production QA failed'));process.exitCode=1})
