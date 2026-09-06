const {legacyUrlToNative}=require('./nativeNavigation')
function answerContent(value){
 const source=String(value||'').slice(0,80000),links=[],seen=new Set()
 const pattern=/\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()[\]]+)/g
 for(const match of source.matchAll(pattern)){
  if(links.length>=8)break
  const url=String(match[2]||match[3]||'').replace(/[.,;。；]+$/,'')
  if(seen.has(url)||url.length>2000||/^https?:\/\/[^/]*@/i.test(url)||/[?&](?:access_token|session_key|api_key|token)=/i.test(url))continue
  seen.add(url);const target=legacyUrlToNative(url)
  links.push({id:links.length,url,target,label:(target?'打开 · ':'复制链接 · ')+(match[1]||url.match(/^https?:\/\/([^/]+)/)?.[1]||'参考资料')})
 }
 const plain=source.replace(/\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+)\)/g,(full,label,url)=>seen.has(url)?label:full)
 function inline(text){return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(part=>part.startsWith('**')?{name:'strong',children:[{type:'text',text:part.slice(2,-2)}]}:{type:'text',text:part})}
 const nodes=plain.split(/\n\s*\n/).filter(Boolean).map(block=>{const heading=block.match(/^#{1,3}\s+([\s\S]*)/);return {name:heading?'h3':'p',attrs:{style:heading?'font-size:18px;line-height:1.6;margin:12px 0;':'line-height:1.75;white-space:pre-wrap;margin:10px 0;'},children:inline(heading?heading[1]:block)}})
 return {nodes,links}
}
module.exports={answerContent}
