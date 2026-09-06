const {requestIeltsJson,IELTS_API_BASE}=require('./api')
const TYPES={listening:'listeningTests',reading:'readingTests',writing:'writingTasks',speaking:'speakingSets'}
let snapshot=null,pending=null,loadedAt=0
function assetUrl(value){
 const text=String(value||'')
 const path=text.replace(/^https:\/\/ieltsist\.com/i,'')
 if(!/^\/(?:generated|cambridge15\/audio|cambridge-local\/file)\/[a-zA-Z0-9_./% -]+$/.test(path)||path.includes('..')||/%2e|%2f|%5c/i.test(path))return ''
 return IELTS_API_BASE+path
}
const images=value=>(Array.isArray(value)?value:[]).map((image,index)=>({id:String(image.page??index),page:Number(image.page)||index+1,url:assetUrl(image.url)})).filter(image=>image.url)
function normalizeTask(task,module){
 if(!task||typeof task.id!=='string'||!/^[-a-zA-Z0-9_]+$/.test(task.id))return null
 const book=Number(task.book||task.id.match(/^cam(\d+)/)?.[1])||0
 const test=Number(task.test||task.id.match(/test(\d+)/)?.[1])||0
 return {id:task.id,module,book,test,title:String(task.title||''),type:String(task.type||''),source:String(task.source||''),minutes:Number(task.minutes)||({listening:40,reading:60,writing:40,speaking:15})[module],
  questions:(task.questions||[]).map((q,index)=>({id:String(q.id||'q'+(index+1)),number:index+1,text:String(q.text||''),type:String(q.type||''),page:Number(q.questionPage)||0,options:(q.options||[]).map(o=>typeof o==='string'?o:String(o.label||o.text||'')),selectionLimit:Number(q.selectionLimit)||1})),
  questionImages:images(task.questionPageImages||task.readingQuestionPageImages),passageImages:images(task.readingPassagePageImages),images:images(task.readingPageImages||task.writingPageImages||task.speakingPageImages||task.questionPageImages),
  audioUrls:(Array.isArray(task.audioUrls)?task.audioUrls:[task.audioUrl]).map(assetUrl).filter(Boolean),
  prompt:String(task.prompt||''),data:String(task.data||''),contentVersion:String(task.contentVersion||''),contentLifecycle:String(task.contentLifecycle||''),humanReviewStatus:String(task.humanReviewStatus||''),
  part1Topic:String(task.part1Topic||''),part1:task.part1||[],part2:task.part2||'',part3:task.part3||[]}
}
async function loadIeltsContent({refresh=false}={}){
 if(!refresh&&snapshot&&Date.now()-loadedAt<300000)return snapshot
 if(pending)return pending
 pending=requestIeltsJson('/api/tasks',undefined,{method:'GET',timeout:20000}).then(payload=>{
  if(!payload||!Array.isArray(payload.listeningTests)||!Array.isArray(payload.readingTests))throw new Error('题库返回不完整，请重试。')
  snapshot=Object.fromEntries(Object.entries(TYPES).map(([module,key])=>[module,(payload[key]||[]).map(task=>normalizeTask(task,module)).filter(Boolean)]));loadedAt=Date.now();return snapshot
 }).finally(()=>{pending=null})
 return pending
}
async function getIeltsTask(module,id){const bank=await loadIeltsContent();const task=bank[module]?.find(t=>t.id===id);if(!task)throw new Error('没有找到这份试题，请重新选择。');return task}
function catalogPage(tasks,{query='',book=0,page=0,pageSize=20}={}){
 const q=String(query).trim().toLowerCase(),selected=tasks.filter(t=>(!book||t.book===Number(book))&&(!q||(t.title+' '+t.source).toLowerCase().includes(q)))
 const count=Math.ceil(selected.length/pageSize),index=Math.min(Math.max(0,page),Math.max(0,count-1))
 return {items:selected.slice(index*pageSize,(index+1)*pageSize).map(t=>({id:t.id,title:t.title.replace(/^Cambridge IELTS \d+ Academic\s*[-–]\s*/i,''),book:t.book,test:t.test,type:t.type,minutes:t.minutes,questionCount:t.questions.length})),total:selected.length,page:index,pageCount:count}
}
module.exports={assetUrl,images,normalizeTask,loadIeltsContent,getIeltsTask,catalogPage}
