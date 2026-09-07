const INDEX=require('./ieltsTopicIndex')
const ICONS=new Set(['work','travel','psychology','environment','culture','food','transport','history','society','education','architecture','science','health','business','technology','law','media'])
const topicIcon=key=>'/design-system/topic-icons/'+(ICONS.has(key)?key:'education')+'.svg'
function taskTopic(task){
 if(task.topicKey&&task.topicLabel)return {key:task.topicKey,label:task.topicLabel,icon:task.topicIcon||'education'}
 const metadata=task.catalogVersion===INDEX.version?INDEX.items[task.id]:null
 return metadata||{key:task.module+'-other',label:'其他话题',icon:'education'}
}
function taskTopicUnits(tasks){return (tasks||[]).filter(task=>task.module==='speaking'||task.module==='writing'&&(/task2$/i.test(task.id)||/^Task 2\b/i.test(task.type||''))).map(task=>{const topic=taskTopic(task);return {...task,topicKey:topic.key,topicLabel:topic.label,topicIcon:topic.icon}})}
function topicDirectory(tasks,{book=0,query=''}={}){
 const groups=new Map(),search=String(query||'').trim().toLowerCase()
 const add=(key,label,icon)=>{const item=groups.get(key)||{key,label,icon:topicIcon(icon||key),count:0};item.count++;groups.set(key,item)}
 if(tasks?.some(task=>['writing','speaking'].includes(task.module))){
  for(const task of taskTopicUnits(tasks)){if(book&&task.book!==Number(book))continue;if(search&&![task.title,task.source,task.topicLabel].join(' ').toLowerCase().includes(search))continue;add(task.topicKey,task.topicLabel,task.topicIcon)}
  return [...groups.values()].sort((a,b)=>a.label.localeCompare(b.label))
 }
 for(const task of tasks||[]){
  if(book&&task.book!==Number(book))continue
  for(const section of task.sections||[]){
   if(!section.topicKey||!section.topicLabel)continue
   if(search&&![task.title,task.source,section.title,section.topicLabel].join(' ').toLowerCase().includes(search))continue
   add(section.topicKey,section.topicLabel)
  }
 }
 return [...groups.values()].sort((a,b)=>a.label.localeCompare(b.label))
}
module.exports={topicDirectory,topicIcon,taskTopicUnits}
