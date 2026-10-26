const {requestJson,COACH_TEXT_TIMEOUT_MS}=require('../../utils/api')
const {createCoachStream}=require('../../utils/coachStream')
const {normalizeTavernEnvelope,newClientTurnId}=require('./tavernConversation')
const ROOT='/api/ai/admissions/conversations',PERSONA='admissions-advisor'
const MESSAGE_MAX=12000
const fail=(message,code='admissions_response_invalid')=>Object.assign(Error(message),{code})
const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9._:-]{8,180}$/.test(value))throw fail('对话标识无效，请重新进入申请顾问。');return value}
function cleanAdmissionsMessage(value){
 if(typeof value!=='string')throw fail('请输入 1–12000 字符的内容；长文请分段发送。','admissions_message_invalid')
 const bounded=value.replaceAll(String.fromCharCode(0),'').replace(/\r\n?/g,'\n').trim()
 if(!bounded||Array.from(bounded).length>MESSAGE_MAX)throw fail('请输入 1–12000 字符的内容；长文请分段发送。','admissions_message_invalid')
 const clean=bounded.replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/_=-]+/gi,'[image omitted]').replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g,'[secret omitted]').replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,'Bearer [secret omitted]')
 return clean
}
function identity(){const owner=String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0;return()=>{if(owner!==String(wx.getStorageSync('stemistUser')?.id||'guest')||epoch!==(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0))throw fail('账号状态已变化，请重新进入申请顾问。','account_changed')}}
function receiptFields(value){
 const fields={}
 for(const key of ['retryable','exactlyOnceGuaranteed','providerRetryRequired'])if(typeof value?.[key]==='boolean')fields[key]=value[key]
 if(typeof value?.receiptStatus==='string'&&value.receiptStatus.length<=40)fields.receiptStatus=value.receiptStatus
 return fields
}
function safeError(error){
 const code=String(error?.code||''),statusCode=Number(error?.statusCode)||0
 const labels={admissions_commit_deferred:'回答已生成并安全保留，但尚未写入对话；请点击“重试保存”，不会再次调用 AI。',admissions_generation_indeterminate:'生成结果尚无法确认。为避免重复调用 AI，已停止发送；请刷新记录确认，或清空后重新开始。',admissions_turn_in_progress:'上一条消息仍在处理中，请稍后重试。',tavern_turn_in_progress:'上一条消息仍在处理中，请稍后重试。',admissions_conversation_revision_conflict:'对话已更新，请刷新记录后重试。',tavern_revision_conflict:'对话已更新，请刷新记录后重试。',tavern_conversation_revision_conflict:'对话已更新，请刷新记录后重试。',network_timeout:'回复超时，输入已保留，请重试。',request_cancelled:'已停止等待，输入已保留。'}
 const original=String(error?.message||'')
 const message=labels[code]||(statusCode===401?'请登录后继续。':statusCode===429?'请求较多，请稍后重试。':/[\u4e00-\u9fff]/.test(original)&&!/(?:https?:|bearer|secret|api.key|stack)/i.test(original)?original.slice(0,240):'本次回复未完成，输入已保留，请重试。')
 return Object.assign(Error(message),{code,statusCode,...receiptFields(error),...(error?.partialAnswer?{partialAnswer:String(error.partialAnswer)}:{})})
}
async function read(path,body,options){const current=identity();try{const result=await requestJson(path,body,options);current();return result}catch(error){throw safeError(error)}}
async function resumeAdmissions({conversationId=''}={}){return normalizeTavernEnvelope(await read(ROOT+'/resume',conversationId?{conversationId:id(conversationId)}:{},{method:'POST'}),PERSONA)}
async function fetchAdmissionsMessages({conversationId,before=''}={}){
 if(typeof before!=='string'||before.length>240||/[\u0000-\u001f\u007f]/.test(before))throw fail('历史游标无效。')
 return normalizeTavernEnvelope(await read(ROOT+'/'+encodeURIComponent(id(conversationId))+'/messages?limit=40&before='+encodeURIComponent(before),undefined,{method:'GET'}),PERSONA)
}
async function deleteAdmissions({conversationId}={}){
 const value=id(conversationId),result=await read(ROOT+'/'+encodeURIComponent(value),undefined,{method:'DELETE'})
 if(result?.deleted!==true||result.conversationId!==value)throw fail('云端清空尚未确认，请重试。')
 return result
}
async function sendAdmissions({message,conversationId,clientTurnId,expectedRevision,onPartial=()=>{},onStage=()=>{},onCancelReady=()=>{}}={}){
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw fail('对话版本无效，请刷新后重试。')
 const body={message:cleanAdmissionsMessage(message),conversationId:id(conversationId),clientTurnId:id(clientTurnId),expectedRevision},current=identity()
 return new Promise((resolve,reject)=>{
  let closed=false,task=null,timer=null,stream=null
  const abort=()=>{try{task?.abort()}catch{}}
  const finish=(settle,value)=>{if(closed)return;closed=true;clearTimeout(timer);if(settle===reject&&!['account_changed','auth_required','request_cancelled'].includes(value?.code)&&Number(value?.statusCode)!==401)value.partialAnswer=value.partialAnswer||stream?.partial?.()||'';stream?.close?.();settle(value)}
  const guarded=(callback,value)=>{if(closed)return;try{current();callback(value)}catch(error){finish(reject,safeError(error));abort()}}
  stream=createCoachStream({onPreview:text=>guarded(onPartial,text),onMeta:()=>guarded(onStage,'analysis')})
  timer=setTimeout(()=>{finish(reject,fail('回复超时，输入已保留，请重试。','network_timeout'));abort()},COACH_TEXT_TIMEOUT_MS||55000)
  try{onCancelReady(()=>{finish(reject,fail('已停止等待，输入已保留。','request_cancelled'));abort()})}catch(error){finish(reject,safeError(error));return}
  Promise.resolve().then(()=>requestJson('/api/ai/admissions/stream',body,{timeout:COACH_TEXT_TIMEOUT_MS||55000,stream,streamCurrent:current,isCancelled:()=>closed,onTask:value=>{task=value},onDispatched:()=>guarded(onStage,'calling')})).then(result=>{
   try{
    current()
    if(result?.mode!=='ai'||result.providerStatus!=='connected'||result.partial===true||result.answerStatus==='partial'){const partialAnswer=String(result?.answer||'').trim();throw Object.assign(fail('本次回复未完成，输入已保留，请重试。',result?.code||'admissions_incomplete'),{statusCode:Number(result?.statusCode)||0,...receiptFields(result),...(partialAnswer?{partialAnswer}:{})})}
    const envelope=normalizeTavernEnvelope({conversation:result.conversation,messages:result.turns,nextBefore:''},PERSONA),turns=envelope.messages,answer=String(result.answer||'').trim()
    if(result.clientTurnId!==body.clientTurnId||envelope.conversation.id!==body.conversationId||envelope.conversation.revision<=body.expectedRevision||turns.length!==2||turns[0].id!==body.clientTurnId+':user'||turns[1].id!==body.clientTurnId+':assistant'||turns[0].role!=='user'||turns[1].role!=='assistant'||turns[0].content!==body.message||!answer||turns[1].content!==answer)throw fail('回复与当前问题不匹配，请刷新记录后重试。')
    finish(resolve,{...result,answer,conversation:envelope.conversation,turns})
   }catch(error){finish(reject,safeError(error))}
  },error=>finish(reject,safeError(error)))
 })
}
module.exports={cleanAdmissionsMessage,newClientTurnId,resumeAdmissions,fetchAdmissionsMessages,deleteAdmissions,sendAdmissions}
