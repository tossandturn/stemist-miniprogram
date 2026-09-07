const {requestJson}=require('./api')
const {readAsJpegDataUrl}=require('./image')
const {verifiedResult}=require('./nativePractice')
const {current}=require('./nativePaper')
function sourceImages(values,paperId){
 if(!Array.isArray(values)||values.some(url=>typeof url!=='string'||!/^\/question-assets\/[A-Za-z0-9_-]+\/qp-\d+\.(jpg|jpeg|png|webp)$/.test(url)||!url.startsWith('/question-assets/'+paperId+'/')))throw new Error('题图与原卷不匹配。')
 return [...new Set(values)]
}
async function paperSources(draft){
 const response=await requestJson('/api/stem/papers/'+encodeURIComponent(draft.paperId)+'/source-context?routeId='+encodeURIComponent(draft.routeId)+'&stage='+encodeURIComponent(draft.stage),undefined,{method:'GET',timeout:12000,stemAuth:false})
 if(!current(draft)||response?.schemaVersion!=='native-paper-sources-v1'||response.paperId!==draft.paperId||response.routeId!==draft.routeId||response.stage!==draft.stage||!Array.isArray(response.questions))throw new Error('试卷题图关联尚未确认。')
 const seen=new Set()
 return {questions:response.questions.map(q=>{if(!Number.isInteger(q.number)||q.number<1||seen.has(q.number)||!String(q.sourceQuestionId).startsWith(draft.paperId+':q'))throw new Error('试卷题号关联无效。');seen.add(q.number);return {number:q.number,sourceQuestionId:q.sourceQuestionId,images:sourceImages(q.images,draft.paperId),parts:[]}})}
}
async function paperContext(draft){
 const response=await requestJson('/api/stem/papers/'+encodeURIComponent(draft.paperId)+'/native-context?routeId='+encodeURIComponent(draft.routeId)+'&stage='+encodeURIComponent(draft.stage),undefined,{method:'GET',timeout:12000})
 if(!current(draft))throw new Error('账号已变化。')
 if(response?.schemaVersion!=='native-paper-context-v1'||response.paperId!==draft.paperId||response.routeId!==draft.routeId||response.stage!==draft.stage||!Array.isArray(response.questions))throw new Error('试卷题目关联尚未确认。')
 const seen=new Set()
 const questions=response.questions.map(q=>{
  if(!Number.isInteger(q.number)||q.number<1||seen.has(q.number)||!String(q.sourceQuestionId).startsWith(draft.paperId+':q'))throw new Error('试卷题目关联不完整。')
  seen.add(q.number)
  const parts=(q.parts||[]).map(p=>{
   if(p.provenance?.sourceQuestionId!==q.sourceQuestionId||p.provenance?.questionPartId!==p.partId||p.provenance?.routeId!==draft.routeId||!p.provenance?.bindingSignature||!Number.isFinite(p.marks)||p.marks<0)throw new Error('题目来源尚未确认。')
   return {partId:p.partId,label:String(p.label||''),marks:p.marks,provenance:p.provenance}
  })
  return {number:q.number,sourceQuestionId:q.sourceQuestionId,parts,images:sourceImages(q.images||[],draft.paperId)}
 })
 return {questions}
}
async function syncPaperAttempt(draft,context,maxMarks){
 if(!current(draft))throw new Error('账号已变化。')
 const markingParts=(context?.questions||[]).flatMap(q=>q.parts.map(p=>({unitPartId:p.partId,provenance:p.provenance})))
 const response=await requestJson('/api/stem/attempts',{
  attemptId:draft.id,mode:'full-paper',routeId:draft.routeId,stage:draft.stage,paperId:draft.paperId,markingParts,
  ...(draft.submitted?{submittedAt:new Date(draft.submittedAt).toISOString()}:{}),
  attempt:{id:draft.id,mode:'full-paper',routeId:draft.routeId,stage:draft.stage,paperId:draft.paperId,paperStudyMode:draft.mode,attemptStatus:draft.submitted?'submitted':'draft',answers:{},selfAssessment:{score:draft.selfScore,maxMarks},evidence:{kind:'photo',count:Object.keys(draft.answers).length}}
 })
 if(!current(draft)||response?.attempt?.attemptId!==draft.id)throw new Error('服务端尚未确认本次练习。')
 return response
}
async function markPaperQuestion(draft,question,photo,onPart){
 if(!draft.submitted||!current(draft)||!question?.parts.length)throw new Error('请先提交试卷，再进行 AI 批改。')
 const imageDataUrl=await readAsJpegDataUrl(photo)
 const response=await requestJson('/api/stem/marking/capabilities',{attemptId:draft.id,mode:'full-paper',submitted:true,paperId:draft.paperId,parts:question.parts.map(p=>({provenance:p.provenance}))})
 if(!current(draft))throw new Error('账号已变化。')
 for(const part of question.parts){
  const grant=response?.capabilities?.filter(c=>c.questionPartId===part.partId&&typeof c.markingGrant==='string')
  if(grant?.length!==1)throw new Error('批改授权未完整返回。')
  const result=await requestJson('/api/ai/mark-handwriting',{attemptId:draft.id,mode:'full-paper',submitted:true,paperId:draft.paperId,markingGrant:grant[0].markingGrant,imageDataUrl,typedResponse:'',provenance:part.provenance},{timeout:60000})
  if(!current(draft))throw new Error('账号已变化。')
  await onPart(part,verifiedResult(result,part))
 }
}
module.exports={paperSources,paperContext,syncPaperAttempt,markPaperQuestion}
