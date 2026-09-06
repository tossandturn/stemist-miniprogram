function createClock(minutes,now=Date.now()){
 const seconds=Number(minutes)*60
 if(!Number.isFinite(seconds)||seconds<=0||seconds>24*3600)throw new Error('试题时长无效。')
 return {startedAt:now,deadlineAt:now+seconds*1000,limitSeconds:seconds}
}
function clockState(clock,now=Date.now()){
 if(!clock||!Number.isFinite(clock.startedAt)||!Number.isFinite(clock.deadlineAt)||clock.deadlineAt<=clock.startedAt)return null
 const effective=Number.isFinite(clock.finishedAt)?clock.finishedAt:now
 const remaining=Math.max(0,Math.ceil((clock.deadlineAt-effective)/1000))
 return {remaining,expired:remaining===0,elapsed:Math.max(0,Math.floor((effective-clock.startedAt)/1000)),label:String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0')}
}
module.exports={createClock,clockState}
