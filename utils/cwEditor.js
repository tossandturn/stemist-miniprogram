const { FUNCTIONS } = require('./calculator')
const SYMBOL = /^(?:ans|pi|[ABCDEFexyz])$/
const SYMBOL_AT_END = /(ans|pi|[ABCDEFexyz])$/
const clamp = (value, text) => Math.max(0, Math.min(text.length, Number.isInteger(value) ? value : text.length))

function atomSpans(text) {
  const spans=[]
  const pattern=/[A-Za-z][A-Za-z0-9_]*(?:\()?/g
  for(const match of text.matchAll(pattern)) {
    const raw=match[0], name=raw.replace(/\($/,'').toLowerCase()
    if((raw.endsWith('(')&&FUNCTIONS.has(name)) || ['ans','pi'].includes(name)) spans.push({start:match.index,end:match.index+raw.length,raw})
  }
  return spans
}
function snapCursor(text, cursor) {
  const stops=cursorStops(text), requested=clamp(cursor,text)
  return stops.reduce((best,at)=>Math.abs(at-requested)<Math.abs(best-requested)?at:best,stops[0])
}
function moveCursor(text, cursor, delta) {
  const stops=cursorStops(text), at=snapCursor(text,cursor)
  const frame=templateFrames(text,at)[0]
  // CW's LEFT from the beginning of a denominator exits before the fraction;
  // UP selects its numerator. This is the manual's LEFT, LEFT, INS sequence.
  if(delta<0&&frame?.node.name==='frac'&&frame.index===1&&at===frame.slot.start)return frame.node.start
  return delta<0 ? stops.filter(p=>p<at).pop() ?? 0 : stops.find(p=>p>at) ?? text.length
}
function insertKey(source, cursor, value, overwrite=false) {
  const template=keyTemplate(value)
  if(template)return insertTemplate(source,cursor,template)
  const at=clamp(cursor,source), frames=templateFrames(source,at)
  // A closing parenthesis exits the current generated template. It must not
  // insert a second close or leave raw implementation commas in the editor.
  if(value===')'&&frames.length&&at===frames[0].slot.end)return {expression:source,cursor:frames[0].node.end}
  if(value===','&&frames.length){const {node,index}=frames[0];if(node.slots[index+1])return{expression:source,cursor:node.slots[index+1].start}}
  return insertLiteral(source,cursor,value,overwrite)
}
function insertLiteral(source,cursor,value,overwrite=false) {
  let before=source.slice(0,clamp(cursor,source)), after=source.slice(clamp(cursor,source)), text=String(value)
  const tail=before.match(SYMBOL_AT_END)
  // A symbolic key must not merge with digits into 2E3, 2e+3, Ans2 or pi2.
  // Parentheses retain *implicit* multiplication instead of changing CW's
  // divisor grouping by inserting an explicit multiplication operator.
  if(tail && /^[0-9.A-Za-z]/.test(text)) before=before.slice(0,-tail[0].length)+`(${tail[0]})`
  if(SYMBOL.test(text) && ((/^[Ee]$/.test(text)&&/[\d.]$/.test(before)) || /^[\dA-Za-z]/.test(after))) text=`(${text})`
  if(overwrite&&text.length===1) after=after.slice(1)
  return { expression:before+text+after, cursor:before.length+text.length }
}
function removeBackward(source, cursor) {
  const at=snapCursor(source,cursor)
  if(!at)return {expression:source,cursor:0}
  const frames=templateFrames(source,at)
  const frame=frames.find(f=>f.slot.start===at)
  if(frame){
    const {node,index}=frame
    if(index>0)return {expression:source,cursor:node.slots[index-1].end}
    const values=node.slots.map(s=>source.slice(s.start,s.end))
    let replacement=''
    if(values.some(Boolean)){
      if(node.name==='frac')replacement=values[1]?`(${values[0]})/(${values[1]})`:values[0]
      else if(node.slots.length===1)replacement=values[0]?`(${values[0]})`:''
      // Deletion must never silently discard another filled parameter.
      else return {expression:source,cursor:node.start}
    }
    return {expression:source.slice(0,node.start)+replacement+source.slice(node.end),cursor:node.start}
  }
  const preceding=allTemplates(parseTree(source)).filter(n=>n.end===at).sort((a,b)=>a.start-b.start)[0]
  if(preceding)return removeBackward(source,preceding.slots[preceding.slots.length-1].end)
  const atom=atomSpans(source).find(s=>s.end===at)
  if(!atom)return {expression:source.slice(0,at-1)+source.slice(at),cursor:at-1}
  const retainGroup=atom.raw.endsWith('(')&&source.slice(at).length>0
  return {expression:source.slice(0,atom.start)+(retainGroup?'(':'')+source.slice(at),cursor:atom.start+(retainGroup?1:0)}
}

function fractionAt(text,start) {
  let depth=1,comma=-1,end=start+5
  for(;end<text.length&&depth;end++) {if(text[end]==='(')depth++;if(text[end]===')')depth--;if(text[end]===','&&depth===1)comma=end}
  return depth||comma<0?null:{start,comma,end}
}
function pretty(text) {
  return text.replace(/ans/gi,'Ans').replace(/pi/gi,'π').replace(/sqrt\(/g,'√(').replace(/\*/g,'×').replace(/\//g,'÷').replace(/\^2\b/g,'²')
}
function renderParts(text, cursor, showCursor=true) {
  const at=showCursor?clamp(cursor,text):-1,parts=[]
  let from=0, placed=false
  const caret=()=>{if(!placed){parts.push({kind:'caret'});placed=true}}
  const plain=(start,end)=>{
    if(!placed&&at>=start&&at<=end){if(at>start)parts.push({kind:'text',text:pretty(text.slice(start,at))});caret();if(at<end)parts.push({kind:'text',text:pretty(text.slice(at,end))})}
    else if(end>start)parts.push({kind:'text',text:pretty(text.slice(start,end))})
  }
  while(from<text.length){
    const start=text.indexOf('frac(',from), f=start<0?null:fractionAt(text,start)
    if(!f)break
    plain(from,start)
    const numerator=text.slice(start+5,f.comma),denominator=text.slice(f.comma+1,f.end-1)
    const part={kind:'fraction',numerator:pretty(numerator),denominator:pretty(denominator),caretZone:''}
    if(!placed&&at>start&&at<=f.comma){const offset=Math.max(0,at-start-5);part.caretZone='numerator';part.before=pretty(numerator.slice(0,offset));part.after=pretty(numerator.slice(offset));placed=true}
    else if(!placed&&at>f.comma&&at<f.end){const offset=Math.max(0,at-f.comma-1);part.caretZone='denominator';part.before=pretty(denominator.slice(0,offset));part.after=pretty(denominator.slice(offset));placed=true}
    parts.push(part);from=f.end
  }
  plain(from,text.length)
  if(!text)parts.push({kind:'text',text:'0'})
  return parts
}
function verticalCursor(text,cursor,direction) {
  const frames=templateFrames(text,cursor)
  for(const {node,slot,index} of frames){
    let target=-1
    if(node.name==='frac')target=direction==='down'&&index===0?1:direction==='up'&&index===1?0:-1
    if(node.name==='mixed')target=direction==='down'&&index===1?2:direction==='up'&&index===2?1:-1
    if(['root','logb'].includes(node.name))target=direction==='down'&&index===0?1:direction==='up'&&index===1?0:-1
    if(node.name==='power'&&direction==='down')return node.end
    if(target>=0){const to=node.slots[target];return snapCursor(text,to.start+Math.min(to.end-to.start,Math.max(0,cursor-slot.start)))}
  }
  const power=allTemplates(parseTree(text)).find(n=>n.name==='power'&&n.start===cursor)
  if(power&&direction==='up')return power.slots[0].start
  // UP/DOWN within a template cannot unexpectedly replace the draft with history.
  if(frames.length)return cursor
  return null
}

// Canonical strings remain the persisted/evaluator format. This bounded syntax
// tree models *editing slots*, including empty slots, independently of numeric
// evaluation. It therefore also restores older frac(...) history without a
// lossy conversion or a second, stale copy of an editor document.
const ARITY={frac:2,mixed:3,root:2,logb:2,ncr:2,npr:2,dms:3}
function parseTree(text) {
  function row(start,end,depth=0){
    const children=[]
    for(let i=start;i<end;){
      const found=text.slice(i,end).match(/^(\^|[a-zA-Z][a-zA-Z0-9_]*)\(/)
      const name=found?.[1]==='^'?'power':found?.[1].toLowerCase()
      if(depth<32&&found&&(name==='power'||FUNCTIONS.has(name))){
        const open=i+found[0].length-1, commas=[];let level=1,j=open+1
        for(;j<end&&level;j++){if(text[j]==='(')level++;else if(text[j]===')')level--;else if(text[j]===','&&level===1)commas.push(j)}
        if(!level&&(commas.length===(ARITY[name]||1)-1||(name==='log'&&commas.length===1))){
          const boundaries=[open,...commas,j-1]
          const slots=boundaries.slice(0,-1).map((p,k)=>row(p+1,boundaries[k+1],depth+1))
          children.push({kind:'template',name,start:i,end:j,slots});i=j;continue
        }
      }
      const raw=text.slice(i,end).match(/^[A-Za-z][A-Za-z0-9_]*(?:\()?/)
      const atomic=raw&&((raw[0].endsWith('(')&&FUNCTIONS.has(raw[0].slice(0,-1).toLowerCase()))||['ans','pi'].includes(raw[0].toLowerCase()))
      const length=atomic?raw[0].length:1
      children.push({kind:'text',start:i,end:i+length,text:text.slice(i,i+length)});i+=length
    }
    return {kind:'row',start,end,children}
  }
  return row(0,text.length)
}
function allTemplates(row){const result=[];for(const node of row.children){if(node.kind==='template'){result.push(node);for(const slot of node.slots)result.push(...allTemplates(slot))}}return result}
function templateFrames(text,cursor){
  return allTemplates(parseTree(text)).flatMap(node=>node.slots.map((slot,index)=>({node,slot,index})).filter(f=>cursor>=f.slot.start&&cursor<=f.slot.end)).sort((a,b)=>(a.node.end-a.node.start)-(b.node.end-b.node.start))
}
function cursorStops(text){
  const result=new Set([0,text.length])
  function visit(row){result.add(row.start);result.add(row.end);for(const node of row.children){result.add(node.start);result.add(node.end);if(node.kind==='template')node.slots.forEach(visit)}}
  visit(parseTree(text));return [...result].sort((a,b)=>a-b)
}
function firstEmptySlot(text){return allTemplates(parseTree(text)).flatMap(n=>n.slots).find(s=>!text.slice(s.start,s.end).trim())?.start ?? null}
function keyTemplate(value){
  if(value==='^(')return 'power'
  if(value==='^2')return 'square'
  if(value==='^(-1)')return 'reciprocal'
  if(value==='*10^(')return 'exponent'
  const match=String(value).match(/^([a-z]+)\($/)
  return match&&FUNCTIONS.has(match[1])?match[1]:null
}
function argumentStart(text,at,floor=0){
  if(at<=floor)return at
  if(/[!%]$/.test(text.slice(0,at)))return argumentStart(text,at-1,floor)
  const number=text.slice(floor,at).match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/)
  if(number)return at-number[0].length
  const symbol=text.slice(floor,at).match(/(?:ans|pi|[ABCDEFexyz])$/)
  if(symbol)return at-symbol[0].length
  if(text[at-1]===')'){
    let level=1,i=at-2;for(;i>=floor&&level;i--){if(text[i]===')')level++;else if(text[i]==='(')level--}
    if(level)return at
    const open=i+1
    if(text[open-1]==='^')return argumentStart(text,open-1,floor)
    const fn=text.slice(floor,open).match(/[a-zA-Z]+$/)
    return fn&&FUNCTIONS.has(fn[0].toLowerCase())?open-fn[0].length:open
  }
  return at
}
function argumentEnd(text,at,ceiling=text.length){
  const templates=allTemplates(parseTree(text)), template=templates.find(n=>n.start===at)
  let end=at
  if(template)end=template.end
  else {
    const value=text.slice(at,ceiling).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|^(?:ans|pi|[ABCDEFexyz])/)
    if(value)end=at+value[0].length
    else if(text[at]==='('){let level=1,j=at+1;for(;j<ceiling&&level;j++){if(text[j]==='(')level++;else if(text[j]===')')level--}if(!level)end=j}
  }
  if(end===at)return end
  while(end<ceiling){
    const suffix=templates.find(n=>n.name==='power'&&n.start===end)
    if(suffix)end=suffix.end
    else if('!%'.includes(text[end]))end++
    else break
  }
  return end
}
function insertTemplate(source,cursor,kind,{captureRight=false}={}){
  let at=snapCursor(source,cursor), start=at,end=at, name=kind, values=[], selected=0
  const frames=templateFrames(source,at), floor=frames[0]?.slot.start||0
  if(kind==='dms'&&frames[0]?.node.name==='dms'){
    const {node,index}=frames[0];return {expression:source,cursor:node.slots[index+1]?.start??node.end}
  }
  if(['power','square','reciprocal','exponent'].includes(kind)){
    let prefix=''
    if(kind==='exponent')prefix='*10'
    else if(argumentStart(source,at,floor)===at)prefix='ans'
    // A second power outside the exponent applies to the already powered
    // value. The evaluator's right-associative ^ must not turn (2^3)^2 into 2^9.
    const previousPower=allTemplates(parseTree(source)).find(n=>n.name==='power'&&n.end===at)
    if(kind!=='exponent'&&previousPower){
      start=argumentStart(source,at,floor)
      prefix=`(${source.slice(start,at)})`
    }
    const exponent=kind==='square'?'2':kind==='reciprocal'?'-1':''
    const insertion=`${prefix}^(${exponent})`
    return {expression:source.slice(0,start)+insertion+source.slice(at),cursor:start+insertion.length-(exponent?0:1)}
  }
  if(['frac','mixed','ncr','npr','dms'].includes(name)){
    start=argumentStart(source,at,floor)
    values=Array(ARITY[name]).fill('');values[0]=source.slice(start,at)
    selected=start<at?1:0
  }else{
    values=Array(ARITY[name]||1).fill('')
    if(captureRight){end=argumentEnd(source,at,frames[0]?.slot.end||source.length);values[values.length-1]=source.slice(at,end);selected=values.length-1}
  }
  const insertion=`${name}(${values.join(',')})`
  let prefix=source.slice(0,start)
  const tail=prefix.match(SYMBOL_AT_END)
  if(tail)prefix=prefix.slice(0,-tail[0].length)+`(${tail[0]})`
  const expression=prefix+insertion+source.slice(end)
  const before=values.slice(0,selected).reduce((length,value)=>length+value.length+1,0)
  return {expression,cursor:prefix.length+name.length+1+before+(captureRight?values[selected].length:0)}
}
function jumpTemplate(text,cursor,direction){const f=templateFrames(text,cursor)[0];return f?direction<0?f.node.start:f.node.end:direction<0?0:text.length}
module.exports={insertKey,moveCursor,snapCursor,removeBackward,renderParts,verticalCursor,parseTree,templateFrames,firstEmptySlot,insertTemplate,keyTemplate,jumpTemplate,pretty}
