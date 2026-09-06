const {requestIeltsJson}=require('./api')
const VERSION='v1-68e798a26bcb965d'
const ROOT='/data/native-vocabulary/'+VERSION
let index=null,pending=null
const chunks=new Map()
async function vocabularyIndex(){
 if(index)return index
 if(pending)return pending
 pending=requestIeltsJson(ROOT+'/index.json',undefined,{method:'GET',timeout:15000}).then(data=>{
  if(data?.schemaVersion!=='native-vocabulary-index-v1'||data.version!==VERSION||!Array.isArray(data.items))throw new Error('词汇目录未完整返回。')
  index=data.items.filter(item=>typeof item.id==='string'&&typeof item.word==='string'&&/^\d{4}\.json$/.test(item.chunk));return index
 }).finally(()=>{pending=null})
 return pending
}
async function vocabularyDetail(id){
 const list=await vocabularyIndex(),entry=list.find(item=>item.id===id)
 if(!entry)throw new Error('未找到这个词条。')
 if(!chunks.has(entry.chunk)){
  const data=await requestIeltsJson(ROOT+'/'+entry.chunk,undefined,{method:'GET',timeout:15000})
  if(data?.schemaVersion!=='native-vocabulary-chunk-v1'||!Array.isArray(data.items))throw new Error('词条未完整返回。')
  chunks.set(entry.chunk,data.items)
  while(chunks.size>2)chunks.delete(chunks.keys().next().value)
 }
 const detail=chunks.get(entry.chunk).find(item=>item.id===id)
 if(!detail)throw new Error('词条与目录不一致，请重试。')
 return detail
}
module.exports={VERSION,ROOT,vocabularyIndex,vocabularyDetail}
