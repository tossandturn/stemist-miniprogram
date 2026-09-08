const {loadIeltsContent}=require('./ieltsContent')
const {requestIeltsLearning}=require('./ieltsLearning')
const {createClock,clockState}=require('./practiceClock')
const {startWritingFeedback,writingJob}=require('./ieltsWriting')
const {readAsJpegDataUrl}=require('./image')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const PREFIX='stemistIeltsExam:'
const SOURCE_REVISION=/^[a-f0-9]{64}$/
const writingSourceReady=value=>value?.sourceAvailability==='ready'&&SOURCE_REVISION.test(String(value.sourceRevision||''))
function archiveWritingSource(exam,value){exam.writingSourceHistory=[...(exam.writingSourceHistory||[]).slice(-3),value]}
function saveExam(exam){if(exam.owner!==owner()||exam.epoch!==epoch())throw new Error('账号已变化，请重新打开模拟。');wx.setStorageSync(PREFIX+exam.key,exam)}
function readExam(key){const exam=wx.getStorageSync(PREFIX+key);return exam&&exam.owner===owner()&&exam.epoch===epoch()?exam:null}
function completeSets(bank){
 return bank.listening.flatMap(listening=>{
  const match=t=>t.book===listening.book&&t.test===listening.test
  const reading=bank.reading.find(match),writing=bank.writing.filter(match),speaking=bank.speaking.find(match)
  const task1=writing.find(t=>/task1$/i.test(t.id)),task2=writing.find(t=>/task2$/i.test(t.id))
  return reading&&task1&&task2&&speaking&&writingSourceReady(task1)&&writingSourceReady(task2)?[{id:'cam'+listening.book+'-test'+listening.test,title:'Cambridge '+listening.book+' · Test '+listening.test,listening,reading,writing:[task1,task2],speaking}]:[]
 })
}
async function examChoices(){return completeSets(await loadIeltsContent())}
async function newExam(context,selected){
 const expectedOwner=owner(),expectedEpoch=epoch()
 const all=await loadIeltsContent(),bank=Object.fromEntries(Object.entries(all).map(([module,tasks])=>[module,tasks.filter(t=>/^cam\d+-/.test(t.id))])),pick=items=>items[Math.floor(Math.random()*items.length)]
 if(expectedOwner!==owner()||expectedEpoch!==epoch())throw new Error('账号已变化。')
 const sources=context==='same-test'?completeSets(bank).find(set=>set.id===selected):{id:'random',title:'随机模拟',listening:pick(bank.listening),reading:pick(bank.reading),writing:[pick(bank.writing.filter(t=>/task1$/i.test(t.id)&&writingSourceReady(t))),pick(bank.writing.filter(t=>/task2$/i.test(t.id)&&writingSourceReady(t)))],speaking:pick(bank.speaking)}
 if(!sources||!sources.listening||!sources.reading||!sources.speaking||sources.writing.some(t=>!t))throw new Error('当前题库还不能组成完整模拟。')
 const key='mini-exam-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)
 const exam={key,owner:owner(),epoch:epoch(),context,title:sources.title,sources:{listening:sources.listening.id,reading:sources.reading.id,writing:sources.writing.map(t=>t.id),speaking:sources.speaking.id},sourceRevisions:{writing:sources.writing.map(t=>t.sourceRevision)},modules:{},startedAt:Date.now(),submitted:false}
 const manifest={examId:sources.id,seed:key,bankVersion:'ieltsist-server',generatorVersion:'native-exam-v1',listeningSourceId:exam.sources.listening,readingSourceId:exam.sources.reading,writingSourceIds:exam.sources.writing,speakingSourceId:exam.sources.speaking}
 const capability=await requestIeltsLearning('/api/objective/exams',{clientExamKey:key,context,listeningTaskId:exam.sources.listening,readingTaskId:exam.sources.reading,manifest})
 if(!capability?.examId||!capability.examToken)throw new Error('模拟状态未确认，请重试。')
 exam.capability=capability;exam.manifest=capability.manifest||manifest;saveExam(exam);return exam
}
function startExamModuleClock(key,module,minutes){
 const exam=readExam(key)
 if(!exam)throw new Error('模拟已结束或账号已变化。')
 const group=module.startsWith('writing')?'writing':module
 if(!['listening','reading','writing','speaking'].includes(group))throw new Error('模拟项目无效。')
 exam.clocks=exam.clocks||{}
 if(exam.submitted&&!exam.clocks[group])throw new Error('模拟已结束。')
 if(!exam.clocks[group]){exam.clocks[group]=createClock(group==='writing'?60:minutes);saveExam(exam)}
 return exam.clocks[group]
}
function completeExamModule(key,module,value){
 const exam=readExam(key);if(!exam||exam.submitted)throw new Error('模拟已结束或账号已变化。')
 if(module==='writing1'||module==='writing2'){
  const index=module==='writing1'?0:1,previous=exam.modules[module],previousJob=exam.writingJobs?.[index]
  const bindingChanged=Boolean(previous)&&previous?.sourceRevision!==value?.sourceRevision
  const staleJob=Boolean(previousJob)&&(exam.writingJobRevisions?.[index]!==value?.sourceRevision||bindingChanged)
  if(bindingChanged||staleJob)archiveWritingSource(exam,{module,sourceRevision:previous?.sourceRevision||exam.writingJobRevisions?.[index]||'',jobId:previousJob||'',value:previous||null})
  if(staleJob){
   exam.writingJobs[index]='';if(exam.writingJobRevisions)exam.writingJobRevisions[index]=''
  }
  exam.sourceRevisions=exam.sourceRevisions||{writing:[]};exam.sourceRevisions.writing=exam.sourceRevisions.writing||[]
  if(writingSourceReady(value))exam.sourceRevisions.writing[index]=value.sourceRevision
 }
 exam.modules[module]=value
 const group=module.startsWith('writing')?'writing':module
 if(exam.clocks?.[group]&&(group!=='writing'||exam.modules.writing1?.complete&&exam.modules.writing2?.complete))exam.clocks[group].finishedAt=Date.now()
 saveExam(exam);return exam
}
async function submitExam(key){
 const exam=readExam(key);if(!exam)throw new Error('未找到这次模拟。')
 if(exam.submitted)return exam
 if(!['listening','reading','writing1','writing2','speaking'].every(name=>exam.modules[name]?.complete))throw new Error('请先完成各项练习。')
 exam.writingJobs=exam.writingJobs||[]
 const writingModules=[exam.modules.writing1,exam.modules.writing2]
 if(writingModules.some(item=>!writingSourceReady(item)))throw new Error('写作题目来源已经更新或仍在核验，请重新打开两道写作题。')
 exam.writingJobRevisions=exam.writingJobRevisions||[]
 for(let index=0;index<2;index++){
  if(exam.writingJobs[index]&&exam.writingJobRevisions[index]!==writingModules[index].sourceRevision){archiveWritingSource(exam,{module:'writing'+(index+1),sourceRevision:exam.writingJobRevisions[index]||'',jobId:exam.writingJobs[index]});exam.writingJobs[index]='';exam.writingJobRevisions[index]='';saveExam(exam)}
  if(exam.writingJobs[index])continue
  const item=writingModules[index],images=item.photoPath?[await readAsJpegDataUrl(item.photoPath)]:[]
  if(!readExam(key))throw new Error('账号已变化。')
  exam.writingJobs[index]=await startWritingFeedback(item.prompt,item.photoPath?'':item.essay,exam.sources.writing[index],images,item.sourceRevision)
  exam.writingJobRevisions[index]=item.sourceRevision
  saveExam(exam)
 }
 const started=Date.now()
 for(let index=0;index<2;index++){
  while(true){
   if(!readExam(key))throw new Error('账号已变化。')
   try{const job=await writingJob(exam.writingJobs[index]);if(job.status==='done')break}
   catch(error){if(error.terminalJob||error.statusCode===404){exam.writingJobs[index]='';saveExam(exam)}throw error}
   if(Date.now()-started>210000)throw new Error('写作仍在批改，答案已保存；稍后可继续生成报告。')
   await new Promise(resolve=>setTimeout(resolve,1800))
  }
 }
 if(!readExam(key))throw new Error('账号已变化。')
 const result=await requestIeltsLearning('/api/exam/report',{examContext:exam.context,fullExamManifest:exam.manifest,listening:exam.modules.listening.submission,reading:exam.modules.reading.submission,writing:{feedbackJobIds:exam.writingJobs,tasks:writingModules.map((m,i)=>({id:exam.sources.writing[i],type:'Task '+(i+1),title:m.title,prompt:m.prompt,essay:m.photoPath?'':m.essay}))},speaking:{title:exam.modules.speaking.title,selfReportedBand:exam.modules.speaking.band??'',notes:exam.modules.speaking.feedback||''}},{timeout:30000})
 if(!readExam(key))throw new Error('账号已变化。')
 const feedback=String(result.feedback||result.report||'');if(!feedback)throw new Error('报告未完整返回，答案已保留。')
 exam.submitted=true;exam.result={feedback,mode:String(result.mode||'local')};saveExam(exam);return exam
}
module.exports={PREFIX,completeSets,examChoices,newExam,saveExam,readExam,completeExamModule,submitExam,startExamModuleClock,clockState}
