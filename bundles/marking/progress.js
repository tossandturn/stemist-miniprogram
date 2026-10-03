function markingProgress(job){
 const p=job.progress||{},active=['queued','processing'].includes(job.status),phase=String(p.phase||p.stage||'')
 const labels={'awaiting-upload':'等待上传','queued':'排队中','starting':'开始准备','preparing-source-pdf':'准备文件中','rendering-answer-pages':'准备作答中','rendering-references':'准备参考材料中','ai-review':'分析作答中','ai-result-received':'分析完成','reporting':'整理报告中','preparing':'准备文件中','analyzing':'分析作答中','analysis-received':'分析完成'}
 const total=Number(p.totalPages),done=Number(p.completedPages),elapsed=Number(p.elapsedSeconds)
 const valid=Number.isInteger(total)&&total>0&&total<=40&&Number.isInteger(done)&&done>=0&&done<=total
 const eta=p.isEstimate===true&&job.status==='processing'&&p.estimateScope==='processing-only'?Number(p.estimatedRemainingSeconds):NaN
 return{active,label:labels[p.stage]||labels[phase]||({queued:'排队中',processing:'AI 批改中',completed:'批改完成',failed:'批改未完成'}[job.status]||''),elapsedLabel:Number.isFinite(elapsed)&&elapsed>=0?'已等待 '+Math.floor(elapsed)+' 秒':'',etaLabel:Number.isFinite(eta)&&eta>0?'预计还需约 '+Math.ceil(eta)+' 秒':job.status==='queued'?'正在排队':'预计时间估算中',pageLabel:valid?'文件准备 '+done+' / '+total+' 页':'',pagePercent:valid?Math.floor(done/total*100):null,preparing:/preparing|rendering|starting/.test(phase)}
}
module.exports={markingProgress}
