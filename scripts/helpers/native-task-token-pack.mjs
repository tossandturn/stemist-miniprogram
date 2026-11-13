// Build-only lossless encoding for the reviewed public offline task snapshot.
// No tasks, source strings, resource URLs or runtime business logic are removed.
export function packNativeTaskData(source) {
  const match=source.match(/^\/\/ Generated public task data; no answer keys or student data\.\r?\nmodule\.exports=(\{[\s\S]*\})\s*$/)
  if(!match)throw new Error('Task packing accepts only the generated JSON module')
  const data=JSON.parse(match[1])
  if(data.schemaVersion!=='stemist-native-task-pack-v3')throw new Error('Unsupported task schema')
  const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-'
  const counts=new Map(),words=/[A-Za-z][A-Za-z0-9_-]{3,}/g
  function collect(value){
    if(typeof value==='string')for(const word of value.match(words)||[])counts.set(word,(counts.get(word)||0)+1)
    else if(value&&typeof value==='object')Object.values(value).forEach(collect)
  }
  collect(data)
  const dictionary=[...counts].map(([word,count])=>({word,gain:(Buffer.byteLength(word)-3)*count-Buffer.byteLength(word)-3}))
    .filter(item=>item.gain>0).sort((a,b)=>b.gain-a.gain||(a.word<b.word?-1:a.word>b.word?1:0)).slice(0,alphabet.length**2).map(item=>item.word)
  const tokens=new Map(dictionary.map((word,index)=>[word,'~'+alphabet[Math.floor(index/alphabet.length)]+alphabet[index%alphabet.length]]))
  function encode(value){
    if(typeof value==='string')return value.replace(/~/g,'~~').replace(words,word=>tokens.get(word)||word)
    if(Array.isArray(value))return value.map(encode)
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,encode(child)]))
    return value
  }
  // Expand before export. The existing task decoder still receives the exact
  // same plain data schema; no asynchronous work, downloads or shared nodes.
  return `const taskWords=${JSON.stringify(dictionary)},taskAlphabet=${JSON.stringify(alphabet)};function restoreTaskString(text){let output='';for(let index=0;index<text.length;){if(text[index]!=='~'){output+=text[index++];continue}if(text[index+1]==='~'){output+='~';index+=2;continue}const token=taskAlphabet.indexOf(text[index+1])*taskAlphabet.length+taskAlphabet.indexOf(text[index+2]);output+=taskWords[token];index+=3}return output}function restoreTaskText(value){if(typeof value==='string')return restoreTaskString(value);if(value&&typeof value==='object')for(const key of Object.keys(value))value[key]=restoreTaskText(value[key]);return value}module.exports=restoreTaskText(${JSON.stringify(encode(data))});\n`
}
