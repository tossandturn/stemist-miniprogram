const {requestIeltsLearning}=require('./ieltsLearning')
function cloudRecord(attempt){
 const item=String(attempt.itemId||''),base=item.split('::')[0],match=base.match(/^cam(\d+)-[lrws]-test(\d+)/)
 const section=Number(item.split('::section::')[1])||0
 const name={reading:'Reading',listening:'Listening',writing:'Writing',speaking:'Speaking'}[attempt.module]||'练习'
 const title=(match?'Cambridge '+match[1]+' · Test '+match[2]+' · ':'')+name+(section?' · '+(attempt.module==='reading'?'Passage ':'Section ')+section:'')
 return {id:String(attempt.attemptId),cloud:true,category:'ielts',skill:attempt.module,taskId:base,section,title,submittedAt:Date.parse(attempt.submittedAt)||0,band:Number.isFinite(attempt.score?.band)?attempt.score.band:null,selfScore:'',mode:String(attempt.mode||''),coachMode:'synced'}
}
async function learningState(){const result=await requestIeltsLearning('/api/learning/state?summary=1',undefined,{method:'GET'});return {profile:result.profile,records:(result.attempts||[]).map(cloudRecord)}}
async function learningReport(id){if(!/^[a-zA-Z0-9_-]{8,100}$/.test(id))throw new Error('记录地址无效。');const result=await requestIeltsLearning('/api/learning/attempts/'+id,undefined,{method:'GET'});if(!result.attempt)throw new Error('记录尚未返回。');return result.attempt}
module.exports={learningState,learningReport,cloudRecord}
