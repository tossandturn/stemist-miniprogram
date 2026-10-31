const ID=/^cj-[A-Za-z0-9_-]{16,80}$/,STATES=['running','succeeded','failed','interrupted']
const STAGES={accepted:['calling','任务已接收'],preparing:['calling','正在准备分析'],requesting_model:['calling','正在连接 AI'],waiting_response:['calling','等待 AI 响应'],thinking:['analysis','AI 分析中'],answering:['arranging','正在生成答案'],finalizing:['arranging','正在整理答案'],complete:['complete','答疑已完成'],failed:['failed','答疑未完成'],interrupted:['failed','答疑已中断']}
const number=v=>Number.isSafeInteger(v)&&v>=0
const range=v=>v&&number(v.lower)&&number(v.upper)&&v.lower<=v.upper&&v.upper<=600000
const levels=['low','high','max'],savedLevels=['high','max']
const titles={'hint':'步骤提示','worked-solution':'完整解答','check-work':'检查作答'}
function taskSteps(phase,accepted=false){
 const active=phase==='preparing'?0:phase==='uploading'||phase==='calling'&&!accepted?1:phase==='calling'||phase==='analysis'?2:3
 return['准备题目','上传/提交','AI 处理','生成答案'].map((label,index)=>({label,state:phase==='complete'?'done':phase==='failed'?(index<active?'done':index===active?'error':'pending'):index<active?'done':index===active?'active':'pending'}))
}
function initialTaskEstimate(key,effort){
 const photo=key==='coach-photo',value=levels.includes(effort)?effort:'low',pair=value==='low'?[photo?12:8,30]:value==='high'?[photo?20:15,photo?75:60]:[photo?30:25,photo?105:100]
 return{etaSeconds:pair[1],etaLabel:'预计 AI 处理约 '+pair[0]+'–'+pair[1]+' 秒',estimateNote:'初步估计，题目复杂时可能更久'}
}
function taskProgressView(value,extraMs=0){
 const t=value?.task,status=value?.status
 if(!ID.test(value?.id||'')||!STATES.includes(status)||t?.schemaVersion!=='stem-coach-task-v1'||!number(value.createdAt)||!number(value.updatedAt)||!number(value.expiresAt)||value.expiresAt<=value.createdAt||!number(value.serverNow)||!STAGES[t.stage?.code]||!number(t.stage?.changedAt))return null
 const effort=levels.includes(t.reasoning?.effectiveEffort)?t.reasoning.effectiveEffort:null,requested=levels.includes(t.reasoning?.requestedEffort)?t.reasoning.requestedEffort:effort
 const saved=t.persistence?.saved
 if(typeof saved!=='boolean'||!number(t.persistence.retentionMs)||t.persistence.retentionMs>604800000||saved&&(!savedLevels.includes(requested)||effort==='low'||t.persistence.retentionMs!==259200000))return null
 if(t.stage.code==='thinking'&&t.reasoning?.activityObserved!==true)return null
 const terminal=status!=='running',extra=Math.max(0,Math.min(3600000,Number(extraMs)||0)),end=terminal?(number(t.milestones?.completedAt)?t.milestones.completedAt:value.updatedAt):value.serverNow+extra
 const elapsed=Math.max(0,end-value.createdAt),pair=STAGES[terminal?(status==='succeeded'?'complete':status):t.stage.code]
 const estimate=t.estimate||{},bounds=range(estimate.remainingMs)?estimate.remainingMs:range(estimate.totalMs)?{lower:Math.max(0,estimate.totalMs.lower-(value.serverNow-value.createdAt)),upper:Math.max(0,estimate.totalMs.upper-(value.serverNow-value.createdAt))}:null
 let etaLabel='预计时间暂不可用',etaSeconds=null
 if(terminal)etaLabel=status==='succeeded'?'结果已返回':'可返回原题重新提问'
 else if(estimate.status==='exceeded'||bounds&&bounds.upper<=extra)etaLabel='已超过预估，仍在获取结果'
 else if(bounds&&estimate.status!=='unavailable'){const low=Math.max(1,Math.ceil((bounds.lower-extra)/1000)),high=Math.max(low,Math.ceil((bounds.upper-extra)/1000));etaSeconds=high;etaLabel='预计剩余约 '+low+'–'+high+' 秒'}
 const calibrated=estimate.source?.kind==='cohort'&&Number(estimate.source.sampleCount)>=5
 return{phase:pair[0],label:pair[1],active:!terminal,percentage:null,taskId:value.id,taskStatus:status,taskTitle:titles[t.helpIntent]||'学科答疑',savedTask:saved,canLeave:saved,createdAt:value.createdAt,updatedAt:value.updatedAt,serverNow:value.serverNow,expiresAt:value.expiresAt,stageChangedAt:t.stage.changedAt,elapsedLabel:'已用 '+Math.floor(elapsed/1000)+' 秒',etaLabel,etaSeconds,estimateNote:terminal?'':calibrated?'根据近期同类答疑估计':'初步估计，题目复杂时可能更久',effort,effortLabel:effort?effort+(t.reasoning?.enabled===true?' · 思考已开启':' · 以实际反馈状态为准'):'原任务设置',retentionLabel:saved?'结果保留 3 天':'即时答复 · 不保存为任务',leaveHint:saved?'任务已提交，可离开页面，稍后查看结果':'当前为即时答复，请等待结果',steps:taskSteps(pair[0],true)}
}
module.exports={taskProgressView,initialTaskEstimate,taskSteps}
