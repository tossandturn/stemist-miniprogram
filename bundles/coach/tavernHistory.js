const TAVERN_HISTORY_MAX_ROUNDS=20,TAVERN_HISTORY_MAX_MESSAGES=40,TAVERN_HISTORY_MAX_CHARS=24000,TAVERN_HISTORY_MAX_MESSAGE_CHARS=3000
const clip=value=>Array.from(String(value||'').trim()).slice(0,TAVERN_HISTORY_MAX_MESSAGE_CHARS).join('')
function boundedTavernHistory(value){
 const rounds=[];let pending=null
 for(const item of Array.isArray(value)?value:[]){
  if(!item||!['user','assistant'].includes(item.role)||typeof item.content!=='string')continue
  const content=clip(item.content);if(!content)continue
  if(item.role==='user'){pending={role:'user',content};continue}
  if(pending){rounds.push([pending,{role:'assistant',content}]);pending=null}
 }
 const selected=[];let characters=0
 for(let index=rounds.length-1;index>=0&&selected.length<TAVERN_HISTORY_MAX_ROUNDS;index--){const round=rounds[index],size=Array.from(round[0].content).length+Array.from(round[1].content).length;if(characters+size>TAVERN_HISTORY_MAX_CHARS)break;selected.unshift(round);characters+=size}
 return selected.flat().slice(-TAVERN_HISTORY_MAX_MESSAGES)
}
module.exports={TAVERN_HISTORY_MAX_MESSAGES,TAVERN_HISTORY_MAX_ROUNDS,TAVERN_HISTORY_MAX_CHARS,TAVERN_HISTORY_MAX_MESSAGE_CHARS,boundedTavernHistory}
