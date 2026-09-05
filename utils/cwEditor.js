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
  const at=clamp(cursor,text), atom=atomSpans(text).find(s=>s.start<at&&s.end>at)
  return atom ? (at-atom.start<atom.end-at?atom.start:atom.end) : at
}
function moveCursor(text, cursor, delta) {
  const next=clamp(clamp(cursor,text)+delta,text)
  const atom=atomSpans(text).find(s=>s.start<next&&s.end>next)
  return atom ? delta<0?atom.start:atom.end : next
}
function insertKey(source, cursor, value, overwrite=false) {
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
  let start=0
  while((start=text.indexOf('frac(',start))>=0){
    const f=fractionAt(text,start)
    if(f && cursor>=start && cursor<=f.end){
      if(direction==='up' && cursor>f.comma)return start+5+Math.min(f.comma-start-5,Math.max(0,cursor-f.comma-1))
      if(direction==='down' && cursor>=start+5 && cursor<=f.comma)return f.comma+1+Math.min(f.end-f.comma-2,cursor-start-5)
    }
    start+=5
  }
  return null
}
module.exports={insertKey,moveCursor,snapCursor,removeBackward,renderParts,verticalCursor}
