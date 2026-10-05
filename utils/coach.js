const { askCoach, askIeltsCoach } = require('./api')

const HELP_INTENTS=Object.freeze({HINT:'hint',WORKED_SOLUTION:'worked-solution',CHECK_WORK:'check-work'}),VALID_HELP_INTENTS=new Set(Object.values(HELP_INTENTS)),EXAM_MODE_PATTERN=/^(?:exam|exam-simulation|timed-exam|mock-exam)$/i
function normalizeHelpIntent(value,fallback=''){const intent=String(value||'').trim().toLowerCase();return VALID_HELP_INTENTS.has(intent)?intent:fallback}
function isBoundInProgressExam(context={}){const attempt=context&&typeof context.attempt==='object'?context.attempt:{},bound=Boolean(context.attemptId||attempt.id||attempt.attemptId||context.paperAttemptId),exam=[context.paperStudyMode,context.studyMode,context.mode,context.assessmentMode,attempt.paperStudyMode,attempt.studyMode,attempt.mode].some(value=>EXAM_MODE_PATTERN.test(String(value||'').trim()))||context.timedExam===true||context.examMode===true||attempt.timedExam===true,submitted=context.submitted===true||Boolean(context.submittedAt)||attempt.submitted===true||Boolean(attempt.submittedAt);return bound&&exam&&!submitted}
function coachHelpPolicy(context={}){const solutionDisabled=isBoundInProgressExam(context);return{solutionDisabled,defaultPhotoIntent:solutionDisabled?HELP_INTENTS.HINT:HELP_INTENTS.WORKED_SOLUTION}}
function contextDomain(context={}){const product=String(context.product||'').toLowerCase(),skill=String(context.skill||context.activeModule||context.module||'').toLowerCase();return product.includes('ielts')||['writing','reading','listening','speaking'].includes(skill)?`ielts-${skill||'general'}`:'stem'}
function helpInstruction(intent,context){const domain=contextDomain(context);if(domain==='ielts-writing')return intent===HELP_INTENTS.HINT?'指出一个最重要的写作改进，不要代写全文。':intent===HELP_INTENTS.CHECK_WORK?'按 IELTS 四项标准判断，指出首要问题并示范改写。':'按 IELTS 四项标准给完整反馈、主要修改和精炼范例。';if(domain==='ielts-reading'||domain==='ielts-listening'){const evidence=domain==='ielts-reading'?'原文证据':'听力证据';return intent===HELP_INTENTS.HINT?`提示如何定位${evidence}，不要公布答案。`:intent===HELP_INTENTS.CHECK_WORK?`依据${evidence}判断答案，指出首个错误和正确证据链。`:`用${evidence}完整解析答案和干扰项；资料缺失不要编造。`}return intent===HELP_INTENTS.HINT?'只给提示：指出关键概念和下一步，不给最终答案。':intent===HELP_INTENTS.CHECK_WORK?'检查作答：给出判断、第一处错误和修正方法，不要泛泛表扬。':'我明确选择完整解答。给出概念、方法、步骤、最终结果和检查；内容缺失请让我补充，不要猜。'}
function buildCoachRequest({message='',helpIntent='',context={},hasImages=false}={}){const cleanMessage=String(message||'').trim(),policy=coachHelpPolicy(context),requested=normalizeHelpIntent(helpIntent,hasImages&&!cleanMessage?policy.defaultPhotoIntent:''),resolved=policy.solutionDisabled&&requested===HELP_INTENTS.WORKED_SOLUTION?HELP_INTENTS.HINT:requested;return{helpIntent:resolved,message:[cleanMessage,resolved?helpInstruction(resolved,context):''].filter(Boolean).join('\n\n')}}

function normalizeCoachContext(context = {}) {
const source = context && typeof context === 'object' ? context : {}
return {
...source,
stage: String(source.stage || 'practice'),
source: String(source.source || 'stemist-miniprogram'),
}
}

function coachAnswer(result) {
return String(result && (result.answer || result.message) || '').trim()
}

function safeCoachWarning(value, fallback = '') {
const text = String(value || '').replace(/https?:\/\/\S+/gi, '[链接已隐藏]').trim()
if (!text || /(?:api[_ -]?key|secret|authorization|bearer\s+|sk-[a-z0-9])/i.test(text)) return fallback
if(/timeout|timed out|abort|超时/i.test(text))return 'AI 请求超时，当前内容已保留，请直接重试。'
return text.slice(0, 320)
}

function coachState(result = {}) {
const mode = String(result.mode || '').toLowerCase()
const providerStatus = String(result.providerStatus || '').toLowerCase()
if (mode === 'ai' && providerStatus === 'connected') {
return { label: 'AI 已连接', isConnected: true, isFallback: false, warning: '' }
}
if (mode === 'local' || providerStatus === 'skipped') {
return {
label: '本地提示',
isConnected: false,
isFallback: true,
warning: safeCoachWarning(result.warning, '这是本地提示，未调用 AI，不是正式评分。'),
}
}
if (mode === 'offline' || providerStatus === 'error' || providerStatus === 'not_configured') {
return {
label: 'AI 暂不可用',
isConnected: false,
isFallback: true,
warning: safeCoachWarning(result.warning, 'AI 服务暂时不可用；当前内容是本地提示，不是正式评分。'),
}
}
return { label: '反馈状态待确认', isConnected: false, isFallback: true, warning: '请确认反馈状态后再把结果当作学习依据。' }
}

async function runCoach({ message = '', helpIntent = '', context = {}, imageDataUrls = [], history = [], onStage = null } = {}) {
const images=Array.isArray(imageDataUrls)?imageDataUrls.filter(Boolean):[],normalizedContext=normalizeCoachContext(context),request=buildCoachRequest({message,helpIntent,context:normalizedContext,hasImages:images.length>0})
if(!request.message&&!images.length)throw new Error('请先输入内容或提供照片证据')
const isIelts=String(normalizedContext.product||'').toLowerCase()==='ieltsist'
const stage=value=>{if(typeof onStage==='function')try{onStage(value)}catch{}}
stage('calling')
const result=isIelts?await askIeltsCoach({message:request.message,helpIntent:request.helpIntent,context:normalizedContext,imageDataUrls:images,history,onStage:stage}):await askCoach({message:request.message,helpIntent:request.helpIntent,context:normalizedContext,imageDataUrls:images,history,onStage:stage})
stage('arranging')
const state=coachState(result),mode=String(result.mode||'').toLowerCase(),providerStatus=String(result.providerStatus||'').toLowerCase(),answer=coachAnswer(result),connected=mode==='ai'&&providerStatus==='connected'&&Boolean(answer),localHint=mode==='local'&&providerStatus==='skipped'&&['',HELP_INTENTS.HINT].includes(request.helpIntent)&&Boolean(answer),completed=connected||localHint,failureMessage=images.length?'图片答疑未完成，图片和说明已保留，请重试。':'答疑未完成，问题已保留，请重试。'
return{...result,answer:completed?answer:'',completed,retryable:completed?Boolean(result.retryable):result.retryable!==false,failureMessage:completed?'':failureMessage,helpIntent:request.helpIntent,requestMessage:request.message,coachState:completed?state:{...state,label:'答疑未完成',isConnected:false,isFallback:true,warning:safeCoachWarning(result.warning,failureMessage)}}
}

module.exports={HELP_INTENTS,buildCoachRequest,coachHelpPolicy,normalizeCoachContext,normalizeHelpIntent,coachAnswer,coachState,safeCoachWarning,runCoach}
