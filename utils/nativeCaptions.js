const {requestIeltsJson}=require('./api')
const cache=new Map(),pending=new Map()
function captionModel(payload){
 if(!payload?.available||!Array.isArray(payload.timedWords)||!payload.timedWords.length||payload.timedWords.length>12000)return null
 const speakers=new Map(),words=[]
 for(const [index,item] of payload.timedWords.entries()){
  const start=Number(item.start),end=Number(item.end),speaker=String(item.speaker||'Speaker')
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||index>0&&start<words[index-1].start)return null
  if(!speakers.has(speaker))speakers.set(speaker,speakers.size%4)
  words.push({start,end,word:String(item.word||''),speaker,tone:speakers.get(speaker),sentence:Number.isInteger(item.sentenceIndex)?item.sentenceIndex:index})
 }
 return {words}
}
function captionFrame(model,time){
 if(!model?.words?.length)return {index:-1,bubbles:[]}
 const words=model.words;let low=0,high=words.length
 while(low<high){const middle=(low+high)>>1;if(words[middle].start<=time)low=middle+1;else high=middle}
 const index=low-1
 if(index<0)return {index,bubbles:[]}
 const bubbles=[]
 for(let i=index;i>=Math.max(0,index-63);i--){
  const w=words[i],last=bubbles[bubbles.length-1],key=w.sentence+':'+w.speaker
  if(last?.key===key)last.words.unshift(w.word)
  else{if(bubbles.length===3)break;bubbles.push({key,words:[w.word],speaker:w.speaker,tone:w.tone})}
 }
 return {index,bubbles:bubbles.reverse().map(({words,...bubble})=>({...bubble,text:words.join(' ').replace(/\s+([,.;:!?])/g,'$1')}))}
}
async function loadCaptions(taskId,section){
 if(!/^[-a-zA-Z0-9_]+$/.test(taskId)||!Number.isInteger(section)||section<1||section>4)throw new Error('音频分段资料尚未就绪。')
 const key=taskId+':'+section
 if(cache.has(key)){const model=cache.get(key);cache.delete(key);cache.set(key,model);return model}
 if(pending.has(key))return pending.get(key)
 const request=requestIeltsJson('/api/listening/asr-cache?id='+encodeURIComponent(taskId)+'&section='+section,undefined,{method:'GET',timeout:12000}).then(data=>{
  const model=captionModel(data);if(!model)throw new Error('这段音频暂无可用字幕。')
  cache.set(key,model);while(cache.size>4)cache.delete(cache.keys().next().value);return model
 }).finally(()=>pending.delete(key))
 pending.set(key,request);return request
}
module.exports={captionModel,captionFrame,loadCaptions}
