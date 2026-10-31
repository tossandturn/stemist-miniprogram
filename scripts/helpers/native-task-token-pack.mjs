// Build-only lossless encoding for the reviewed public offline task snapshot.
// No tasks, source strings, resource URLs or runtime business logic are removed.
export function packNativeTaskData(source) {
  const match=source.match(/^\/\/ Generated public task data; no answer keys or student data\.\r?\nmodule\.exports=(\{[\s\S]*\})\s*$/)
  if(!match)throw new Error('Task packing accepts only the generated JSON module')
  const data=JSON.parse(match[1])
  if(data.schemaVersion!=='stemist-native-task-pack-v3'||/[\uE000-\uE03F]/.test(JSON.stringify(data)))throw new Error('Unsupported task schema or reserved token collision')
  const counts=new Map(),words=/[A-Za-z][A-Za-z0-9_-]{9,}/g
  function collect(value){
    if(typeof value==='string')for(const word of value.match(words)||[])counts.set(word,(counts.get(word)||0)+1)
    else if(value&&typeof value==='object')Object.values(value).forEach(collect)
  }
  collect(data)
  const dictionary=[...counts].map(([word,count])=>({word,gain:(Buffer.byteLength(word)-3)*count-Buffer.byteLength(word)-3}))
    .filter(item=>item.gain>100).sort((a,b)=>b.gain-a.gain||(a.word<b.word?-1:a.word>b.word?1:0)).slice(0,64).map(item=>item.word)
  const tokens=new Map(dictionary.map((word,index)=>[word,String.fromCharCode(0xE000+index)]))
  function encode(value){
    if(typeof value==='string')return value.replace(words,word=>tokens.get(word)||word)
    if(Array.isArray(value))return value.map(encode)
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,encode(child)]))
    return value
  }
  // Expand before export. The existing task decoder still receives the exact
  // same plain data schema; no asynchronous work, downloads or shared nodes.
  return `const taskWords=${JSON.stringify(dictionary)};function restoreTaskText(value){if(typeof value==='string')return value.replace(/[\\uE000-\\uE03F]/g,char=>taskWords[char.charCodeAt(0)-57344]);if(value&&typeof value==='object')for(const key of Object.keys(value))value[key]=restoreTaskText(value[key]);return value}module.exports=restoreTaskText(${JSON.stringify(encode(data))});\n`
}
