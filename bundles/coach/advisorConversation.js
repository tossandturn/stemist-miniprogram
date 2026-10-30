const {requestJson,COACH_TEXT_TIMEOUT_MS}=require('../../utils/api')
const {coachEffortTimeout}=require('../../utils/coachEffort')
const {createCoachStream}=require('./responseStream')
const {normalizeTavernEnvelope,newClientTurnId}=require('./tavernConversation')

const MESSAGE_MAX=12000
const DEFAULT_COPY=Object.freeze({
 invalidConversation:'对话标识无效，请重新进入。',
 invalidMessage:'请输入 1–12000 字符的内容；长文请分段发送。',
 accountChanged:'账号状态已变化，请重新进入。',
 invalidCursor:'历史游标无效。',
 invalidRevision:'对话版本无效，请刷新后重试。',
 invalidDelete:'云端清空尚未确认，请重试。',
 incomplete:'本次回复未完成，输入已保留，请重试。',
 mismatch:'回复与当前问题不匹配，请刷新记录后重试。',
 timeout:'回复超时，输入已保留，请重试。',
 cancelled:'已停止等待，输入已保留。',
 authRequired:'请登录后继续。',
 busy:'请求较多，请稍后重试。',
 commitDeferred:'回答已生成并安全保留，但尚未写入对话；请点击“重试保存”，不会再次调用 AI。',
 generationIndeterminate:'生成结果尚无法确认。为避免重复调用 AI，已停止发送；请刷新记录确认，或清空后重新开始。',
 turnInProgress:'上一条消息仍在处理中，请稍后重试。',
 revisionConflict:'对话已更新，请刷新记录后重试。',
 generatedPending:'上一条回答仍待保存，请刷新记录后重试。',
})

