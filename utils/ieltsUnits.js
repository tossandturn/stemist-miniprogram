function libraryUnits(tasks,scope='paper',topic=''){
 if(scope==='paper')return tasks
 if(scope==='topic'&&tasks.some(task=>['writing','speaking'].includes(task.module)))return require('./ieltsTopics').taskTopicUnits(tasks).filter(task=>!topic||task.topicKey===topic)
 return tasks.flatMap(task=>(task.sections||[]).filter(section=>scope!=='topic'||section.topicKey&&(!topic||section.topicKey===topic)).map(section=>({
  ...task,id:task.id+'::section::'+section.number,baseTaskId:task.id,section:section.number,
  title:scope==='topic'?(section.title||section.topicLabel||section.label):task.title+' · '+section.label,
  topicKey:section.topicKey,topicLabel:section.topicLabel,minutes:section.minutes,questionCount:section.questionCount,questions:[]
 })))
}

function sectionTask(task,number){
 if(!number)return task
 const section=(task.sections||[]).find(section=>section.number===number)
 const ids=new Set(section?.questionIds||[])
 if(!section||!ids.size||ids.size!==section.questionCount||[...ids].some(id=>!task.questions.some(q=>q.id===id)))throw new Error('这份试题的分段资料尚未完整，请选择整套练习。')
 const questions=task.questions.filter(q=>ids.has(q.id))
 let imageFilter=()=>true
 if(task.module==='reading'){
  const start=Number(task.passageStarts?.[number]),end=Number(task.passageStarts?.[number+1])||Infinity
  if(start>0)imageFilter=image=>image.page>=start&&image.page<end
 }else{
  const pages=questions.map(q=>q.page).filter(Boolean),end=(task.questions.find(q=>q.number>questions[questions.length-1].number)||{}).page
  if(pages.length===questions.length){const first=Math.min(...pages),last=Math.max(...pages);imageFilter=image=>image.page>=first&&(end>last?image.page<end:image.page<=last)}
 }
 const audio=task.audioSections?.find(track=>track.section===number)
 return {...task,questions,questionCount:questions.length,unitKey:task.id+'::section::'+number,section:number,
  title:task.title+' · '+section.label,minutes:section.minutes,
  questionImages:task.questionImages.filter(imageFilter),passageImages:task.passageImages.filter(imageFilter),images:task.images.filter(imageFilter),
  audioUrls:audio?[audio.url]:task.audioUrls,audioSections:audio?[audio]:task.audioSections}
}
module.exports={libraryUnits,sectionTask}
