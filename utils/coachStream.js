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
module.exports={stableAnswer,liveAnswer}
