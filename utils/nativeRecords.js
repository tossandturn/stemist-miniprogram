const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
function compact(record){
 const submittedAt=Number(record.submittedAt)||Date.parse(record.submittedAt)||Date.now()
 return {
  id:String(record.id||record.attemptId||`${record.skill}:${record.taskId||record.paperId||''}:${submittedAt}`),
  category:String(record.category||'ielts'),skill:String(record.skill||''),
  taskId:String(record.taskId||''),paperId:String(record.paperId||''),routeId:String(record.routeId||''),
  subjectCode:String(record.subjectCode||''),stage:String(record.stage||''),mode:String(record.mode||''),
  title:String(record.title||record.taskTitle||record.skill||'练习'),submittedAt,
  band:Number.isFinite(record.band)?record.band:null,selfScore:record.selfScore??'',coachMode:String(record.coachMode||''),scoreLabel:String(record.scoreLabel||'').slice(0,100),reportAvailable:record.reportAvailable===true
 }
}
function rememberRecord(record){const key='stemistRecordIndex:'+owner(),items=wx.getStorageSync(key)||[],next=compact(record);wx.setStorageSync(key,[next,...items.filter(item=>item.id!==next.id||item.skill!==next.skill)].slice(0,200))}
function recentRecords(){const entries=wx.getStorageSync('stemistRecordIndex:'+owner())||[];const legacy=['listening','reading','writing','speaking','stem-photo'].map(scope=>wx.getStorageSync('stemistSubmission:'+scope)).filter(Boolean).map(compact);return [...new Map([...entries,...legacy].map(item=>[item.skill+':'+item.id+':'+item.submittedAt,item])).values()].sort((a,b)=>b.submittedAt-a.submittedAt)}
module.exports={rememberRecord,recentRecords}
