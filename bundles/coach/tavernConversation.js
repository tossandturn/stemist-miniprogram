const {requestJson,COACH_TEXT_TIMEOUT_MS}=require('../../utils/api')

const TAVERN_PAGE_LIMIT=40
const ID_PATTERN=/^[A-Za-z0-9:_-]+$/
const fail=(message,code='invalid_tavern_conversation')=>{const error=Error(message);error.code=code;throw error}
const scalar=(value,label,max=180)=>{if(typeof value!=='string')fail(`${label}无效`);const clean=value.trim();if(!clean||clean.length>max||!ID_PATTERN.test(clean))fail(`${label}无效`);return clean}
const optionalScalar=(value,label,max=180)=>value===undefined||value===null||value===''?'':scalar(value,label,max)
const cursor=value=>{if(value===undefined||value===null||value==='')return'';if(typeof value!=='string')fail('历史游标无效');const clean=value.trim();if(!clean||clean.length>240||/[\u0000-\u001f\u007f]/.test(clean))fail('历史游标无效');return clean}
const integer=(value,label)=>{const number=Number(value);if(!Number.isSafeInteger(number)||number<0)fail(`${label}无效`);return number}
const cleanContent=value=>{if(typeof value!=='string')return'';return value.replaceAll(String.fromCharCode(0),'').trim()}
function randomId(prefix,{now=Date.now(),random=Math.random}={}){const time=Number(now),value=Number(random());if(!Number.isFinite(time)||time<0||!Number.isFinite(value)||value<0||value>=1)fail('本机请求标识无效');return`${prefix}:${Math.trunc(time).toString(36)}:${Math.floor(value*Number.MAX_SAFE_INTEGER).toString(36)}`}
const newClientTurnId=options=>randomId('turn',options)

function legacyTavernMessages(value){
 const rounds=[];let pending=''
 const source=Array.isArray(value)?value:[]
 for(let index=0;index<source.length;index++){
  const item=source[index],role=item&&typeof item==='object'?String(item.role||''):''
  const content=cleanContent(item?.content)
  if(!content||!['user','assistant'].includes(role))continue
  if(role==='user'){pending=content;continue}
  if(pending){rounds.push({role:'user',content:pending},{role:'assistant',content});pending=''}
 }
 return rounds
}

function legacyImportIdFor(persona,value){
 const role=scalar(persona,'persona',80),messages=legacyTavernMessages(value);let first=2166136261,second=2246822519
 for(let index=0;index<messages.length;index++){
  const text=`${messages[index].role}:${messages[index].content}`
  for(let offset=0;offset<text.length;offset++){const code=text.charCodeAt(offset);first=Math.imul(first^code,16777619)>>>0;second=Math.imul(second+code+offset,3266489917)>>>0}
 }
 return`legacy:${role}:${messages.length}:${first.toString(36)}${second.toString(36)}`
}

function legacyDisplayTavernMessages(value){
 const legacy=legacyTavernMessages(value).slice(-TAVERN_PAGE_LIMIT),messages=[]
 for(let index=0;index<legacy.length;index++){const item=legacy[index];messages.push({id:`legacy-local:${index+1}:${item.role}`,role:item.role,content:item.content,sequence:index+1,status:'complete'})}
 return messages
}

function canonicalMessage(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('历史消息无效')
 const id=scalar(value.id,'message.id',180),role=String(value.role||''),content=cleanContent(value.content),sequence=integer(value.sequence,'message.sequence'),status=scalar(value.status,'message.status',40)
 if(!['user','assistant'].includes(role)||!content)fail('历史消息无效')
 return{id,role,content,sequence,status}
}

function displayTavernMessages(value){
 const source=Array.isArray(value)?value:[],local=[],seen=new Set()
 for(let index=0;index<source.length;index++){
  const item=canonicalMessage(source[index])
  if(seen.has(item.id))fail('历史消息重复')
  seen.add(item.id);local.push(item)
 }
 local.sort((left,right)=>left.sequence-right.sequence||left.id.localeCompare(right.id))
 return local.slice(-TAVERN_PAGE_LIMIT)
}

function mergeTavernMessages(...lists){
 const merged=new Map()
 for(const value of lists){
  const source=Array.isArray(value)?value:[]
  for(let index=0;index<source.length;index++){
   const item=canonicalMessage(source[index]),previous=merged.get(item.id)
   if(previous&&(previous.role!==item.role||previous.content!==item.content||previous.sequence!==item.sequence||previous.status!==item.status))fail('历史消息版本冲突','tavern_conversation_message_conflict')
   if(!previous)merged.set(item.id,item)
  }
 }
 return displayTavernMessages([...merged.values()])
}

function conversationRecord(value,expectedPersona=''){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('对话信息缺失')
 const record={id:scalar(value.id,'conversation.id'),persona:scalar(value.persona,'conversation.persona',80),revision:integer(value.revision,'conversation.revision'),turnCount:integer(value.turnCount,'conversation.turnCount')}
 if(expectedPersona&&record.persona!==expectedPersona)fail('对话预设不匹配','tavern_conversation_persona_mismatch')
 return record
}

function legacyImportRecord(value){
 if(value===undefined||value===null)return null
 if(!value||typeof value!=='object'||Array.isArray(value))fail('旧对话同步确认无效','tavern_legacy_import_unconfirmed')
 return{importId:scalar(value.importId,'legacyImport.importId'),confirmed:value.confirmed===true,importedMessageCount:integer(value.importedMessageCount,'legacyImport.importedMessageCount')}
}

