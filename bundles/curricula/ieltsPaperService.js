const {getJson}=require('../../utils/api')
const ORIGIN='https://stem.ieltsist.com',PREFIX='/api/stem/ielts-papers/files/'
const MODULES={listening:'听力',reading:'阅读',writing:'写作',speaking:'口语'}
function parseCatalogue(value){
 if(value?.schemaVersion!=='ielts-paper-downloads-v1'||!/^[a-f0-9]{24}$/.test(value.version||'')||!Array.isArray(value.items)||value.items.length>2000)throw Error('剑雅目录返回异常，请刷新重试。')
 const seen=new Set(),groups=new Map()
 for(const item of value.items){
  if(!/^ielts-cam[0-9]+-[a-z0-9-]+-(qp|ak)$/.test(item.id)||seen.has(item.id)||!MODULES[item.module]||!['qp','ak'].includes(item.kind)||item.url!==PREFIX+item.id||!/^[a-f0-9]{64}$/.test(item.sha256)||!Number.isSafeInteger(item.bytes)||item.bytes<5||item.bytes>33554432||!/^Cambridge_IELTS_[A-Za-z0-9_-]+\.pdf$/.test(item.fileName))throw Error('剑雅文件信息不完整，请刷新重试。')
  seen.add(item.id)
  let group=groups.get(item.sourceId)
  if(!group){group={id:item.sourceId,book:item.book,module:item.module,test:item.test,task:item.task,title:item.title,answerStatus:item.answerStatus,meta:MODULES[item.module]+(item.test?' · Test '+item.test:'')+(item.practiceTest&&item.practiceTest!==item.test?'（站内第 '+item.practiceTest+' 套）':'')+(item.task?' · Task '+item.task:'')};groups.set(item.sourceId,group)}
  if(group.book!==item.book||group.module!==item.module||group.test!==item.test||group[item.kind])throw Error('剑雅题目与答案关联异常。')
  group[item.kind]={...item,url:ORIGIN+item.url}
 }
 return{version:value.version,items:[...groups.values()].filter(g=>g.qp).sort((a,b)=>b.book-a.book||a.test-b.test||a.id.localeCompare(b.id)),books:[...new Set([...groups.values()].map(g=>g.book))].sort((a,b)=>b-a)}
}
async function fetchCatalogue(){return parseCatalogue(await getJson('/api/stem/ielts-papers',{stemAuth:false,timeout:15000}))}
module.exports={fetchCatalogue,parseCatalogue,MODULES}
