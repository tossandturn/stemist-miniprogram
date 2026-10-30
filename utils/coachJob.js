const {createSha256}=require('./sha256')
const {stableAnswer,liveAnswer}=require('./coachStream')
const TTL=86400000,WAIT=120000
// Keep a bounded cadence from request start, not an extra second after each RTT.
const pollDelay=(interval,elapsed,errors)=>errors?Math.min(5000,interval*errors):Math.max(Math.min(100,interval),interval-elapsed)
const error=(message,code,statusCode=0)=>Object.assign(new Error(message),{code,statusCode})
function fingerprint(payload){
 const text=JSON.stringify(payload),hash=createSha256(),bytes=new Uint8Array(4096)
 for(let at=0;at<text.length;at+=2048){const count=Math.min(2048,text.length-at);for(let i=0;i<count;i++){const c=text.charCodeAt(at+i);bytes[i*2]=c&255;bytes[i*2+1]=c>>>8}hash.update(bytes.subarray(0,count*2))}
 return hash.digest()
}
function askCoachJob(payload,{request,onStage=null,onPartial=null,onCancelReady=null,pollMs=1000}={}){
 const performance=typeof wx.getPerformance==='function'?wx.getPerformance():null,clock=()=>performance?.now?performance.now():Date.now(),started=clock(),elapsed=()=>Math.max(0,Math.round(clock()-started))
 const timing={version:1,posts:0,gets:0,pollWaitMs:0}
 const owner=String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
 const current=()=>{if(owner!==String(wx.getStorageSync('stemistUser')?.id||'guest')||epoch!==(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0))throw error('账号已变化，请重新打开答疑。','account_changed',409)}
 const key='stemistCoachJobs:'+owner+':'+epoch,hash=fingerprint(payload),now=Date.now()
 let records=wx.getStorageSync(key);records=Array.isArray(records)?records.filter(r=>r&&/^[a-f0-9]{64}$/.test(r.hash)&&/^cj-[a-zA-Z0-9_-]{16,80}$/.test(r.id)&&r.expires>now).slice(-5):[]
 let record=records.find(r=>r.hash===hash),known=Boolean(record)
 timing.replayed=known;timing.requestPreparationMs=elapsed()
 if(!record){record={hash,id:'cj-'+now.toString(36)+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2),expires:now+TTL};records.push(record)}
 try{wx.setStorageSync(key,records)}catch{return Promise.reject(error('本机暂时无法保存答疑进度，请释放小程序存储后重试。','coach_job_storage'))}
 const forget=()=>{try{current();const all=wx.getStorageSync(key);if(Array.isArray(all))wx.setStorageSync(key,all.filter(r=>r.id!==record.id))}catch{}}
 return new Promise((resolve,reject)=>{
  let closed=false,task=null,timer=null,wake=null,partial='',errors=0
  const finish=(fn,value)=>{if(closed)return;closed=true;clearTimeout(limit);clearTimeout(timer);wake?.();wake=null;timing.totalMs=elapsed();if(value&&typeof value==='object'){if(value instanceof Error)value.clientTiming={...timing};else value={...value,clientTiming:{...timing}}}fn(value)}
  const cancel=()=>{finish(reject,error('已暂停接收，重新提交同一道题可取回答案。','request_cancelled'));try{task?.abort()}catch{}}
  const limit=setTimeout(()=>{let e;try{current();e=error('连接暂时不稳定，任务编号已保存。点击重试可取回原答疑结果。','coach_job_pending');e.partialAnswer=stableAnswer(partial)}catch(changed){e=changed}finish(reject,e);try{task?.abort()}catch{}},['high','max'].includes(payload.reasoningEffort)?180000:WAIT)
  onCancelReady?.(cancel)
  const stage=s=>{if(!closed){current();onStage?.(s)}}
  const pause=ms=>new Promise(r=>{wake=r;timer=setTimeout(()=>{wake=null;r()},ms)})
  ;(async()=>{
   let submit=!known
   while(!closed){
    current()
    const requestStarted=clock()
    try{
     const sent=submit;submit=false
     sent?timing.posts++:timing.gets++
     const snapshot=await request('/api/ai/coach/jobs/'+record.id,sent?payload:undefined,{method:sent?'POST':'GET',timeout:sent?30000:8000,isCancelled:()=>closed,onTask:t=>{task=t}})
     if(closed)return
     current();errors=0
     if(sent&&timing.ackMs===undefined)timing.ackMs=elapsed()
     if(snapshot.id!==record.id||!['running','succeeded','failed','interrupted'].includes(snapshot.status))throw error('答疑进度返回异常，请稍后重试。','coach_job_protocol')
     if(snapshot.answer!==undefined&&snapshot.answer!==partial){partial=String(snapshot.answer);const visible=liveAnswer(partial);if(visible&&timing.firstAnswerMs===undefined)timing.firstAnswerMs=elapsed();onPartial?.(visible)}
     if(snapshot.status==='succeeded'||snapshot.status==='failed'){
      if(!snapshot.result||typeof snapshot.result!=='object')throw error('答疑结果返回异常。','coach_job_protocol')
      if(snapshot.status==='failed')forget()
      finish(resolve,snapshot.result);return
     }
     if(snapshot.status==='interrupted'){forget();const e=error('服务处理已中断，题目仍保留，请重试。','coach_job_interrupted');e.partialAnswer=stableAnswer(partial);throw e}
     stage(partial?'arranging':'analysis')
    }catch(e){
     if(closed)return
     current()
     if(e.statusCode===404&&e.code==='coach_job_not_found'){submit=true;stage('calling')}
     else if(['network_timeout','network_error'].includes(e.code)||e.statusCode>=500){errors++;stage('recovering')}
     else {if(e.statusCode>=400&&e.statusCode<500&&!['auth_required','account_changed'].includes(e.code))forget();e.partialAnswer=stableAnswer(partial);throw e}
    }
    const delay=pollDelay(pollMs,clock()-requestStarted,errors);timing.pollWaitMs+=delay
    await pause(delay)
   }
  })().catch(e=>finish(reject,e))
 })
}
module.exports={askCoachJob,fingerprint,pollDelay}
