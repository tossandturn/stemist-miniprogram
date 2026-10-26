// The native chunk boundary is a byte boundary, not a character/event boundary.
function utf8Decoder(){
 let tail=[]
 return{push(input,final=false){
  if(typeof input==='string'){if(tail.length)throw new Error('invalid UTF-8');return input}
  const bytes=Array.from(new Uint8Array(input?.buffer||input||[],input?.byteOffset||0,input?.byteLength)),all=tail.concat(bytes);tail=[];let text=''
  for(let i=0;i<all.length;){
   const first=all[i],size=first<128?1:first>=194&&first<=223?2:first>=224&&first<=239?3:first>=240&&first<=244?4:0
   if(!size)throw new Error('invalid UTF-8')
   if(i+size>all.length){tail=all.slice(i);break}
   let point=first&(size===1?127:127>>size)
   for(let j=1;j<size;j++){if((all[i+j]&192)!==128)throw new Error('invalid UTF-8');point=(point<<6)|(all[i+j]&63)}
   if((size===2&&point<128)||(size===3&&point<2048)||(size===4&&point<65536)||point>1114111||(point>=55296&&point<=57343))throw new Error('invalid UTF-8')
   text+=String.fromCodePoint(point);i+=size
  }
  if(final&&tail.length)throw new Error('incomplete UTF-8')
  return text
 }}
}

function stableAnswer(text){
 const source=String(text||'').slice(0,40000);let math='',bold=false,code='',safe=0
 for(let i=0;i<source.length;i++){
  const rest=source.slice(i,i+3),c=source[i]
  if(rest.startsWith('```')||c==='`'){const marker=rest.startsWith('```')?'```':'`';if(!math){code=code===marker?'':code||marker;i+=marker.length-1;continue}}
  if(code)continue
  if(c==='\\'){
   const next=source[i+1]
   if(!math&&(next==='('||next==='[')){math=next==='('?')':']';i++;continue}
   if(math&&next===math){math='';i++;if(!bold)safe=i+1;continue}
   if(next==='$'||next==='\\'){i++;continue}
  }
  if(c==='$'){const marker=source[i+1]==='$'?'$$':'$';if(!math)math=marker;else if(math===marker)math='';i+=marker.length-1;continue}
  if(math)continue
  if(rest.startsWith('**')){bold=!bold;i++;continue}
  if(!bold&&(c==='\n'||/[。！？!?]/.test(c)))safe=i+1
 }
 const result=source.slice(0,safe).trimEnd()
 return result.replace(/^\s*#{1,6}[^\n]*(?:\n|$)/gm,'').trim()?result:''
}

function liveAnswer(text){
 const source=String(text||'').slice(0,40000),safe=stableAnswer(source),tail=source.slice(safe.length)
 if(!/[\\`$*{}<>]/.test(tail)&&!/^\s*#{1,6}[^\n]*$/.test(tail)&&source.replace(/^\s*#{1,6}[^\n]*(?:\n|$)/gm,'').trim())return source.trimEnd()
 return safe
}
function createCoachStream({onPreview=()=>{},onMeta=()=>{}}={}){
 const decoder=utf8Decoder();let buffer='',answer='',preview='',terminal=null,timer=null,closed=false,allow=false,received=false,wire=0,lastPaint=0
 const error=code=>Object.assign(new Error('回答连接中断，已收到的内容不是完整答案，请重试。'),{code,partialAnswer:stableAnswer(answer)})
 const paint=()=>{timer=null;if(closed||!allow)return;const next=liveAnswer(answer);if(next===preview)return;preview=next;lastPaint=Date.now();onPreview(next)}
 const schedule=()=>{if(!lastPaint)paint();else if(!timer)timer=setTimeout(paint,120)}
 const dispatch=block=>{
  let name='message',data=[]
  for(const line of block.split(/\r?\n/)){if(line.startsWith('event:'))name=line.slice(6).trim();else if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''))}
  if(!data.length)return
  let value;try{value=JSON.parse(data.join('\n'))}catch{throw error('stream_invalid')}
  if(!value||typeof value!=='object')throw error('stream_invalid')
  if(terminal)return
  if(name==='meta'){allow=value.mode==='ai'||value.mode==='local';onMeta(value)}
  else if(name==='delta'&&allow){if(typeof value.text!=='string'||answer.length+value.text.length>120000)throw error('stream_limit');answer+=value.text;schedule()}
  else if(name==='reset'){answer='';preview='';lastPaint=0;clearTimeout(timer);timer=null;onPreview('')}
  else if(name==='done'){terminal=value;clearTimeout(timer);timer=null}
 }
 const push=input=>{
  if(closed)return
  received=true;wire+=typeof input==='string'?input.length:input?.byteLength||0
  if(wire>1024*1024)throw error('stream_limit')
  try{buffer+=decoder.push(input)}catch{throw error('stream_invalid')}
  let match
  while((match=/\r?\n\r?\n/.exec(buffer))){const block=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);dispatch(block)}
  if(buffer.length>256*1024)throw error('stream_limit')
 }
 return{push,finish(body){
  if(!received&&body)push(body)
  try{decoder.push(new ArrayBuffer(0),true)}catch{throw error('stream_invalid')}
  if(!terminal)throw error('stream_incomplete')
  return terminal
 },partial:()=>stableAnswer(answer),close(){closed=true;clearTimeout(timer);timer=null}}
}
module.exports={createCoachStream,stableAnswer,liveAnswer}
