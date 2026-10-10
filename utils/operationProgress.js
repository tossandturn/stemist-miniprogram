const KEY='stemistOperationTimings',SCHEMA='operation-timing-v1',PHASES=['preparing','calling','analysis','arranging','complete'],LABELS=['准备内容','连接 AI 中','分析中','整理答案中','完成']
function createOperationTracker({key='coach-text',onChange=()=>{},now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,history=typeof wx==='object'?wx:null}={}){
 const started=now();let phase='preparing',timer=null,closed=false
 const records=()=>{try{const v=history?.getStorageSync(KEY);return v?.schema===SCHEMA&&Array.isArray(v.items)?v.items.filter(x=>['coach-photo','coach-text'].includes(x?.key)&&Number.isFinite(x.ms)&&x.ms>=1000&&x.ms<=300000&&Number.isFinite(x.at)&&x.at>=now()-2592000000&&x.at<=now()+60000).slice(-24).map(x=>({key:x.key,ms:x.ms,at:x.at})):[]}catch{return[]}}
 const samples=records().filter(x=>x.key===key).map(x=>x.ms).sort((a,b)=>a-b)
 const estimate=samples.length>=3?[samples[0]*.8,samples[Math.floor(samples.length*.75)]*1.5]:null
 const snapshot=()=>{const ms=Math.max(0,now()-started),remaining=estimate&&estimate[1]>ms?[Math.max(1,Math.ceil((estimate[0]-ms)/1000)),Math.ceil((estimate[1]-ms)/1000)]:null;return{phase,label:phase==='failed'?'未完成':LABELS[PHASES.indexOf(phase)],active:!closed,elapsedLabel:'已等待 '+Math.floor(ms/1000)+' 秒',etaSeconds:remaining?.[1]??null,etaLabel:remaining?'预计剩余约 '+remaining[0]+'–'+remaining[1]+' 秒':estimate?'仍在处理中，请稍候':'预计时间估算中',percentage:null}}
 const emit=()=>{try{onChange(snapshot())}catch{}}
 const tick=()=>{if(closed)return;clearTimer(timer);emit();timer=setTimer(tick,1000)}
 emit();timer=setTimer(tick,1000)
 return{stage(value){if(closed||!PHASES.includes(value)||PHASES.indexOf(value)<PHASES.indexOf(phase))return;phase=value;emit()},finish(success){if(closed)return;closed=true;clearTimer(timer);timer=null;phase=success?'complete':'failed';if(success&&['coach-photo','coach-text'].includes(key)){const ms=now()-started;if(ms>=1000&&ms<=300000)try{history?.setStorageSync(KEY,{schema:SCHEMA,items:[...records(),{key,ms,at:now()}].slice(-24)})}catch{}}emit()},dispose(){closed=true;clearTimer(timer);timer=null}}
}
module.exports={createOperationTracker}
