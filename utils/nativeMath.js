const COMMANDS={lambda:'λ',mu:'μ',pi:'π',theta:'θ',alpha:'α',beta:'β',gamma:'γ',Delta:'Δ',times:'×',cdot:'·',div:'÷',pm:'±',ne:'≠',neq:'≠',le:'≤',leq:'≤',ge:'≥',geq:'≥',rightarrow:'→',to:'→',degree:'°',infty:'∞',approx:'≈',therefore:'∴',partial:'∂',nabla:'∇',int:'∫',sum:'∑',prod:'∏',in:'∈',notin:'∉',subset:'⊂',supset:'⊃',parallel:'∥',perp:'⊥',cdots:'⋯',ldots:'…',dots:'…',ell:'ℓ',forall:'∀',exists:'∃',sin:'sin',cos:'cos',tan:'tan',ln:'ln',log:'log',lim:'lim',exp:'exp'}
const text=value=>({type:'text',text:String(value||'')})
const span=(style,children)=>({name:'span',attrs:{style},children})
function group(source,start){
 if(source[start]!=='{')return null
 let depth=0
 for(let i=start;i<source.length;i++){
  if(source[i]==='{')depth++
  else if(source[i]==='}'&&!--depth)return{content:source.slice(start+1,i),end:i+1}
 }
 return null
}
function argument(source,start){
 let i=start;while(/\s/.test(source[i]||''))i++
 const value=group(source,i)
 return value||{content:source[i]||'',end:Math.min(source.length,i+1)}
}
function squareArgument(source,start){
 let i=start;while(/\s/.test(source[i]||''))i++
 if(source[i]!=='[')return null
 const end=source.indexOf(']',i+1)
 return end<0?null:{content:source.slice(i+1,end),end:end+1}
}
function compact(nodes){
 const output=[]
 for(const node of nodes){
  if(node?.type==='text'&&!node.text)continue
  const previous=output[output.length-1]
  if(node?.type==='text'&&previous?.type==='text')previous.text+=node.text
  else output.push(node)
 }
 return output
}
function take(budget){if(budget.remaining<=0){budget.truncated=true;return false}budget.remaining--;return true}
function environmentNodes(name,content,depth,budget){
 const nodes=[],addText=value=>{if(value&&take(budget))nodes.push(text(value))},extend=value=>nodes.push(...value)
 const rows=String(content||'').split(/\\\\(?:\[[^\]]*\])?/).map(row=>row.trim()).filter(Boolean).map(row=>row.split('&').map(cell=>cell.trim()))
 const cells=(row,separator)=>row.forEach((cell,index)=>{if(index)addText(separator);extend(mathNodes(cell,depth+1,true,budget))})
 if(/^(?:p|b|B|v|V|small)?matrix$/.test(name)){
  addText('[');rows.forEach((row,index)=>{if(index)addText('; ');addText('[');cells(row,', ');addText(']')});addText(']');return nodes
 }
 if(name==='cases'){
  addText('{ ');rows.forEach((row,index)=>{if(index)addText('; ');cells(row,'  if  ')});addText(' }');return nodes
 }
 if(['aligned','align','align*','gather','gathered','split'].includes(name)){
  rows.forEach((row,index)=>{if(index)addText('; ');cells(row,' ')});return nodes
 }
 addText('['+(name||'formula')+': ');rows.forEach((row,index)=>{if(index)addText('; ');cells(row,' | ')});addText(']');return nodes
}
function mathNodes(value,depth=0,enabled=true,budget={remaining:900,truncated:false}){
 if(!enabled){if(!take(budget))return[];return[text(String(value||''))]}
 if(depth>12){if(!take(budget))return[];return[text(String(value||'').replace(/[\\{}]/g,'').slice(0,2000))]}
 const source=String(value||''),nodes=[];let buffer='',i=0
 const add=node=>{if(take(budget)){nodes.push(node);return true}return false},extend=value=>nodes.push(...value)
 const addSpan=(style,children)=>{if(!take(budget))return;const node=span(style,[]);nodes.push(node);node.children=children()}
 const flush=()=>{if(buffer){add(text(buffer));buffer=''}}
 while(i<source.length&&budget.remaining>0){
  const character=source[i]
  if(character==='^'||character==='_'){
   const next=argument(source,i+1)
   if(!next.content){buffer+=character;i++;continue}
   flush();addSpan(character==='^'?'font-size:.72em;vertical-align:super;line-height:1;':'font-size:.72em;vertical-align:sub;line-height:1;',()=>mathNodes(next.content,depth+1,true,budget));i=next.end;continue
  }
  if(character==='{'){
   const next=group(source,i)
   if(next){flush();extend(mathNodes(next.content,depth+1,true,budget));i=next.end;continue}
  }
  if(character!=='\\'){buffer+=character;i++;continue}
  if(source[i+1]==='\\'){buffer+=' ';i+=2;continue}
  const match=source.slice(i+1).match(/^([A-Za-z]+|.)/)
  if(!match){i++;continue}
  const command=match[1];i+=match[0].length+1
  if(['frac','dfrac','tfrac'].includes(command)){
   const numerator=argument(source,i),denominator=argument(source,numerator.end);i=denominator.end;flush()
   addSpan('display:inline-block;vertical-align:middle;text-align:center;line-height:1.15;margin:0 3px;',()=>{
    const children=[]
    if(take(budget))children.push(span('display:block;border-bottom:1px solid #18213d;padding:0 3px 1px;',mathNodes(numerator.content,depth+1,true,budget)))
    if(take(budget))children.push(span('display:block;padding:1px 3px 0;',mathNodes(denominator.content,depth+1,true,budget)))
    return children
   });continue
  }
  if(command==='binom'){
   const upper=argument(source,i),lower=argument(source,upper.end);i=lower.end;flush();add(text('('));addSpan('display:inline-block;vertical-align:middle;text-align:center;line-height:1.15;margin:0 2px;',()=>{
    const children=[]
    if(take(budget))children.push(span('display:block;',mathNodes(upper.content,depth+1,true,budget)))
    if(take(budget))children.push(span('display:block;',mathNodes(lower.content,depth+1,true,budget)))
    return children
   });add(text(')'));continue
  }
  if(command==='overset'||command==='underset'){
   const annotation=argument(source,i),base=argument(source,annotation.end);i=base.end;flush();addSpan('display:inline-block;vertical-align:middle;text-align:center;line-height:1.05;margin:0 2px;',()=>{
    const top=command==='overset'?annotation:base,bottom=command==='overset'?base:annotation,children=[]
    if(take(budget))children.push(span(command==='overset'?'display:block;font-size:.72em;':'display:block;',mathNodes(top.content,depth+1,true,budget)))
    if(take(budget))children.push(span(command==='overset'?'display:block;':'display:block;font-size:.72em;',mathNodes(bottom.content,depth+1,true,budget)))
    return children
   });continue
  }
  if(command==='sqrt'){
   const degree=squareArgument(source,i);if(degree)i=degree.end
   const root=argument(source,i);i=root.end;flush()
   if(degree)addSpan('font-size:.72em;vertical-align:super;line-height:1;',()=>mathNodes(degree.content,depth+1,true,budget))
   add(text('√'));addSpan('display:inline-block;border-top:1px solid #18213d;padding:0 2px;',()=>mathNodes(root.content,depth+1,true,budget));continue
  }
  if(command==='begin'){
   const environment=argument(source,i),name=environment.content.trim();i=environment.end
   if(!/^[A-Za-z*]{1,24}$/.test(name)){flush();add(text('[公式环境过长]'));budget.truncated=true;i=source.length;continue}
   const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),end=new RegExp('\\\\end\\s*\\{\\s*'+escaped+'\\s*\\}').exec(source.slice(i))
   if(end){const content=source.slice(i,i+end.index);i+=end.index+end[0].length;flush();extend(environmentNodes(name,content,depth,budget))}else{flush();add(text('['+(name||'formula')+']'))}continue
  }
  if(command==='end'){i=argument(source,i).end;continue}
  if(['boxed','overline','bar','hat','tilde','vec','overrightarrow'].includes(command)){
   const next=argument(source,i);i=next.end;flush()
   const style=command==='boxed'?'display:inline-block;border:1px solid #7357e8;border-radius:4px;padding:0 4px;':['overline','bar'].includes(command)?'display:inline-block;border-top:1px solid #18213d;': ''
   addSpan(style,()=>mathNodes(next.content,depth+1,true,budget));if(command==='vec'||command==='overrightarrow')add(text('⃗'));if(command==='hat')add(text('̂'));if(command==='tilde')add(text('̃'));continue
  }
  if(['text','textbf','mathrm','mathit','operatorname','mathbf','boldsymbol','bm'].includes(command)){
   const next=argument(source,i);i=next.end;flush();extend(mathNodes(next.content,depth+1,true,budget));continue
  }
  if(command==='left'||command==='right'||command==='displaystyle')continue
  if(['quad','qquad','enspace',',',';',':','!'].includes(command)){buffer+=' ';continue}
  if(['(',')','[',']'].includes(command))continue
  if(['$','%','#','&','_','{','}'].includes(command)){buffer+=command;continue}
  if(COMMANDS[command]){buffer+=COMMANDS[command];continue}
  buffer+='\\'+command
  let nextStart=i;while(/\s/.test(source[nextStart]||''))nextStart++
  let unknownArgument=group(source,nextStart)
  while(unknownArgument){buffer+=source.slice(i,unknownArgument.end);i=unknownArgument.end;nextStart=i;while(/\s/.test(source[nextStart]||''))nextStart++;unknownArgument=group(source,nextStart)}
 }
 if(i<source.length)budget.truncated=true
 flush();return compact(nodes)
}
function formulaBlock(value){
 const line=String(value||'').trim()
 if(!line||line.includes('\n')||line.length>320)return false
 if(/^\\(?:frac|dfrac|tfrac|sqrt)\b/.test(line))return true
 if(/^[A-Za-z][A-Za-z0-9()]*[\^_]\{?[-+A-Za-z0-9]+\}?$/.test(line))return true
 return /^(?:[-+]?\d*\.?\d*\s*)?[A-Za-z][A-Za-z0-9()]*\s*(?:\^\{?[-+A-Za-z0-9]+\}?\s*)?(?:=|≤|≥|<|>)/.test(line)
  ||/^[-+]?\d+(?:\.\d+)?[A-Za-z][^。；，]{0,240}=/.test(line)
}
function formatMathSource(value){return String(value||'')
 .replace(/\s*=\s*/g,' = ')
 .replace(/\s*(≤|≥|≠|≈)\s*/g,' $1 ')
 .replace(/([A-Za-z0-9})])\s*\+\s*(?=[A-Za-z0-9\\])/g,'$1 + ')
 .replace(/([A-Za-z0-9})])\s*-\s*(?=[A-Za-z0-9\\])/g,'$1 − ')
 .replace(/\s{2,}/g,' ')
}
module.exports={mathNodes,formulaBlock,formatMathSource}