function normalizeTavernEnvelope(payload,expectedPersona=''){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('对话响应无效')
 const result={conversation:conversationRecord(payload.conversation,expectedPersona),messages:displayTavernMessages(payload.messages),nextBefore:cursor(payload.nextBefore)},legacyImport=legacyImportRecord(payload.legacyImport)
 if(legacyImport)result.legacyImport=legacyImport
 return result
}

function queryString(values){return Object.entries(values).filter(([,value])=>value!=='').map(([key,value])=>`${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}

async function resumeTavernConversation({persona,attemptId='',conversationId='',legacyImport=null}={}){
 const role=scalar(persona,'persona',80),attempt=optionalScalar(attemptId,'attemptId'),id=optionalScalar(conversationId,'conversationId')
 const body={persona:role,...(attempt?{attemptId:attempt}:{}),...(id?{conversationId:id}:{})}
 if(legacyImport){const importId=scalar(legacyImport.importId,'legacyImport.importId'),messages=legacyTavernMessages(legacyImport.messages);if(messages.length)body.legacyImport={importId,messages}}
 const result=normalizeTavernEnvelope(await requestJson('/api/ai/tavern/conversations/resume',body,{method:'POST'}),role)
 if(body.legacyImport){const ack=result.legacyImport;if(!ack||ack.confirmed!==true||ack.importId!==body.legacyImport.importId||ack.importedMessageCount!==body.legacyImport.messages.length)fail('本机旧对话尚未完整同步，请重试。','tavern_legacy_import_unconfirmed')}
 return result
}

async function fetchTavernMessages({conversationId,persona,before='',attemptId=''}={}){
 const id=scalar(conversationId,'conversationId'),role=scalar(persona,'persona',80),older=cursor(before),attempt=optionalScalar(attemptId,'attemptId')
 const query=queryString({before:older,limit:String(TAVERN_PAGE_LIMIT),persona:role,attemptId:attempt})
 return normalizeTavernEnvelope(await requestJson(`/api/ai/tavern/conversations/${encodeURIComponent(id)}/messages?${query}`,undefined,{method:'GET'}),role)
}

async function deleteTavernConversation({conversationId,persona,attemptId=''}={}){
 const id=scalar(conversationId,'conversationId'),role=scalar(persona,'persona',80),attempt=optionalScalar(attemptId,'attemptId'),query=queryString({persona:role,attemptId:attempt})
 const result=await requestJson(`/api/ai/tavern/conversations/${encodeURIComponent(id)}?${query}`,undefined,{method:'DELETE'})
 if(!result||result.deleted!==true||scalar(result.conversationId,'conversationId')!==id)fail('云端对话清除未确认','tavern_conversation_delete_unconfirmed')
 return{deleted:true,conversationId:id}
}

function memoryRecord(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('长期记忆状态无效')
 return{contextWindowTokens:integer(value.contextWindowTokens,'memory.contextWindowTokens'),estimatedInputUpperBoundTokens:integer(value.estimatedInputUpperBoundTokens,'memory.estimatedInputUpperBoundTokens'),countingMethod:String(value.countingMethod||'').trim().slice(0,80),historyTruncated:Boolean(value.historyTruncated),usedHistoryMessages:integer(value.usedHistoryMessages,'memory.usedHistoryMessages'),retrievedSegments:integer(value.retrievedSegments,'memory.retrievedSegments')}
}

async function sendTavernTurn({persona,message,conversationId,clientTurnId,expectedRevision,attemptId='',drawId=''}={}){
 const role=scalar(persona,'persona',80),id=scalar(conversationId,'conversationId'),turnId=scalar(clientTurnId,'clientTurnId'),revision=integer(expectedRevision,'expectedRevision'),attempt=optionalScalar(attemptId,'attemptId'),draw=optionalScalar(drawId,'drawId'),text=cleanContent(message)
 if(!text)fail('消息不能为空')
 const body={feature:'tavern',persona:role,message:text,conversationId:id,clientTurnId:turnId,expectedRevision:revision,...(attempt?{attemptId:attempt}:{}),...(draw?{drawId:draw}:{})}
 const result=await requestJson('/api/ai/coach',body,{method:'POST',timeout:COACH_TEXT_TIMEOUT_MS||55_000})
 if(!result||result.mode!=='ai'||result.providerStatus!=='connected')return result
 const returnedTurn=scalar(result.clientTurnId,'clientTurnId')
 if(returnedTurn!==turnId)fail('AI 回应与当前请求不匹配','tavern_conversation_turn_mismatch')
 const normalized=normalizeTavernEnvelope({conversation:result.conversation,messages:result.turns,nextBefore:''},role)
 if(normalized.conversation.id!==id||normalized.conversation.revision<revision)fail('AI 回应版本已过期','tavern_conversation_revision_stale')
 if(normalized.messages.length!==2||normalized.messages[0].role!=='user'||normalized.messages[1].role!=='assistant')fail('AI 回应缺少完整问答','tavern_conversation_turn_incomplete')
 const local={}
 for(const key of Object.keys(result))local[key]=result[key]
 local.conversation=normalized.conversation;local.clientTurnId=returnedTurn;local.turns=normalized.messages;local.memory=memoryRecord(result.memory)
 return local
}

module.exports={TAVERN_PAGE_LIMIT,displayTavernMessages,legacyDisplayTavernMessages,legacyImportIdFor,legacyTavernMessages,mergeTavernMessages,newClientTurnId,normalizeTavernEnvelope,resumeTavernConversation,fetchTavernMessages,deleteTavernConversation,sendTavernTurn}
