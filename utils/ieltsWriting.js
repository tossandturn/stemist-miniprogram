const {requestIeltsLearning}=require('./ieltsLearning')
function normalizeWritingResult(result){
 const ai=String(result?.mode||'').startsWith('ai:')
 const analysis=result?.analysis||{}
 const scoreValue=value=>typeof value==='number'||typeof value==='string'&&value.trim()!==''?Number(value):NaN
 const criteria=(analysis.criteria||[]).slice(0,4).map(item=>({label:String(item.label||''),score:scoreValue(item.score),reason:String(item.feedback||item.reason||item.summary||''),evidence:String(item.evidence||'')}))
 const valid=criteria.length===4&&new Set(criteria.map(item=>item.label)).size===4&&criteria.every(item=>item.label&&Number.isFinite(item.score)&&item.score>=0&&item.score<=9)
 const score=scoreValue(analysis.overall)
 const gradeReady=ai&&valid&&analysis.reviewRequired!==true&&analysis.confidence!=='low'&&Number.isFinite(score)&&score>=0&&score<=9
 return {ai,gradeReady,feedback:String(result?.feedback||'').slice(0,60000),criteria:gradeReady?criteria:[],band:gradeReady?score:null,
  warning:!ai?'AI 批改未完成，以下仅为基础建议；作文已保留。':!gradeReady?'批改证据不足，暂不显示分数；反馈需要复核。':String(result.warning||'AI 练习估分，不是官方 IELTS 成绩。'),reportUrl:/^\/api\/report\/pdf\/[a-zA-Z0-9_-]+$/.test(result?.pdfUrl||'')?result.pdfUrl:''}
}
async function startWritingFeedback(prompt,essay){
 const response=await requestIeltsLearning('/api/writing/feedback/start',{prompt,essay},{timeout:15000})
 if(typeof response?.jobId!=='string'||!/^[a-zA-Z0-9-]{10,80}$/.test(response.jobId))throw new Error('批改尚未开始，请重试。')
 return response.jobId
}
async function writingJob(jobId){
 if(!/^[a-zA-Z0-9-]{10,80}$/.test(jobId))throw new Error('批改记录无效。')
 const response=await requestIeltsLearning('/api/writing/feedback/job/'+encodeURIComponent(jobId),undefined,{method:'GET',timeout:15000})
 if(response?.status==='done')return {status:'done',result:normalizeWritingResult(response.result)}
 if(response?.status==='error'){const error=new Error('批改暂未完成，作文已保留，请重试。');error.terminalJob=true;throw error}
 if(response?.status!=='pending')throw new Error('批改状态异常，请稍后重试。')
 return {status:'pending'}
}
module.exports={normalizeWritingResult,startWritingFeedback,writingJob}
