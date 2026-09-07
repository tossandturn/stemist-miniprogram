const ICONS=new Set(['work','travel','psychology','environment','culture','food','transport','history','society','education','architecture','science','health','business'])
const topicIcon=key=>'/design-system/topic-icons/'+(ICONS.has(key)?key:'education')+'.svg'
function topicDirectory(tasks,{book=0,query=''}={}){
 const groups=new Map(),search=String(query||'').trim().toLowerCase()
 for(const task of tasks||[]){
  if(book&&task.book!==Number(book))continue
  for(const section of task.sections||[]){
   if(!section.topicKey||!section.topicLabel)continue
   if(search&&![task.title,task.source,section.title,section.topicLabel].join(' ').toLowerCase().includes(search))continue
   const item=groups.get(section.topicKey)||{key:section.topicKey,label:section.topicLabel,icon:topicIcon(section.topicKey),count:0}
   item.count++;groups.set(section.topicKey,item)
  }
 }
 return [...groups.values()].sort((a,b)=>a.label.localeCompare(b.label))
}
module.exports={topicDirectory,topicIcon}
