const empty=()=>({etaSeconds:null,speedLabel:'',remainingLabel:''})
const speedText=n=>n<1024?Math.round(n)+' B/s':n<1048576?(n/1024).toFixed(n>=102400?0:1)+' KB/s':(n/1048576).toFixed(n>=10485760?1:2)+' MB/s'
function remainingText(s){
 if(s<=0)return'预计剩余不足 1 秒'
 if(s<60)return'预计剩余 '+s+' 秒'
 if(s<3600){const m=Math.floor(s/60),r=s%60;return'预计剩余 '+m+' 分'+(r?' '+r+' 秒':'钟')}
 let h=Math.floor(s/3600),m=Math.ceil(s%3600/60);if(m===60){h++;m=0}
 return'预计剩余 '+h+' 小时'+(m?' '+m+' 分钟':'')
}
function createDownloadMetrics(options={}){
 const now=typeof options.now==='function'?options.now:Date.now
 let last=null,lastAt=0,lastTotal=0,samples=[],ema=0
 const reset=()=>{last=null;lastAt=lastTotal=ema=0;samples=[]}
 function observe(downloadedBytes,totalBytes){
  const downloaded=Math.max(0,Math.floor(Number(downloadedBytes)||0)),total=Math.max(0,Math.floor(Number(totalBytes)||0)),at=Number(now())
  if(!Number.isFinite(at)||last===null||total!==lastTotal||downloaded<last||at<lastAt){last=downloaded;lastAt=Number.isFinite(at)?at:0;lastTotal=total;samples=[];ema=0;return empty()}
  const ms=at-lastAt,delta=downloaded-last
  if(ms>0){const rate=delta*1000/ms;samples.push([delta,ms]);if(samples.length>6)samples.shift();ema=samples.length===1?rate:.35*rate+.65*ema;last=downloaded;lastAt=at}else if(delta>0)last=downloaded
  let observed=0,duration=0;for(const sample of samples){observed+=sample[0];duration+=sample[1]}
  if(samples.length<2||duration<800||observed<32768)return empty()
  const rate=(observed*1000/duration+ema)/2
  if(!Number.isFinite(rate)||rate<=0)return empty()
  const speedLabel='约 '+speedText(rate)
  if(!total)return{etaSeconds:null,speedLabel,remainingLabel:''}
  const etaSeconds=Math.ceil(Math.max(0,total-downloaded)/rate)
  if(!Number.isFinite(etaSeconds)||etaSeconds>604800)return{etaSeconds:null,speedLabel,remainingLabel:''}
  return{etaSeconds,speedLabel,remainingLabel:remainingText(etaSeconds)}
 }
 return{observe,reset}
}
module.exports={createDownloadMetrics}
