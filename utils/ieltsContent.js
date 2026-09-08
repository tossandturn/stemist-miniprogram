const {requestIeltsJson,IELTS_API_BASE}=require('./api')
const BOOTSTRAP=require('./ieltsBootstrap')
const {unpackTask}=require('./nativeDataPack')
const {writingPrompt}=require('./writingPrompt')
const {sourceMatches,sourceLabel}=require('./ieltsSource')
const TYPES={listening:'listeningTests',reading:'readingTests',writing:'writingTasks',speaking:'speakingSets'}
const PUBLIC_INDEX='stemistPublicIeltsCatalog'
const CAMBRIDGE_WRITING=/^cam\d+-w-test\d+-task[12]$/
const SOURCE_REVISION=/^[a-f0-9]{64}$/
let snapshot=null,pending=null,loadedAt=0,lastAttemptAt=0,refreshTimer=null,catalogVersion='',baseVersion='',bundledTasks=null
const listeners=new Set()
function subscribeIeltsContent(listener){listeners.add(listener);return ()=>listeners.delete(listener)}
const taskCache=new Map(),taskPending=new Map()
function assetUrl(value){
 const text=String(value||'')
 const path=text.replace(/^https:\/\/ieltsist\.com/i,'')
 if(!/^\/(?:generated|cambridge15\/audio|cambridge-local\/file)\/[a-zA-Z0-9_./% -]+$/.test(path)||path.includes('..')||/%2e|%2f|%5c/i.test(path))return ''
 return IELTS_API_BASE+path
}
const images=value=>(Array.isArray(value)?value:[]).map((image,index)=>({id:String(image.page??index),page:Number(image.page)||index+1,url:assetUrl(image.url)})).filter(image=>image.url)
function normalizeTask(task,module,{indexOnly=false}={}){
 if(!task||typeof task.id!=='string'||!/^[-a-zA-Z0-9_]+$/.test(task.id))return null
 const book=Number(task.book||task.id.match(/^cam(\d+)/)?.[1])||0
 const test=Number(task.test||task.id.match(/test(\d+)/)?.[1])||0
 const revision=SOURCE_REVISION.test(String(task.sourceRevision||''))?String(task.sourceRevision):''
 const guarded=module==='writing'&&CAMBRIDGE_WRITING.test(task.id)
 const sourceMetadataComplete=!guarded||revision&&['pending-review','ready'].includes(task.sourceAvailability)
 const sourceAvailability=guarded?(task.sourceAvailability==='ready'&&revision?'ready':'pending-review'):String(task.sourceAvailability||'')
 return {id:task.id,module,book,test,detailsLoaded:!indexOnly,questionCount:Number(task.questionCount)||(task.questions||[]).length,title:String(task.title||''),type:String(task.type||''),source:String(task.source||''),sourceKind:String(task.sourceKind||''),topicKey:String(task.topicKey||''),topicLabel:String(task.topicLabel||''),topicIcon:String(task.topicIcon||''),topicEmoji:String(task.topicEmoji||'').slice(0,24),minutes:Number(task.minutes)||({listening:40,reading:60,writing:40,speaking:15})[module],
  questions:(task.questions||[]).map((q,index)=>({id:String(q.id||'q'+(index+1)),number:Number(String(q.id||'').match(/^(?:q)?(\d+)$/)?.[1])||index+1,text:String(q.text||''),type:String(q.type||''),page:Number(q.questionPage)||0,options:q.optionsVerified===true?(q.options||[]).map(o=>typeof o==='string'?o:[o.value,o.label||o.text].filter(Boolean).join('. ')):[],selectionLimit:Number(q.selectionLimit)||1})),
  questionImages:images(task.questionPageImages||task.readingQuestionPageImages),passageImages:images(task.readingPassagePageImages),images:images(task.readingPageImages||task.writingPageImages||task.speakingPageImages||task.questionPageImages),
  audioUrls:(Array.isArray(task.audioUrls)?task.audioUrls:[task.audioUrl]).map(assetUrl).filter(Boolean),
  audioSections:(Array.isArray(task.audioUrls)?task.audioUrls:[]).map((url,index)=>({section:index+1,url:assetUrl(url)})).filter(track=>track.url),
  sections:(task.nativeSections||task.sections||[]).map(section=>({number:Number(section.number),label:String(section.label||''),title:String(section.title||''),topicKey:String(section.topicKey||''),topicLabel:String(section.topicLabel||''),topicIcon:String(section.topicIcon||''),topicEmoji:String(section.topicEmoji||'').slice(0,24),questionCount:Number(section.questionCount)||section.questionIds?.length||0,questionIds:Array.isArray(section.questionIds)?section.questionIds.filter(id=>typeof id==='string'):[],minutes:Number(section.minutes)||20})),
  passageStarts:task.readingPassageStartPages||{},visual:task.visual||null,
  prompt:module==='writing'?writingPrompt(task.prompt,task.id):String(task.prompt||''),data:String(task.data||''),contentVersion:String(task.contentVersion||''),contentLifecycle:String(task.contentLifecycle||''),humanReviewStatus:String(task.humanReviewStatus||''),sourceAvailability,sourceRevision:revision,sourceMetadataComplete:Boolean(sourceMetadataComplete),
  part1Topic:String(task.part1Topic||''),part1:task.part1||[],part2:task.part2||'',part3:task.part3||[]}
}
function normalizeCatalog(payload){catalogVersion=String(payload.version||'');baseVersion=String(payload.baseVersion||payload.version||'');return Object.fromEntries(Object.entries(TYPES).map(([module,key])=>[module,(payload[key]||[]).map(task=>{const result=normalizeTask(task,module,{indexOnly:payload.schemaVersion==='native-ielts-catalog-v1'});return result?{...result,catalogVersion}:null}).filter(Boolean)]))}
function validCatalog(payload){return payload?.schemaVersion==='native-ielts-catalog-v1'&&Object.values(TYPES).every(key=>Array.isArray(payload[key])&&payload[key].length<3000)}
function refreshCatalog(){
 if(pending)return pending
 clearTimeout(refreshTimer);refreshTimer=null;lastAttemptAt=Date.now()
 pending=requestIeltsJson('/api/native/ielts/catalog',undefined,{method:'GET',timeout:12000}).catch(error=>{
  // Compatibility during a rolling server release only. A network failure
  // must not trigger a second multi-megabyte download.
  if(error.statusCode===404)return requestIeltsJson('/api/tasks',undefined,{method:'GET',timeout:20000})
  throw error
 }).then(payload=>{
  if(!payload||!Object.values(TYPES).every(key=>Array.isArray(payload[key])&&payload[key].length<3000))throw new Error('题库返回不完整，请重试。')
  const previousVersion=catalogVersion
  snapshot=normalizeCatalog(payload);loadedAt=Date.now()
  if(validCatalog(payload)){try{wx.setStorageSync(PUBLIC_INDEX,{payload,at:loadedAt,builtAgainst:BOOTSTRAP.catalog.version})}catch{/* Public cache must never prevent opening a task. */}}
  if(previousVersion!==catalogVersion)for(const listener of listeners){try{listener(snapshot)}catch{/* A disposed view must not break public cache refresh. */}}
  return snapshot
 }).finally(()=>{pending=null})
 return pending
}
async function loadIeltsContent({refresh=false}={}){
 if(refresh)return refreshCatalog()
 if(!snapshot){const saved=wx.getStorageSync(PUBLIC_INDEX),useSaved=validCatalog(saved?.payload)&&saved.builtAgainst===BOOTSTRAP.catalog.version;const payload=useSaved?saved.payload:BOOTSTRAP.catalog;snapshot=normalizeCatalog(payload);loadedAt=useSaved?Number(saved.at)||0:0}
 if(Date.now()-loadedAt>=300000&&!pending&&!refreshTimer&&Date.now()-lastAttemptAt>30000){
  refreshTimer=setTimeout(()=>{refreshTimer=null;if(!taskPending.size)refreshCatalog().catch(()=>{})},5000);refreshTimer?.unref?.()
 }
 return snapshot
}
async function getIeltsTask(module,id,{refresh=false}={}){
 if(!TYPES[module]||!/^[-a-zA-Z0-9_]+$/.test(String(id)))throw new Error('试题地址无效。')
 let bank=await loadIeltsContent(refresh?{refresh:true}:{}),item=bank[module]?.find(t=>t.id===id)
 if(!item){bank=await loadIeltsContent({refresh:true});item=bank[module]?.find(t=>t.id===id)}
 if(!refresh&&module==='writing'&&CAMBRIDGE_WRITING.test(id)&&item&&!item.sourceMetadataComplete){bank=await loadIeltsContent({refresh:true});item=bank[module]?.find(t=>t.id===id)}
 if(!item)throw new Error('没有找到这份试题，请重新选择。')
 if(item.detailsLoaded)return item
 const key=module+':'+id+':'+catalogVersion,cached=taskCache.get(key)
 if(!refresh&&cached&&Date.now()-cached.at<300000){taskCache.delete(key);taskCache.set(key,cached);return cached.task}
 if(catalogVersion&&!refresh){
  if(!bundledTasks)bundledTasks=require('./ieltsTaskBootstrap')
  if(bundledTasks.version===baseVersion){
   const raw=unpackTask(bundledTasks,id)
   if(raw&&(!raw.module||raw.module===module)){
    const normalized=normalizeTask(raw,module)
    const guarded=module==='writing'&&CAMBRIDGE_WRITING.test(id)
    if(!guarded||item.sourceAvailability!=='ready'||normalized.sourceAvailability==='ready'&&normalized.sourceRevision===item.sourceRevision){const task={...normalized,topicKey:item.topicKey,topicLabel:item.topicLabel,topicIcon:item.topicIcon,topicEmoji:item.topicEmoji,sourceAvailability:item.sourceAvailability,sourceRevision:item.sourceRevision,sourceMetadataComplete:item.sourceMetadataComplete};taskCache.set(key,{task,at:Date.now()});while(taskCache.size>6)taskCache.delete(taskCache.keys().next().value);return task}
   }
  }
 }
 if(taskPending.has(key))return taskPending.get(key)
 const request=requestIeltsJson('/api/native/ielts/tasks/'+module+'/'+encodeURIComponent(id),undefined,{method:'GET',timeout:15000}).then(payload=>{
  if(payload?.schemaVersion!=='native-ielts-task-v1'||payload.task?.id!==id)throw new Error('试题返回不完整，请重试。')
  const normalized=normalizeTask(payload.task,module),guarded=module==='writing'&&CAMBRIDGE_WRITING.test(id)
  if(guarded&&item.sourceAvailability==='ready'&&(normalized.sourceAvailability!=='ready'||normalized.sourceRevision!==item.sourceRevision))throw new Error('题目来源版本未能确认，请刷新后重试。')
  const task=guarded?{...normalized,sourceAvailability:item.sourceAvailability,sourceRevision:item.sourceRevision,sourceMetadataComplete:item.sourceMetadataComplete}:normalized
  taskCache.set(key,{task,at:Date.now()});while(taskCache.size>6)taskCache.delete(taskCache.keys().next().value)
  return task
 }).finally(()=>taskPending.delete(key))
 taskPending.set(key,request);return request
}
function catalogPage(tasks,{query='',book=0,page=0,pageSize=20}={}){
 const q=String(query).trim().toLowerCase(),selected=tasks.filter(t=>sourceMatches(t,book)&&(!q||(t.title+' '+t.source+' '+(t.topicLabel||'')).toLowerCase().includes(q)))
 const count=Math.ceil(selected.length/pageSize),index=Math.min(Math.max(0,page),Math.max(0,count-1))
 return {items:selected.slice(index*pageSize,(index+1)*pageSize).map(t=>({id:t.id,title:t.title.replace(/^Cambridge IELTS \d+ Academic\s*[-–]\s*/i,''),book:t.book,test:t.test,type:t.type,sourceLabel:sourceLabel(t),minutes:t.minutes,questionCount:t.questionCount??t.questions.length,sourceAvailability:t.sourceAvailability,sourceRevision:t.sourceRevision,sourceRevisions:Array.isArray(t.sourceRevisions)?t.sourceRevisions:undefined})),total:selected.length,page:index,pageCount:count}
}
module.exports={assetUrl,images,normalizeTask,loadIeltsContent,getIeltsTask,catalogPage,subscribeIeltsContent}
