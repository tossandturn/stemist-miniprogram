// STEM-only presentation. Keep formula boundaries; never interpret provider HTML.
const {answerSource,dollarMath}=require('./nativeAnswer')
const {mathNodes,formulaBlock,formatMathSource}=require('./nativeMath')
const text=value=>({type:'text',text:value})
const element=(name,style,children)=>({name,attrs:{style},children})
const MAX_BLOCKS=120,MAX_SECTIONS=40
function academicAnswer(value){
 const {plain,links,sourceTruncated}=answerSource(value),sections=[]
 const budget={remaining:1200,truncated:false,academic:true}
 let count=0,current=null,truncated=sourceTruncated
 function section(title=''){
  if(sections.length>=MAX_SECTIONS){truncated=true;return}
  const kind=/^(?:最终答案|答案|结论|final answer|answer|conclusion)[：:]?$/i.test(title)?'result':/^(?:检验|检查|验算|验证|check|verification)[：:]?$/i.test(title)?'check':'explanation'
  current={id:sections.length,title,kind,blocks:[]};sections.push(current)
 }
 function formula(source){
  // Preserve explicit alignment/line boundaries and text commands; normalize only
  // spaces around operators, not the mathematical token structure.
  const formatted=String(source).split(/(\\text\{[^}]*\})/g).map(part=>part.startsWith('\\text{')?part:formatMathSource(part).replace(/\\(?:times|cdot|pm|leq?|geq?|sim)(?![A-Za-z])/g,' $& ')).join('')
  return mathNodes(formatted,0,true,budget)
 }
 function inline(source){
  const nodes=[];let cursor=0
  const pattern=/\\\(([\s\S]*?)\\\)|\$([^$\n]+)\$|\*\*([^*\n]+)\*\*|`([^`\n]+)`/g
  const prose=value=>{
   if(!value)return
   // Legacy un-delimited TeX still gets a readable fallback, ordinary a_b stays text.
   const math=/\\[A-Za-z]+|[A-Za-z0-9)]\^\{/.test(value)
   nodes.push(...mathNodes(math?formatMathSource(value):value.replace(/\\\$/g,'$'),0,math,budget))
  }
  for(const match of source.matchAll(pattern)){
   if(match[2]!==undefined&&source[match.index-1]==='\\')continue
   if(budget.remaining<=0){budget.truncated=true;break}
   prose(source.slice(cursor,match.index))
   if(match[1]!==undefined||match[2]!==undefined&&dollarMath(match[2]))nodes.push(...formula(match[1]??match[2]))
   else if(match[3]!==undefined){budget.remaining--;nodes.push(element('strong','font-weight:650;',inline(match[3])))}
   else if(match[4]!==undefined){budget.remaining--;nodes.push(element('code','font-family:monospace;', [text(match[4])]))}
   else prose(match[0])
   cursor=match.index+match[0].length
  }
  prose(source.slice(cursor));return nodes
 }
 function add(kind,nodes,extra={}){
  if(!current)section()
  if(!current||count>=MAX_BLOCKS||budget.remaining<=0){truncated=true;return}
  const previous=current.blocks[current.blocks.length-1]
  if(kind==='formula'&&previous?.kind==='formula'){
   previous.nodes.push(...nodes);previous.rows++;return
  }
  current.blocks.push({id:count++,kind,nodes,...extra})
 }
 function equation(source){
  const lines=source.trim().includes('\\begin')?[source.trim()]:source.trim().split(/\n+/).map(x=>x.trim()).filter(Boolean)
  for(const line of lines)add('formula',[element('div','display:block;white-space:nowrap;line-height:1.9;padding:4px 0;',formula(line))],{rows:1})
 }
 function prose(source){
  const lines=source.replace(/\r/g,'').split('\n')
  for(let i=0;i<lines.length;i++){
   if(count>=MAX_BLOCKS||budget.remaining<=0){truncated=true;break}
   const line=lines[i].trim();if(!line||/^[-*_]{3,}$/.test(line)||/^```(?:latex|math)?\s*$/.test(line))continue
   if(line.startsWith('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]||'')){
    const rows=[line];i+=2
    while(i<lines.length&&lines[i].trim().startsWith('|')&&rows.length<30)rows.push(lines[i++].trim())
    i--
    const cells=row=>(row.replace(/^\||\|$/g,'').match(/(?:\\\||[^|])+/g)||['']).slice(0,10)
    const nodes=[element('table','border-collapse:collapse;min-width:100%;',rows.map((row,index)=>element('tr','',cells(row).map(cell=>element(index?'td':'th','border:1px solid #e4e7f0;padding:8px 10px;text-align:left;white-space:nowrap;',inline(cell.trim()))))))]
    add('table',nodes);continue
   }
   const heading=line.match(/^#{1,6}\s+(.{1,80})$/)||line.match(/^\*\*([^*\n]{1,50})\*\*\s*$/)
   const label=line.match(/^\*\*([^*\n]{1,30})[：:]?\*\*[：:]?\s*(.+)$/)
   if(heading&&!/[=^\\]/.test(heading[1])){section(heading[1].replace(/[：:]$/,''));continue}
   if(label&&/^(?:结论|答案|最终答案|解题步骤|关键概念|方法方向|下一步动作|检验习惯|检验|检查|易错点)[：:]?$/.test(label[1])){
    section(label[1].replace(/[：:]$/,''));add('paragraph',inline(label[2]));continue
   }
   const step=line.match(/^(\d{1,3}[.)、]|[-*+])\s+(.+)$/)
   if(step){add('step',inline(step[2]),{marker:/^\d/.test(step[1])?step[1].replace(/[) 、]/g,'.'):'•'});continue}
   if(formulaBlock(line)){equation(line);continue}
   add('paragraph',inline(line))
  }
 }
 // Display math is tokenized before paragraph/list parsing, including indented
 // equations in model-generated lists. Delimiters are not discarded globally.
 const display=/\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g
 let cursor=0
 for(const match of plain.matchAll(display)){
  if(match[2]!==undefined&&plain[match.index-1]==='\\')continue
  prose(plain.slice(cursor,match.index));equation(match[1]??match[2]);cursor=match.index+match[0].length
  if(count>=MAX_BLOCKS||budget.remaining<=0){truncated=true;break}
 }
 if(!truncated||cursor<plain.length)prose(plain.slice(cursor))
 return {sections,links,truncated:truncated||budget.truncated}
}
module.exports={academicAnswer}