function createAdvisorConversation({root,streamPath,persona,errorPrefix,copy={}}={}){
 const text={...DEFAULT_COPY,...copy},code=name=>errorPrefix+name
 const fail=(message,errorCode=code('response_invalid'))=>Object.assign(Error(message),{code:errorCode})
 const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9._:-]{8,180}$/.test(value))throw fail(text.invalidConversation);return value}
 function cleanMessage(value){
  if(typeof value!=='string')throw fail(text.invalidMessage,code('message_invalid'))
  const bounded=value.replaceAll(String.fromCharCode(0),'').replace(/\r\n?/g,'\n').trim()
  if(!bounded||Array.from(bounded).length>MESSAGE_MAX)throw fail(text.invalidMessage,code('message_invalid'))
  return bounded.replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/_=-]+/gi,'[image omitted]').replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g,'[secret omitted]').replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,'Bearer [secret omitted]')
 }
 function identity(){const owner=String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0;return()=>{if(owner!==String(wx.getStorageSync('stemistUser')?.id||'guest')||epoch!==(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0))throw fail(text.accountChanged,'account_changed')}}
 function receiptFields(value){const fields={};for(const key of ['retryable','exactlyOnceGuaranteed','providerRetryRequired'])if(typeof value?.[key]==='boolean')fields[key]=value[key];if(typeof value?.receiptStatus==='string'&&value.receiptStatus.length<=40)fields.receiptStatus=value.receiptStatus;return fields}
 function safeError(error){
  const errorCode=String(error?.code||''),statusCode=Number(error?.statusCode)||0
  const labels={
   [code('commit_deferred')]:text.commitDeferred,
   [code('generation_indeterminate')]:text.generationIndeterminate,
   [code('turn_in_progress')]:text.turnInProgress,
   [code('conversation_revision_conflict')]:text.revisionConflict,
   tavern_turn_in_progress:text.turnInProgress,
   tavern_revision_conflict:text.revisionConflict,
   tavern_conversation_revision_conflict:text.revisionConflict,
   network_timeout:text.timeout,
   request_cancelled:text.cancelled,
  }
  const original=String(error?.message||'')
  const message=(errorCode===code('generated_result_pending')?text.generatedPending:labels[errorCode])||(statusCode===401?text.authRequired:statusCode===429?text.busy:/[\u4e00-\u9fff]/.test(original)&&!/(?:https?:|bearer|secret|api.key|stack)/i.test(original)?original.slice(0,240):text.incomplete)
  return Object.assign(Error(message),{code:errorCode,statusCode,...receiptFields(error),...(error?.partialAnswer?{partialAnswer:String(error.partialAnswer)}:{})})
 }
 async function read(path,body,options){const current=identity();try{const result=await requestJson(path,body,options);current();return result}catch(error){throw safeError(error)}}
 async function resume({conversationId=''}={}){return normalizeTavernEnvelope(await read(root+'/resume',conversationId?{conversationId:id(conversationId)}:{},{method:'POST'}),persona)}
 async function fetchMessages({conversationId,before=''}={}){
  if(typeof before!=='string'||before.length>240||/[\u0000-\u001f\u007f]/.test(before))throw fail(text.invalidCursor)
  return normalizeTavernEnvelope(await read(root+'/'+encodeURIComponent(id(conversationId))+'/messages?limit=40&before='+encodeURIComponent(before),undefined,{method:'GET'}),persona)
 }
 async function deleteConversation({conversationId}={}){
  const value=id(conversationId),result=await read(root+'/'+encodeURIComponent(value),undefined,{method:'DELETE'})
  if(result?.deleted!==true||result.conversationId!==value)throw fail(text.invalidDelete)
  return result
 }
 async function send({message,conversationId,clientTurnId,expectedRevision,reasoningEffort,onPartial=()=>{},onStage=()=>{},onCancelReady=()=>{}}={}){
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw fail(text.invalidRevision)
  const body={message:cleanMessage(message),conversationId:id(conversationId),clientTurnId:id(clientTurnId),expectedRevision,...(reasoningEffort!==undefined?{reasoningEffort}:{})},current=identity(),timeout=coachEffortTimeout(reasoningEffort,COACH_TEXT_TIMEOUT_MS||55000)
  return new Promise((resolve,reject)=>{
   let closed=false,task=null,timer=null,stream=null
   const abort=()=>{try{task?.abort()}catch{}}
   const finish=(settle,value)=>{if(closed)return;closed=true;clearTimeout(timer);if(settle===reject&&!['account_changed','auth_required','request_cancelled'].includes(value?.code)&&Number(value?.statusCode)!==401)value.partialAnswer=value.partialAnswer||stream?.partial?.()||'';stream?.close?.();settle(value)}
   const guarded=(callback,value)=>{if(closed)return;try{current();callback(value)}catch(error){finish(reject,safeError(error));abort()}}
   stream=createCoachStream({onPreview:value=>guarded(onPartial,value),onMeta:()=>guarded(onStage,'analysis')})
   timer=setTimeout(()=>{finish(reject,fail(text.timeout,'network_timeout'));abort()},timeout)
   try{onCancelReady(()=>{finish(reject,fail(text.cancelled,'request_cancelled'));abort()})}catch(error){finish(reject,safeError(error));return}
   Promise.resolve().then(()=>requestJson(streamPath,body,{timeout,stream,streamCurrent:current,isCancelled:()=>closed,onTask:value=>{task=value},onDispatched:()=>guarded(onStage,'calling')})).then(result=>{
    try{
     current()
     if(result?.mode!=='ai'||result.providerStatus!=='connected'||result.partial===true||result.answerStatus==='partial'){const partialAnswer=String(result?.answer||'').trim();throw Object.assign(fail(text.incomplete,result?.code||code('incomplete')),{statusCode:Number(result?.statusCode)||0,...receiptFields(result),...(partialAnswer?{partialAnswer}:{})})}
     const envelope=normalizeTavernEnvelope({conversation:result.conversation,messages:result.turns,nextBefore:''},persona),turns=envelope.messages,answer=String(result.answer||'').trim()
     if(result.clientTurnId!==body.clientTurnId||envelope.conversation.id!==body.conversationId||envelope.conversation.revision<=body.expectedRevision||turns.length!==2||turns[0].id!==body.clientTurnId+':user'||turns[1].id!==body.clientTurnId+':assistant'||turns[0].role!=='user'||turns[1].role!=='assistant'||turns[0].content!==body.message||!answer||turns[1].content!==answer)throw fail(text.mismatch)
     finish(resolve,{...result,answer,conversation:envelope.conversation,turns})
    }catch(error){finish(reject,safeError(error))}
   },error=>finish(reject,safeError(error)))
  })
 }
 return{cleanMessage,newClientTurnId,resume,fetchMessages,deleteConversation,send}
}

module.exports={createAdvisorConversation}
