const COMMANDS={lambda:'λ',mu:'μ',pi:'π',theta:'θ',alpha:'α',beta:'β',gamma:'γ',Delta:'Δ',times:'×',cdot:'·',div:'÷',pm:'±',ne:'≠',neq:'≠',le:'≤',leq:'≤',ge:'≥',geq:'≥',rightarrow:'→',to:'→',degree:'°',infty:'∞',approx:'≈',therefore:'∴',partial:'∂',nabla:'∇',int:'∫',sum:'∑',prod:'∏',in:'∈',notin:'∉',subset:'⊂',supset:'⊃',parallel:'∥',perp:'⊥',cdots:'⋯',ldots:'…',dots:'…',ell:'ℓ',forall:'∀',exists:'∃',sin:'sin',cos:'cos',tan:'tan',ln:'ln',log:'log',lim:'lim',exp:'exp'}
const text=value=>({type:'text',text:String(value||'')})
const span=(style,children)=>({name:'span',attrs:{style},children})
const ACADEMIC_COMMANDS={sim:'∼',simeq:'≃',equiv:'≡',propto:'∝',circ:'°',epsilon:'ε',varepsilon:'ε',delta:'δ',sigma:'σ',Sigma:'Σ',omega:'ω',Omega:'Ω',rho:'ρ',phi:'φ',varphi:'φ',Phi:'Φ',tau:'τ',eta:'η',nu:'ν',psi:'ψ',Psi:'Ψ',chi:'χ',zeta:'ζ',kappa:'κ',Gamma:'Γ',Theta:'Θ',Rightarrow:'⇒',implies:'⇒',Leftrightarrow:'⇔',iff:'⇔',mp:'∓',cdotp:'·',langle:'⟨',rangle:'⟩',lvert:'|',rvert:'|',vert:'|',lVert:'‖',rVert:'‖',Vert:'‖',infty:'∞',ldotp:'.',prime:'′',emptyset:'∅',cup:'∪',cap:'∩',subseteq:'⊆',supseteq:'⊇',colon:':',arcsin:'arcsin',arccos:'arccos',arctan:'arctan',sinh:'sinh',cosh:'cosh',tanh:'tanh',det:'det',max:'max',min:'min'}
function group(src,start){
 if(src[start]!=='{')return null
 let depth=0
 for(let i=start;i<src.length;i++){
  if(src[i]==='{')depth++
  else if(src[i]==='}'&&!--depth)return{content:src.slice(start+1,i),end:i+1}
 }
 return null
}
function argument(src,start,academic=false){
 let i=start;while(/\s/.test(src[i]||''))i++
 const value=group(src,i)
 if(!value&&academic&&src[i]==='\\'){const token=src.slice(i).match(/^\\(?:[A-Za-z]+|.)/);if(token)return{content:token[0],end:i+token[0].length}}
 return value||{content:src[i]||'',end:Math.min(src.length,i+1)}
}
function squareArgument(src,start){
 let i=start;while(/\s/.test(src[i]||''))i++
 if(src[i]!=='[')return null
 const end=src.indexOf(']',i+1)
 return end<0?null:{content:src.slice(i+1,end),end:end+1}
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
 if(budget.academic&&/^(?:(?:p|b|B|v|V|small)?matrix|cases|aligned|align\*?|gather|gathered|split)$/.test(name)){
  const matrix=/matrix$/.test(name),cases=name==='cases',delimiters={pmatrix:['(',')'],bmatrix:['[',']'],Bmatrix:['{','}'],vmatrix:['|','|'],Vmatrix:['‖','‖']}[name]||(cases?['{','']:['',''])
  const table={name:'table',attrs:{style:'display:inline-table;vertical-align:middle;border-collapse:collapse;margin:2px 3px;'},children:[]}
  if(!take(budget))return nodes
  for(const row of rows){
   if(!take(budget))break
   const tr={name:'tr',children:[]};table.children.push(tr)
   for(let index=0;index<row.length;index++){
    if(!take(budget))break
    const align=matrix?'center':cases?'left':index===0?'right':'left'
    tr.children.push({name:'td',attrs:{style:'border:0;padding:3px '+(matrix?'9':'4')+'px;text-align:'+align+';white-space:nowrap;'},children:mathNodes(row[index],depth+1,true,budget)})
   }
  }
  const bracket=value=>{if(value&&take(budget))nodes.push(span('font-size:'+Math.min(4,rows.length*1.2)+'em;vertical-align:middle;',[text(value)]))}
  bracket(delimiters[0]);nodes.push(table);bracket(delimiters[1]);return nodes
 }
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
 const src=String(value||''),nodes=[];let buffer='',i=0
 const arg=(src,start)=>argument(src,start,budget.academic)
 const add=node=>{if(take(budget)){nodes.push(node);return true}return false},extend=value=>nodes.push(...value)
 const addSpan=(style,children)=>{if(!take(budget))return;const node=span(style,[]);nodes.push(node);node.children=children()}
 const flush=()=>{if(buffer){add(text(buffer));buffer=''}}
 while(i<src.length&&budget.remaining>0){
  const ch=src[i]
  if(ch==='^'||ch==='_'){
   const next=arg(src,i+1)
   if(!next.content){buffer+=ch;i++;continue}
   flush();addSpan(ch==='^'?'font-size:.72em;vertical-align:super;line-height:1;':'font-size:.72em;vertical-align:sub;line-height:1;',()=>mathNodes(next.content,depth+1,true,budget));i=next.end;continue
  }
  if(ch==='{'){
   const next=group(src,i)
   if(next){flush();extend(mathNodes(next.content,depth+1,true,budget));i=next.end;continue}
  }
  if(ch!=='\\'){buffer+=ch;i++;continue}
  if(src[i+1]==='\\'){buffer+=' ';i+=2;continue}
  const match=src.slice(i+1).match(/^([A-Za-z]+|.)/)
  if(!match){i++;continue}
  const cmd=match[1];i+=match[0].length+1
  if(['frac','dfrac','tfrac'].includes(cmd)){
   const num=arg(src,i),den=arg(src,num.end);i=den.end;flush()
   addSpan('display:inline-block;vertical-align:middle;text-align:center;line-height:1.15;margin:0 3px;',()=>{
    const children=[]
    if(take(budget))children.push(span('display:block;border-bottom:1px solid #18213d;padding:0 3px 1px;',mathNodes(num.content,depth+1,true,budget)))
    if(take(budget))children.push(span('display:block;padding:1px 3px 0;',mathNodes(den.content,depth+1,true,budget)))
    return children
   });continue
  }
  if(cmd==='binom'){
   const upper=arg(src,i),lower=arg(src,upper.end);i=lower.end;flush();add(text('('));addSpan('display:inline-block;vertical-align:middle;text-align:center;line-height:1.15;margin:0 2px;',()=>{
    const children=[]
    if(take(budget))children.push(span('display:block;',mathNodes(upper.content,depth+1,true,budget)))
    if(take(budget))children.push(span('display:block;',mathNodes(lower.content,depth+1,true,budget)))
    return children
   });add(text(')'));continue
  }
  if(cmd==='overset'||cmd==='underset'){
   const note=arg(src,i),base=arg(src,note.end);i=base.end;flush();addSpan('display:inline-block;vertical-align:middle;text-align:center;line-height:1.05;margin:0 2px;',()=>{
    const top=cmd==='overset'?note:base,bottom=cmd==='overset'?base:note,children=[]
    if(take(budget))children.push(span(cmd==='overset'?'display:block;font-size:.72em;':'display:block;',mathNodes(top.content,depth+1,true,budget)))
    if(take(budget))children.push(span(cmd==='overset'?'display:block;':'display:block;font-size:.72em;',mathNodes(bottom.content,depth+1,true,budget)))
    return children
   });continue
  }
  if(cmd==='sqrt'){
   const degree=squareArgument(src,i);if(degree)i=degree.end
   const root=arg(src,i);i=root.end;flush()
   if(degree)addSpan('font-size:.72em;vertical-align:super;line-height:1;',()=>mathNodes(degree.content,depth+1,true,budget))
   add(text('√'));addSpan('display:inline-block;border-top:1px solid #18213d;padding:0 2px;',()=>mathNodes(root.content,depth+1,true,budget));continue
  }
  if(cmd==='begin'){
   const env=arg(src,i),name=env.content.trim();i=env.end
   if(!/^[A-Za-z*]{1,24}$/.test(name)){flush();add(text('[公式环境过长]'));budget.truncated=true;i=src.length;continue}
   const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),end=new RegExp('\\\\end\\s*\\{\\s*'+escaped+'\\s*\\}').exec(src.slice(i))
   if(end){const content=src.slice(i,i+end.index);i+=end.index+end[0].length;flush();extend(environmentNodes(name,content,depth,budget))}else{flush();add(text('['+(name||'formula')+']'))}continue
  }
  if(cmd==='end'){i=arg(src,i).end;continue}
  if(['boxed','overline','bar','hat','tilde','vec','overrightarrow'].includes(cmd)){
   const next=arg(src,i);i=next.end;flush()
   const style=cmd==='boxed'?'display:inline-block;border:1px solid #7357e8;border-radius:4px;padding:0 4px;':['overline','bar'].includes(cmd)?'display:inline-block;border-top:1px solid #18213d;': ''
   addSpan(style,()=>mathNodes(next.content,depth+1,true,budget));if(cmd==='vec'||cmd==='overrightarrow')add(text('⃗'));if(cmd==='hat')add(text('̂'));if(cmd==='tilde')add(text('̃'));continue
  }
  if(['text','textbf','mathrm','mathit','operatorname','mathbf','boldsymbol','bm'].includes(cmd)){
   const next=arg(src,i);i=next.end;flush();if(budget.academic&&cmd==='text'){add(text(next.content));continue}extend(mathNodes(next.content,depth+1,true,budget));continue
  }
  if(cmd==='left'||cmd==='right'||cmd==='displaystyle')continue
  if(['quad','qquad','enspace',',',';',':','!'].includes(cmd)){buffer+=' ';continue}
  if(['(',')','[',']'].includes(cmd))continue
  if(['$','%','#','&','_','{','}'].includes(cmd)){buffer+=cmd;continue}
  if(budget.academic&&cmd===' '){buffer+=' ';continue}
  if(budget.academic&&ACADEMIC_COMMANDS[cmd]){buffer+=ACADEMIC_COMMANDS[cmd];continue}
  if(COMMANDS[cmd]){buffer+=COMMANDS[cmd];continue}
  buffer+='\\'+cmd
  let nextStart=i;while(/\s/.test(src[nextStart]||''))nextStart++
  let unknownArgument=group(src,nextStart)
  while(unknownArgument){buffer+=src.slice(i,unknownArgument.end);i=unknownArgument.end;nextStart=i;while(/\s/.test(src[nextStart]||''))nextStart++;unknownArgument=group(src,nextStart)}
 }
 if(i<src.length)budget.truncated=true
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
