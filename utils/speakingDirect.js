const {requestIeltsLearning}=require('./ieltsLearning')
const ENDPOINT=/^wss:\/\/(?:[a-z0-9][a-z0-9-]{0,79}\.cn-beijing\.maas\.aliyuncs\.com|dashscope\.aliyuncs\.com)\/api-ws\/v1\/realtime\?model=qwen[a-z0-9.-]{1,90}$/
function validateDirectSession(value){
 const expiry=Date.parse(value?.expiresAt),session=value?.sessionUpdate?.session
 if(value?.protocol!=='qwen-direct-session-v1'||!ENDPOINT.test(value.endpoint||'')||!/^st-[A-Za-z0-9._~-]{16,1024}$/.test(value.token||'')||!Number.isFinite(expiry)||expiry<=Date.now()+1000||expiry>Date.now()+120000)throw Error('直连凭证无效或已过期，请重试。')
 if(value.inputSampleRate!==16000||value.outputSampleRate!==24000||value.maxSessionSeconds!==1200||value.sessionUpdate?.type!=='session.update'||session?.input_audio_format!=='pcm'||session?.output_audio_format!=='pcm'||session?.input_audio_transcription?.model!=='qwen3-asr-flash-realtime'||session?.turn_detection!==null||typeof session?.instructions!=='string'||!session.instructions.trim()||session.instructions.length>24000)throw Error('实时语音配置不兼容，请更新后重试。')
 for(const name of ['opening','next','assessment']){
  const event=value.responses?.[name],response=event?.response
  const modes=response?.modalities,expected=name==='assessment'?['text']:['text','audio']
  if(event?.type!=='response.create'||typeof response?.instructions!=='string'||!response.instructions.trim()||response.instructions.length>16000||!Array.isArray(modes)||modes.length!==expected.length||expected.some(mode=>!modes.includes(mode)))throw Error('考官配置不完整，请重试。')
 }
 return value
}
async function issueDirectSession(context={}){
 const body={taskId:String(context.taskId||'').slice(0,120),recovery:context.recovery===true,elapsedSeconds:Math.max(0,Math.min(1200,Math.floor(Number(context.elapsedSeconds)||0))),completedDialogue:(context.completedDialogue||[]).slice(-16).filter(t=>['user','assistant'].includes(t.role)).map(t=>({role:t.role,text:String(t.text||'').slice(0,400)}))}
 try{return validateDirectSession(await requestIeltsLearning('/api/speaking/direct-session',body,{method:'POST',timeout:12000}))}
 catch(error){
  const messages={direct_not_configured:'国内语音直连尚未配置，请联系管理员。',direct_token_unavailable:'语音连接凭证暂时获取失败，请重试。',direct_rate_limited:'连接请求较多，请稍后再试。',direct_session_rate_limited:'连接请求较多，请稍后再试。',direct_task_not_found:'这个口语话题已更新，请更换话题后重试。'}
  if(messages[error?.code])throw Object.assign(Error(messages[error.code]),{code:error.code,statusCode:error.statusCode})
  throw error
 }
}
module.exports={issueDirectSession,validateDirectSession}
