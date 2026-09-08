const {requestIeltsLearning}=require('./ieltsLearning')
const CAMBRIDGE_WRITING=/^cam\d+-w-test\d+-task[12]$/
const SOURCE_REVISION=/^[a-f0-9]{64}$/
function requireSourceRevision(taskId,sourceRevision){
 if(CAMBRIDGE_WRITING.test(String(taskId||''))&&!SOURCE_REVISION.test(String(sourceRevision||'')))throw new Error('题目来源仍在核验或已经更新，请重新打开题目。')
 return SOURCE_REVISION.test(String(sourceRevision||''))?String(sourceRevision):''
}
function sourceError(error){
 if(Number(error?.statusCode)!==409)return error
 if(error.code==='writing_source_review_required')error.message='这道题正在核验，作文和照片已保留，暂不提交批改。'
 if(error.code==='writing_source_changed')error.message='题目来源已经更新，作文和照片已保留；请核对新题后确认。'
 return error
}
function normalizeWritingResult(result){
 const ai=String(result?.mode||'').startsWith('ai:')
 const analysis=result?.analysis||{}
 const scoreValue=value=>typeof value==='number'||typeof value==='string'&&value.trim()!==''?Number(value):NaN
 const criteria=(analysis.criteria||[]).slice(0,4).map(item=>({label:String(item.label||''),score:scoreValue(item.score),reason:String(item.feedback||item.reason||item.summary||''),evidence:String(item.evidence||'')}))
 const valid=criteria.length===4&&new Set(criteria.map(item=>item.label)).size===4&&criteria.every(item=>item.label&&Number.isFinite(item.score)&&item.score>=0&&item.score<=9)
 const score=scoreValue(analysis.overall)
 const reviewRequired=analysis.reviewRequired===true||analysis.confidence==='low'||result?.review?.required===true||result?.contract?.review?.required===true
 const gradeReady=ai&&valid&&!reviewRequired&&Number.isFinite(score)&&score>=0&&score<=9
 return {ai,gradeReady,feedback:String(result?.feedback||'').slice(0,60000),criteria:gradeReady?criteria:[],band:gradeReady?score:null,taskScores:(analysis.taskScores||[]).map(task=>({taskNumber:task.taskNumber,band:gradeReady?task.overall:null})),highestImpact:analysis.highestImpact||null,
  warning:!ai?'AI 批改未完成，以下仅为基础建议；作文已保留。':!gradeReady?'批改证据不足，暂不显示分数；反馈需要复核。':String(result.warning||'AI 练习估分，不是官方 IELTS 成绩。'),reportUrl:/^\/api\/report\/pdf\/[a-zA-Z0-9_-]+$/.test(result?.pdfUrl||'')?result.pdfUrl:''}
}
async function startWritingFeedback(prompt,essay,taskId='',imageDataUrls=[],sourceRevision=''){
 const revision=requireSourceRevision(taskId,sourceRevision)
 let response
 try{response=await requestIeltsLearning('/api/writing/feedback/start',{prompt,essay,...(taskId?{taskId}: {}),...(revision?{sourceRevision:revision}:{}),...(imageDataUrls.length?{imageDataUrls}: {})},{timeout:imageDataUrls.length?30000:15000})}catch(error){throw sourceError(error)}
 if(typeof response?.jobId!=='string'||!/^[a-zA-Z0-9-]{10,80}$/.test(response.jobId))throw new Error('批改尚未开始，请重试。')
 return response.jobId
}
function writingPairs(tasks){
 const groups=new Map()
 for(const task of tasks){const match=task.id.match(/^cam(\d+)-w-test(\d+)-task([12])$/);if(!match)continue;const key='cam'+match[1]+'-test'+match[2],group=groups.get(key)||{id:key,book:Number(match[1]),test:Number(match[2]),title:'Cambridge '+match[1]+' · Test '+match[2],items:[],sources:[]},index=Number(match[3])-1;group.items[index]=task.id;group.sources[index]={sourceAvailability:task.sourceAvailability,sourceRevision:String(task.sourceRevision||'')};groups.set(key,group)}
 return [...groups.values()].filter(group=>group.items.length===2&&group.items[0]&&group.items[1]).map(group=>({...group,sourceAvailability:group.sources.every(source=>source?.sourceAvailability==='ready'&&SOURCE_REVISION.test(source.sourceRevision))?'ready':'pending-review',sourceRevisions:group.sources.map(source=>source?.sourceRevision||'')}))
}
async function startWritingPairFeedback(items){
 if(!Array.isArray(items)||items.length!==2||items.some(item=>(!item.essay?.trim()&&!item.imageDataUrls?.length)||!item.prompt?.trim()))throw new Error('请完成 Task 1 和 Task 2。')
 const prepared=items.map(item=>({...item,sourceRevision:requireSourceRevision(item.id,item.sourceRevision)}))
 let response
 try{response=await requestIeltsLearning('/api/writing/feedback/start',{items:prepared.map((item,index)=>({id:item.id,taskNumber:index+1,kind:index===0?'academic-task-1':'task-2',prompt:item.prompt,essay:item.essay||'',...(item.sourceRevision?{sourceRevision:item.sourceRevision}:{}),...(item.imageDataUrls?.length?{imageDataUrls:item.imageDataUrls}:{})}))},{timeout:items.some(item=>item.imageDataUrls?.length)?30000:15000})}catch(error){throw sourceError(error)}
 if(typeof response?.jobId!=='string'||!/^[a-zA-Z0-9-]{10,80}$/.test(response.jobId))throw new Error('批改尚未开始，请重试。')
 return response.jobId
}
async function writingJob(jobId){
 if(!/^[a-zA-Z0-9-]{10,80}$/.test(jobId))throw new Error('批改记录无效。')
 let response
 try{response=await requestIeltsLearning('/api/writing/feedback/job/'+encodeURIComponent(jobId),undefined,{method:'GET',timeout:15000})}catch(error){throw sourceError(error)}
 if(response?.status==='done')return {status:'done',result:normalizeWritingResult(response.result)}
 if(response?.status==='error'){const messages={writing_vision_timeout:'照片批改超时，作文已保留，可以重新提交。',writing_vision_busy:'批改服务繁忙，作文已保留，请稍后重试。'};const error=new Error(messages[response.errorCode]||'批改暂未完成，作文已保留，请重试。');error.terminalJob=true;throw error}
 if(response?.status!=='pending')throw new Error('批改状态异常，请稍后重试。')
 return {status:'pending'}
}
module.exports={normalizeWritingResult,startWritingFeedback,startWritingPairFeedback,writingPairs,writingJob}
