const {readPaperDraft,savePaperDraft,current}=require('./nativePaper')
const locks=new Set()
const numbers=draft=>Object.keys(draft.answers||{}).map(Number).filter(n=>Number.isInteger(n)&&n>0&&n<=99&&draft.answers[n]?.photo).sort((a,b)=>a-b)
const read=key=>{const value=readPaperDraft(key);return value?JSON.parse(JSON.stringify(value)):null}
const validResult=(result,part)=>result?.source==='ai'&&result.provisional===true&&Number.isFinite(result.score)&&result.score>=0&&result.maxScore===part.marks&&result.score<=part.marks&&Number.isFinite(result.confidence)&&result.confidence>=0&&result.confidence<=1
const completed=answer=>['ai','self'].includes(answer?.assessment?.state)&&Number.isFinite(answer.assessment.score)&&Number.isFinite(answer.assessment.maxMarks)&&answer.assessment.maxMarks>=0&&answer.assessment.score>=0&&answer.assessment.score<=answer.assessment.maxMarks
const questionMax=q=>q?.parts?.length&&new Set(q.parts.map(p=>p.partId)).size===q.parts.length&&q.parts.every(p=>p.partId&&Number.isFinite(p.marks)&&p.marks>=0)?q.parts.reduce((sum,p)=>sum+p.marks,0):null
function paperReport(draft,paperMax=null){
 const rows=numbers(draft).map(number=>{
  const answer=draft.answers[number],base=answer.assessment||{},student=answer.studentAssessment||(base.state==='self'?base:null)
  const studentValid=completed({assessment:student}),aiPending=!['ai','self','self-required'].includes(base.state)
  const assessment=base.state!=='ai'&&studentValid?student:base,state=['ai','self'].includes(assessment.state)&&!completed({assessment})?'pending':assessment.state||'pending'
  const details=Object.entries(answer.results||{}).filter(([,r])=>r.source==='ai').map(([id,r])=>({id,label:r.label||id,score:r.score,maxScore:r.maxScore,summary:String(r.summary||'').slice(0,1500),reviewRequired:r.reviewRequired===true}))
  const scored=['ai','self'].includes(state)
  return {number,state,aiPending,studentScore:studentValid?student.score:null,studentMax:studentValid?student.maxMarks:null,source:state==='ai'?'AI估分':state==='self'?'学生自评':state==='self-required'?'待自评':'待AI评分',score:scored?assessment.score:null,maxScore:assessment.maxMarks??null,maxSource:assessment.maxSource||'',reason:assessment.reason||'',details,reviewRequired:state==='ai'&&details.some(r=>r.reviewRequired)}
 })
 const ai=rows.filter(r=>r.state==='ai'),self=rows.filter(r=>r.state==='self'),scored=[...ai,...self],complete=rows.length>0&&scored.length===rows.length&&!rows.some(r=>r.aiPending)
 const aiScore=ai.reduce((sum,r)=>sum+r.score,0),selfScore=self.reduce((sum,r)=>sum+r.score,0),maxScore=scored.reduce((sum,r)=>sum+(r.maxScore||0),0)
 const nextSteps=ai.filter(r=>r.score<r.maxScore).sort((a,b)=>(b.maxScore-b.score)-(a.maxScore-a.score)).slice(0,3).map(r=>'优先复盘第 '+r.number+' 题：AI估计失分 '+(r.maxScore-r.score)+' 分，结合下方小问说明检查步骤。')
 return {schemaVersion:'native-paper-report-v1',generatedAt:Date.now(),attemptId:draft.id,paperId:draft.paperId,routeId:draft.routeId,stage:draft.stage,submittedAt:draft.submittedAt,rows,nextSteps,submittedQuestions:rows.length,aiCount:ai.length,selfCount:self.length,needsSelf:rows.filter(r=>r.state==='self-required').length,pending:rows.filter(r=>r.aiPending||r.state==='pending').length,aiScore,selfScore,score:aiScore+selfScore,maxScore,paperMax,complete,wholePaper:complete&&Number.isInteger(draft.questionCount)&&draft.questionCount===rows.length&&rows.every((r,i)=>r.number===i+1)&&Number.isFinite(paperMax)&&paperMax>0&&maxScore===paperMax&&rows.every(r=>r.maxSource==='source'),scoreSource:complete?(ai.length&&self.length?'mixed':ai.length?'ai':'self'):ai.length?'partial-ai':self.length?'partial-self':'pending',notice:'AI成绩为辅助估分；自评由学生填写。未评分题不按零分处理。'}
}
function persist(draft,onUpdate,paperMax){draft.report=paperReport(draft,paperMax);savePaperDraft(draft);onUpdate?.(draft)}
function reason(error){return error?.statusCode===401?'账号未连接，AI未完成；可登录后重试。':error?.code==='source_missing'?'本题缺少可核验的AI批改资料。':'AI未完成本题，已有结果和照片已保留。'}
async function runPaperAssessment(key,{loadContext,sync,mark,active=()=>true,onUpdate=()=>{},paperMax=null}={}){
 if(locks.has(key))throw new Error('上一轮批改请求尚未结束，请稍后继续。')
 let draft=read(key)
 if(!draft?.submitted||!numbers(draft).length)throw new Error('请先提交已保存的作答。')
 locks.add(key)
 const canSave=()=>readPaperDraft(key)?.id===draft.id&&current(draft)
 const alive=()=>active()&&canSave()
 try{
  draft.grading={schemaVersion:'native-paper-grading-v1',status:'running'}
  for(const n of numbers(draft)){
   const answer=draft.answers[n]
   if(Object.values(answer.results||{}).some(r=>r.source!=='ai')&&!answer.legacyAiResults)answer.legacyAiResults=JSON.parse(JSON.stringify(answer.results))
   if(!completed(answer))answer.assessment={...answer.assessment,state:'pending'}
  }
  persist(draft,onUpdate,paperMax)
  let context,setupError
  try{context=await loadContext();if(!alive())return;await sync(draft,context)}catch(error){setupError=error}
  if(!alive())return
  for(const number of numbers(draft)){
   if(!alive())return
   draft=read(key);const answer=draft.answers[number]
   if(completed(answer))continue
   const question=context?.questions?.find(q=>q.number===number),maxMarks=questionMax(question),revision=answer.revision
   answer.assessment={state:'processing',maxMarks,maxSource:maxMarks===null?'':'source',reason:''};persist(draft,onUpdate,paperMax)
   try{
    if(!question?.parts.length||maxMarks===null)throw Object.assign(Error('source missing'),{code:'source_missing'})
    // Old versions stored verifiedResult without a source tag. Preserve the original
    // and migrate only results that still match the canonical part and numeric bounds.
    for(const part of question.parts){
     const old=answer.results?.[part.partId]
     if(old&&old.source===undefined&&validResult({...old,source:'ai'},part))answer.results[part.partId]={...old,source:'ai',label:part.label}
    }
    persist(draft,onUpdate,paperMax)
    const completedPartIds=question.parts.filter(p=>validResult(answer.results?.[p.partId],p)).map(p=>p.partId)
    if(setupError&&completedPartIds.length<question.parts.length)throw setupError
    if(completedPartIds.length<question.parts.length)await mark(draft,question,answer.photo,async(part,result)=>{
     if(!canSave())return
     const latest=read(key)
     if(latest.answers[number]?.revision!==revision)throw Error('Answer changed')
     const safe={source:'ai',label:part.label,score:result.score,maxScore:result.maxScore,confidence:result.confidence,summary:String(result.summary||'').slice(0,6000),provisional:result.provisional===true,reviewRequired:result.reviewRequired===true}
     if(!validResult(safe,part))throw Error('Invalid AI result')
     latest.answers[number].results={...(latest.answers[number].results||{}),[part.partId]:safe};persist(latest,active()?onUpdate:null,paperMax)
    },{shouldContinue:alive,completedPartIds})
    if(!alive())return
    draft=read(key)
    if(draft.answers[number]?.revision!==revision)throw Error('Answer changed')
    if(!question.parts.every(p=>validResult(draft.answers[number].results?.[p.partId],p)))throw Error('Incomplete AI result')
    draft.answers[number].assessment={state:'ai',score:question.parts.reduce((sum,p)=>sum+draft.answers[number].results[p.partId].score,0),maxMarks,maxSource:'source',reason:''}
   }catch(error){
    if(!alive())return
    if([401,403,429].includes(error?.statusCode)||error?.statusCode>=500||/^network_|^auth_/.test(error?.code||''))setupError=error
    draft=read(key);draft.answers[number].assessment={state:'self-required',maxMarks,maxSource:maxMarks===null?'':'source',reason:reason(error)}
   }
   persist(draft,onUpdate,paperMax)
  }
 }finally{
  locks.delete(key)
  const latest=read(key)
  if(latest&&latest.id===draft.id){
   for(const n of numbers(latest))if(latest.answers[n].assessment?.state==='processing')latest.answers[n].assessment.state='pending'
   latest.grading={schemaVersion:'native-paper-grading-v1',status:active()?'finished':'paused'};persist(latest,active()?onUpdate:null,paperMax)
  }
 }
}
function selfAssess(key,number,value,declaredMax,paperMax=null){
 const draft=read(key),answer=draft?.answers[number],assessment=answer?.assessment
 if(!draft?.submitted||!answer?.photo||assessment?.state==='ai'&&!answer.studentAssessment&&!answer.selfDraft?.started)throw new Error('请在提交后的等待期间选择自评。')
 const score=String(value??'').trim()===''?NaN:Number(value),maxMarks=assessment?.maxMarks??(String(declaredMax??'').trim()===''?NaN:Number(declaredMax))
 if(!Number.isFinite(score)||!Number.isFinite(maxMarks)||maxMarks<=0||score<0||score>maxMarks||Number.isFinite(paperMax)&&maxMarks>paperMax)throw new Error('请按原卷填写有效的得分和满分。')
 answer.studentAssessment={state:'self',score,maxMarks,maxSource:assessment?.maxSource||'self-declared'}
 if(['self-required','self'].includes(assessment?.state))answer.assessment={...assessment,...answer.studentAssessment}
 persist(draft,null,paperMax);return draft
}
module.exports={runPaperAssessment,paperReport,selfAssess}
