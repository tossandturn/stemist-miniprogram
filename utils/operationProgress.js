const KEY='stemistOperationTimings',SCHEMA='operation-timing-v1',PHASES=['preparing','uploading','calling','analysis','arranging','complete'],LABELS=['准备内容','上传图片','连接 AI 中','分析中','整理答案中','完成']
const {taskProgressView,initialTaskEstimate,taskSteps}=require('./coachTaskView')
const byteLabel=value=>value>=1048576?(value/1048576).toFixed(1)+' MB':value>=1024?(value/1024).toFixed(1).replace(/\.0$/,'')+' KB':Math.round(value)+' B'
function createOperationTracker({key='coach-text',taskMode=false,effort='low',onChange=()=>{},now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,history=typeof wx==='object'?wx:null}={}){
 const started=now();let phase='preparing',timer=null,closed=false,recovering=false,transfer=null,taskSnapshot=null,taskObservedAt=0
 const records=()=>{try{const v=history?.getStorageSync(KEY);return v?.schema===SCHEMA&&Array.isArray(v.items)?v.items.filter(x=>['coach-photo','coach-text'].includes(x?.key)&&Number.isFinite(x.ms)&&x.ms>=1000&&x.ms<=300000&&Number.isFinite(x.at)&&x.at>=now()-2592000000&&x.at<=now()+60000).slice(-24).map(x=>({key:x.key,ms:x.ms,at:x.at})):[]}catch{return[]}}
 const samples=records().filter(x=>x.key===key).map(x=>x.ms).sort((a,b)=>a-b)
 const estimate=samples.length>=3?[samples[0]*.8,samples[Math.floor(samples.length*.75)]*1.5]:null
 const snapshot=()=>{
  const ms=Math.max(0,now()-started),remaining=estimate&&estimate[1]>ms?[Math.max(1,Math.ceil((estimate[0]-ms)/1000)),Math.ceil((estimate[1]-ms)/1000)]:null
  let base={phase,label:phase==='failed'?'未完成':LABELS[PHASES.indexOf(phase)],active:!closed,elapsedLabel:'已等待 '+Math.floor(ms/1000)+' 秒',etaSeconds:remaining?.[1]??null,etaLabel:remaining?'预计剩余约 '+remaining[0]+'–'+remaining[1]+' 秒':estimate?'仍在处理中，请稍候':'预计时间估算中',percentage:null}
  if(taskMode){
   const task=taskSnapshot?taskProgressView(taskSnapshot,now()-taskObservedAt):null
   base=task?{...base,...task,active:!closed&&task.active}: {...base,...initialTaskEstimate(key,effort),label:phase==='preparing'?(key==='coach-photo'?'正在准备图片':'正在准备题目'):phase==='calling'?'正在提交题目':base.label,canLeave:false,savedTask:false,leaveHint:'提交完成前请保持当前页面',steps:taskSteps(phase),effortLabel:effort+' · 思考已开启'}
   if(closed){const terminal=task&&['failed','interrupted'].includes(task.taskStatus);base={...base,phase,label:phase==='complete'?'答疑已完成':terminal?task.label:task?.savedTask?'任务状态待确认':'本次答疑未完成',active:false,etaSeconds:null,etaLabel:phase==='complete'?'结果已返回':terminal?task.etaLabel:task?.savedTask?'可在已保存答疑中刷新结果':'原题已保留，可重试',steps:taskSteps(phase,Boolean(task))}}
  }
  if(phase!=='uploading'||!transfer)return base
  const stale=now()-transfer.at>2500,speed=!stale&&Number.isFinite(transfer.speedBytesPerSecond)?Math.max(0,transfer.speedBytesPerSecond):0,eta=!stale&&Number.isFinite(transfer.etaSeconds)?Math.max(0,Math.ceil(transfer.etaSeconds)):null
  return{...base,label:transfer.retrying?'网络波动，正在续传图片':transfer.restarting?'正在重新上传图片':transfer.verifying?'图片已上传，正在校验':transfer.resuming?'继续上传图片':'正在上传图片',percentage:Math.floor(transfer.uploadedBytes/transfer.totalBytes*100),elapsedLabel:'已上传 '+byteLabel(transfer.uploadedBytes)+' / '+byteLabel(transfer.totalBytes),speedLabel:speed>0?byteLabel(speed)+'/s':stale?'等待网络':'测速中',etaSeconds:eta,etaLabel:transfer.retrying?'已传部分保留，正在恢复':transfer.verifying?'正在校验图片':eta!==null?'预计剩余约 '+eta+' 秒':'正在估算剩余时间'}
 }
 const emit=()=>{try{onChange({...snapshot(),...(recovering&&!closed?{phase:'recovering',label:'连接中断，正在取回答案',etaLabel:taskMode?'恢复连接后更新任务状态':'无需重新上传题目'}:{})})}catch{}}
 const tick=()=>{if(closed)return;clearTimer(timer);emit();timer=setTimer(tick,1000)}
 emit();timer=setTimer(tick,1000)
 return{stage(value){
  if(closed)return
  if(value&&typeof value==='object'){
   if(taskMode&&value.phase==='task'){
    const parsed=taskProgressView(value.snapshot)
    if(!parsed||taskSnapshot&&(taskSnapshot.id!==value.snapshot.id||value.snapshot.serverNow<taskSnapshot.serverNow||value.snapshot.updatedAt<taskSnapshot.updatedAt))return
    taskSnapshot=value.snapshot;taskObservedAt=now();phase=parsed.phase;recovering=false;transfer=null;emit();return
   }
   if(value.phase!=='uploading'||PHASES.indexOf(phase)>=PHASES.indexOf('analysis')||!Number.isFinite(value.totalBytes)||value.totalBytes<=0||value.totalBytes>16777216||!Number.isFinite(value.uploadedBytes)||value.uploadedBytes<0)return
   phase='uploading';recovering=false;transfer={...value,uploadedBytes:Math.min(value.uploadedBytes,value.totalBytes),at:now()};emit();return
  }
  if(value==='recovering'){recovering=true;emit();return}if(!PHASES.includes(value)||taskMode&&taskSnapshot)return;recovering=false;if(PHASES.indexOf(value)>=PHASES.indexOf(phase))phase=value;emit()
 },finish(success){if(closed)return;closed=true;clearTimer(timer);timer=null;phase=success?'complete':'failed';if(success&&!taskMode&&['coach-photo','coach-text'].includes(key)){const ms=now()-started;if(ms>=1000&&ms<=300000)try{history?.setStorageSync(KEY,{schema:SCHEMA,items:[...records(),{key,ms,at:now()}].slice(-24)})}catch{}}emit()},dispose(){closed=true;clearTimer(timer);timer=null}}
}
module.exports={createOperationTracker}
