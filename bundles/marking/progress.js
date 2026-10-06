function duration(seconds){
 const value=Math.max(0,Math.floor(Number(seconds)))
 if(!Number.isFinite(value))return''
 if(value<60)return value+' 秒'
 const minutes=Math.floor(value/60),rest=value%60
 return minutes+' 分'+(rest?' '+rest+' 秒':'')
}
function markingProgress(job){
 const p=job.progress||{},active=['queued','processing'].includes(job.status),terminal=['completed','failed'].includes(job.status)
 const stage=String(p.stage||p.phase||''),lastStage=String(p.lastStage||''),phase=terminal&&lastStage?lastStage:stage
 const labels={'awaiting-upload':'等待上传','queued':'排队中','starting':'开始准备','preparing-source-pdf':'准备文件中','rendering-answer-pages':'准备作答中','rendering-references':'准备参考材料中','ai-review':'分析作答中','ai-result-received':'分析完成','reporting':'整理报告中','preparing':'准备文件中','analyzing':'分析作答中','analysis-received':'分析完成','completed':'批改完成','failed':'批改未完成'}
 const total=Number(p.totalPages),done=Number(p.completedPages),elapsed=Number(p.elapsedSeconds),phaseElapsed=Number(p.phaseElapsedSeconds??p.phaseElapsed)
 const valid=Number.isInteger(total)&&total>0&&total<=40&&Number.isInteger(done)&&done>=0&&done<=total
 const preparing=/preparing|rendering|starting/.test(phase)
 const eta=p.isEstimate===true&&job.status==='processing'&&p.estimateScope==='processing-only'?Number(p.estimatedRemainingSeconds):NaN
 const elapsedLabel=Number.isFinite(elapsed)&&elapsed>=0?(job.status==='queued'?'已排队 ':terminal?'总耗时 ':'已用时 ')+duration(elapsed):''
 let pageLabel=''
 if(valid){
  if(/ai-review|analyzing/.test(phase))pageLabel='已提交 '+done+' / '+total+' 页进行分析'
  else if(/reporting|analysis-received|ai-result-received/.test(phase))pageLabel='已完成页面处理 '+done+' / '+total+' 页'
  else pageLabel='已准备 '+done+' / '+total+' 页'
 }
 return{
  active,terminal,
  label:labels[stage]||labels[phase]||({queued:'排队中',processing:'AI 批改中',completed:'批改完成',failed:'批改未完成'}[job.status]||''),
  elapsedLabel,
  phaseLabel:labels[phase]||'',
  phaseElapsedLabel:Number.isFinite(phaseElapsed)&&phaseElapsed>=0&&phase&&phase!==stage?(job.status==='failed'?'失败前阶段用时 ':'最后阶段用时 ')+duration(phaseElapsed):Number.isFinite(phaseElapsed)&&phaseElapsed>=0&&active?'本阶段已用时 '+duration(phaseElapsed):'',
  etaLabel:Number.isFinite(eta)&&eta>0?'预计还需约 '+duration(Math.ceil(eta)):job.status==='queued'?'正在排队':job.status==='processing'?'暂没有可靠的预计完成时间':'',
  etaSourceLabel:Number.isFinite(eta)&&eta>0?'根据同页数历史任务估算':'',
  pageLabel,
  pagePercent:valid&&preparing?Math.floor(done/total*100):null,
  preparing,
 }
}
module.exports={markingProgress}
