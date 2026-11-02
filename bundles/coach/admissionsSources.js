const {normalizeTavernEnvelope,mergeTavernMessages}=require('./tavernConversation')
const clean=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max):''
function normalizeDirectoryTarget(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>['kind','id'].includes(key))&&['course','university'].includes(value.kind)&&typeof value.id==='string'&&/^[a-z0-9][a-z0-9._-]{0,99}$/.test(value.id)?{kind:value.kind,id:value.id}:null}
function sourceTime(value){const time=Date.parse(value);return Number.isFinite(time)?new Date(time+8*3600000).toISOString().slice(0,16).replace('T',' ')+'（北京）':''}
function publicUrl(value){
 const text=clean(value,2048),match=/^https:\/\/([a-z0-9.-]+)(\/[^?#\s]*)?$/i.exec(text)
 if(!match||!match[1].includes('.')||/^[\d.]+$/.test(match[1])||/\.(local|internal|localhost)$/i.test(match[1]))return''
 return text
}
function normalizeSources(value){
 const result=[],seen=new Set()
 for(const source of Array.isArray(value)?value:[]){
  const id=clean(source?.id,40),url=publicUrl(source?.url),title=clean(source?.title,180),retrievedAt=clean(source?.retrievedAt,40)
  if(!/^S[1-8]-(?:[a-f0-9]{12}|[a-f0-9]{24})$/.test(id)||!url||!title||!/^\d{4}-\d{2}-\d{2}T/.test(retrievedAt)||!Number.isFinite(Date.parse(retrievedAt))||seen.has(id))continue
  const years=(Array.isArray(source.applicableYears)?source.applicableYears:[]).filter(x=>/^20\d{2}$/.test(String(x))).slice(0,6)
  const verification=source.verification||{},target=/^20\d{2}$/.test(String(verification.requestedYear||''))?String(verification.requestedYear):''
  const institution=verification.kind==='institution-requirements',curriculum=verification.kind==='curriculum-information'
  seen.add(id)
  result.push({id,url,title,retrievedAt,excerpt:clean(source.excerpt,900),applicableYears:years,verification:{kind:curriculum?'curriculum-information':institution?'institution-requirements':'course-requirements',requestedYear:target,yearMatched:verification.yearMatched===true},dateLabel:'读取于 '+sourceTime(retrievedAt),yearLabel:curriculum?'考试局课程说明，不是大学录取线':institution?'学校级政策，不等于专业录取线':(years.length?'官网适用年 '+years.join(' / '):'官网未标明适用年')+(target&&verification.yearMatched!==true?' · 尚未核实 '+target+' 入学要求':''),domain:url.split('/')[2]})
  if(result.length===3)break
 }
 return result
}
function normalizeAdvisorEnvelope(payload,persona){
 const result=normalizeTavernEnvelope(payload,persona)
 if(persona!=='admissions-advisor')return result
 const raw=new Map((payload.messages||[]).map(item=>[item.id,item]))
 result.messages=result.messages.map(item=>item.role==='assistant'?{...item,sourceConversationId:result.conversation.id,sources:normalizeSources(raw.get(item.id)?.research?.sources||raw.get(item.id)?.sources)}:item)
 return result
}
function mergeAdvisorMessages(...lists){
 const sources=new Map(),conversations=new Map()
 for(const list of lists)for(const item of list||[])if(item?.role==='assistant'){
  const normalized=normalizeSources(item.research?.sources||item.sources)
  if(normalized.length)sources.set(item.id,normalized)
  if(/^[A-Za-z0-9:_-]{8,180}$/.test(item.sourceConversationId||''))conversations.set(item.id,item.sourceConversationId)
 }
 return mergeTavernMessages(...lists).map(item=>item.role==='assistant'?{...item,sourceConversationId:conversations.get(item.id)||'',sources:sources.get(item.id)||[]}:item)
}
module.exports={normalizeSources,normalizeAdvisorEnvelope,mergeAdvisorMessages,publicUrl,sourceTime,normalizeDirectoryTarget}
