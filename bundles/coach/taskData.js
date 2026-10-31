const {requestJson}=require('../../utils/api')
const {taskProgressView}=require('../../utils/coachTaskView')
const {liveAnswer,stableAnswer}=require('../../utils/coachStream')
const ID=/^cj-[A-Za-z0-9_-]{16,80}$/,CURSOR=/^[A-Za-z0-9_-]{1,512}$/
const failure=(message,code='coach_task_protocol')=>Object.assign(Error(message),{code})
const scope=()=>({owner:String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch:Number(wx.getStorageSync('stemistPrivacyEpoch'))||0})
const current=s=>{const n=scope();return Boolean(s&&s.owner===n.owner&&s.epoch===n.epoch)}
function check(s){if(!current(s))throw failure('账号已变化，请重新打开答疑任务。','account_changed');if(s.owner==='guest'||!wx.getStorageSync('stemistSessionToken'))throw failure('登录后可查看自己的答疑任务。','auth_required')}
async function get(s,path,options){check(s);const result=await requestJson(path,undefined,{method:'GET',timeout:8000,...options,authCheck:()=>check(s)});check(s);return result}
function metadata(raw,serverNow){
 const snapshot={id:raw?.id,status:raw?.status,stage:raw?.stage,createdAt:raw?.createdAt,updatedAt:raw?.updatedAt,expiresAt:raw?.expiresAt,serverNow:serverNow??raw?.serverNow,task:raw?.task}
 const view=taskProgressView(snapshot)
 if(!view||!view.savedTask)throw failure('任务信息异常或未保存为任务。')
 if(snapshot.expiresAt<=snapshot.serverNow)throw failure('任务已过期，保存的结果已不可用。','coach_task_expired')
 return{snapshot,view}
}
async function list(s,cursor='',options={}){
 if(cursor&&!CURSOR.test(cursor))throw failure('任务分页信息异常，请刷新第一页。')
 const data=await get(s,'/api/ai/coach/jobs?limit=20'+(cursor?'&cursor='+encodeURIComponent(cursor):''),options)
 if(data?.schemaVersion!=='stem-coach-task-list-v1'||!Number.isSafeInteger(data.serverNow)||!Array.isArray(data.items)||data.items.length>20||data.nextCursor!==null&&!CURSOR.test(data.nextCursor||''))throw failure('任务列表返回异常，请重试。')
 const ids=new Set(),items=data.items.map(raw=>{const value=metadata(raw,data.serverNow);if(ids.has(raw.id))throw failure('任务列表返回异常。');ids.add(raw.id);return value.snapshot})
 return{items,nextCursor:data.nextCursor,serverNow:data.serverNow}
}
async function detail(s,id,options={}){
 if(!ID.test(id||''))throw failure('任务编号无效。')
 const data=await get(s,'/api/ai/coach/jobs/'+encodeURIComponent(id),options)
 if(data?.id!==id)throw failure('任务编号不匹配。')
 const value=metadata(data),done=data.status==='succeeded',raw=done?data.result?.answer:data.answer
 if(raw!==undefined&&(typeof raw!=='string'||raw.length>240000))throw failure('任务答案返回异常。')
 if(done&&(!raw?.trim()||data.result?.partial===true||data.result?.answerStatus==='partial'))throw failure('任务结果尚未完整，请刷新状态。')
 return{...value,answer:done?stableAnswer(raw):liveAnswer(raw||''),partial:!done&&Boolean(raw),local:done&&data.result?.mode==='local'}
}
function errorMessage(error){
 if(error?.code==='account_changed')return'账号已变化，请重新打开答疑任务。'
 if(error?.code==='auth_required'||error?.statusCode===401)return'登录已过期，请登录后查看自己的任务。'
 if(error?.statusCode===404||error?.code==='coach_task_expired')return'任务已过期、已移除，或不属于当前账号。结果仅保留 3 天。'
 if(error?.statusCode===403)return'当前无法查看此任务，请确认账号与题目访问权限。'
 return'暂时无法更新任务状态，请稍后刷新；不会重复提交题目。'
}
module.exports={scope,current,list,detail,errorMessage}
