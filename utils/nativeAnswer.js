const {legacyUrlToNative}=require('./nativeNavigation')
const {mathNodes,formulaBlock,formatMathSource}=require('./nativeMath')
const MAX_SOURCE=40000,MAX_BLOCKS=120,MAX_INLINE_NODES=900
function decodeTwice(value){let result=String(value||'');for(let i=0;i<2;i++){try{const next=decodeURIComponent(result.replace(/\+/g,' '));if(next===result)break;result=next}catch{break}}return result}
function unsafeUrl(value){
 const url=String(value||''),authority=url.match(/^https?:\/\/([^/?#]+)/i)?.[1]||''
 if(!authority||authority.includes('@'))return true
  const tail=decodeTwice(url.slice(url.indexOf(authority)+authority.length)),parts=tail.split(/[?&#;]/).filter(Boolean)
  for(const part of parts){
  const separator=part.indexOf('='),key=decodeTwice(separator<0?'':part.slice(0,separator)).toLowerCase().replace(/[^a-z0-9]/g,''),data=decodeTwice(separator<0?part:part.slice(separator+1))
  if(separator>=0&&/(?:token|secret|password|credential|authorization|signature|session|ticket|apikey|jwt|oauthcode)/.test(key))return true
  if(separator>=0&&key==='code'&&data.length>=12)return true
  if(/(?:^|[^a-z0-9])(?:sk|st)-[a-z0-9._~-]{8,}|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/i.test(data))return true
 }
 return false
}
function schemeAt(source,index){for(const scheme of ['https://','http://','wss://'])if(source.slice(index,index+scheme.length).toLowerCase()===scheme)return scheme;return''}
function trimBareUrl(value){
 let url=String(value||'').replace(/[.,;。；，！!]+$/,'')
 for(const [open,close] of [['(',')'],['[',']']]){
  let balance=0;const unmatched=new Set()
  for(let index=0;index<url.length;index++){
   if(url[index]===open)balance++
   else if(url[index]===close){if(balance)balance--;else unmatched.add(index)}
  }
  let end=url.length
  while(end>0&&url[end-1]===close&&unmatched.has(end-1))end--
  if(end<url.length)url=url.slice(0,end)
 }
 return url
}
function scanUrl(source,start,markdown){
 let index=start,parentheses=0
 while(index<source.length){
  const character=source[index]
  if(/\s|[<>"']/.test(character)||/[，。；！、]/.test(character))break
  if(markdown&&character===')'){if(parentheses===0)break;parentheses--}
  else if(character==='(')parentheses++
  index++
 }
 const raw=source.slice(start,index),url=markdown?raw:trimBareUrl(raw)
 return {url,end:start+url.length,delimiterEnd:index}
}
function linkOccurrences(source){
 const found=[]
 for(let index=0;index<source.length;){
  if(source[index]==='['){
   const relativeClose=source.slice(index+1,index+123).indexOf(']('),close=relativeClose<0?-1:index+1+relativeClose
   if(close>index&&close-index<=121&&!source.slice(index+1,close).includes('\n')){
    const start=close+2
    if(schemeAt(source,start)){
     const scanned=scanUrl(source,start,true)
     if(source[scanned.delimiterEnd]===')'){found.push({start:index,end:scanned.delimiterEnd+1,url:scanned.url,label:source.slice(index+1,close)});index=scanned.delimiterEnd+1;continue}
    }
   }
  }
  if(schemeAt(source,index)){
   const scanned=scanUrl(source,index,false)
   if(scanned.url){found.push({start:index,end:scanned.end,url:scanned.url,label:''});index=scanned.end;continue}
  }
  index++
 }
 return found
}
function dollarMath(value){
 const source=String(value||'')
 if(/\\[A-Za-z]+|[\^_{}=<>]/.test(source))return true
 if(!/^[A-Za-z0-9\s,.;()+*/.^_-]+$/.test(source)||!/[A-Za-z0-9]/.test(source))return false
 if(/^[A-Z]{1,6}$/.test(source.trim()))return true
 return !(source.match(/[A-Za-z]+/g)||[]).some(word=>word.length>1&&!['sin','cos','tan','log','ln','lim','exp'].includes(word.toLowerCase()))
}
function answerContent(value){
 const original=String(value||''),source=original.slice(0,MAX_SOURCE),links=[],seen=new Set(),occurrences=linkOccurrences(source)
 let plain='',cursor=0
 for(const occurrence of occurrences){
  plain+=source.slice(cursor,occurrence.start)
  const blocked=occurrence.url.length>2000||unsafeUrl(occurrence.url)
  plain+=blocked?(occurrence.label?occurrence.label+'（链接已隐藏）':'[链接已隐藏]'):(occurrence.label||occurrence.url)
  if(!blocked&&!seen.has(occurrence.url)&&links.length<8){seen.add(occurrence.url);const target=legacyUrlToNative(occurrence.url);links.push({id:links.length,url:occurrence.url,target,label:(target?'打开 · ':'复制链接 · ')+(occurrence.label||occurrence.url.match(/^https?:\/\/([^/]+)/)?.[1]||'参考资料')})}
  cursor=occurrence.end
 }
 plain+=source.slice(cursor)
 plain=plain
  .replace(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g,(_match,inline,display)=>inline??display)
  .replace(/\$\$([\s\S]*?)\$\$/g,(_match,display)=>display)
  .replace(/\$([^$\n]+)\$/g,(full,inline)=>dollarMath(inline)?inline:full)
 const budget={remaining:MAX_INLINE_NODES,truncated:false}
 function inline(value,display=false){return value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).flatMap(part=>{
  const strong=part.startsWith('**'),content=strong?part.slice(2,-2):part,mathematical=display||/\\[A-Za-z]+|[A-Za-z0-9)]\^(?:\{|[-+A-Za-z0-9])|[A-Za-z0-9)]_(?:\{|[-+]?\d)/.test(content),formatted=mathematical?formatMathSource(content):content
  if(strong){if(budget.remaining<=0){budget.truncated=true;return[]}budget.remaining--;return{name:'strong',children:mathNodes(formatted,0,mathematical,budget)}}
  return mathNodes(formatted,0,mathematical,budget)
 })}
 const allBlocks=plain.split(/\n\s*\n/).filter(Boolean),nodes=allBlocks.slice(0,MAX_BLOCKS).map(block=>{
  const heading=block.match(/^#{1,3}\s+([\s\S]*)/),content=heading?heading[1]:block,formula=!heading&&formulaBlock(content)
  return {name:heading?'h3':'p',attrs:{style:heading?'font-size:18px;line-height:1.6;margin:12px 0;':formula?'font-family:Cambria Math,Times New Roman,serif;font-size:17px;line-height:1.7;margin:12px 0;padding:10px 12px;background:#f7f5ff;border-left:3px solid #7357e8;border-radius:8px;overflow-wrap:anywhere;':'line-height:1.75;white-space:pre-wrap;margin:10px 0;'},children:inline(content,formula)}
 })
 if(original.length>MAX_SOURCE||allBlocks.length>MAX_BLOCKS||budget.truncated)nodes.push({name:'p',attrs:{style:'line-height:1.6;margin:12px 0;color:#865f1e;'},children:[{type:'text',text:'回答较长，当前页面仅显示前面的主要内容。'}]})
 return {nodes,links}
}
module.exports={answerContent}
