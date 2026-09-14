const {requestJson}=require('./api')
const LABELS=['A','B','C','D'],cache=new Map()
function normalizeQuestionFocus(value,paperId,sourceQuestionId,images){
 if(!value)return []
 const fail=()=>{throw Error('题图定位与原卷题号不一致，请重新加载。')}
 if(value.schemaVersion!=='native-question-focus-v1'||value.paperId!==paperId||value.sourceQuestionId!==sourceQuestionId||!Array.isArray(value.pages)||!value.pages.length||value.pages.length>20)fail()
 const pages=value.pages.map(p=>{
  const match=String(p.url||'').match(/^\/question-assets\/([A-Za-z0-9_-]+)\/qp-(\d+)\.(?:jpg|jpeg|png|webp)$/),r=p.region,s=p.imageSize
  if(!match||match[1]!==paperId||Number(match[2])!==p.page||!Number.isInteger(p.page)||p.page<1||!images.includes(p.url)||!Array.isArray(r)||r.length!==4||!r.every(Number.isFinite)||r[0]<0||r[1]<0||r[2]>1||r[3]>1||r[0]>=r[2]||r[1]>=r[3]||!Array.isArray(s)||s.length!==2||!s.every(n=>Number.isInteger(n)&&n>0&&n<=10000)||s[0]*s[1]>24000000)fail()
  return {url:p.url,page:p.page,region:r.slice(),imageSize:s.slice()}
 })
 if(new Set(pages.map(p=>p.url)).size!==images.length)fail()
 return images.map(url=>pages.find(p=>p.url===url))
}
function choiceOptions(values){
 if(values===undefined||values===null)return LABELS.map(label=>({label,text:''}))
 if(!Array.isArray(values)||values.length!==4)throw Error('选择题选项未完整对应 A–D。')
 return values.map((value,index)=>{
  const label=LABELS[index],raw=typeof value==='string'?value:String(value?.text||'')
  if(typeof value!=='string'&&value?.label!==label)throw Error('选择题选项顺序与原卷不一致。')
  const prefix=typeof value==='string'?raw.match(/^([A-D])(?:[.、:)\s]+|$)/):null
  if(prefix&&prefix[1]!==label)throw Error('选择题选项顺序与原卷不一致。')
  return {label,text:prefix?raw.slice(prefix[0].length).trim():raw}
 })
}
async function questionDisplay(session,q){
 const key=[session.routeId,session.stage,q.paperId].join('|');let entry=cache.get(key)
 if(!entry||entry.until<Date.now()){
  const promise=requestJson('/api/stem/papers/'+encodeURIComponent(q.paperId)+'/source-context?routeId='+encodeURIComponent(session.routeId)+'&stage='+encodeURIComponent(session.stage),undefined,{method:'GET',timeout:12000,stemAuth:false}).catch(error=>{cache.delete(key);throw error})
  entry={promise,until:Date.now()+60000};cache.set(key,entry);while(cache.size>2)cache.delete(cache.keys().next().value)
 }
 const value=await entry.promise
 if(value.schemaVersion!=='native-paper-sources-v1'||value.paperId!==q.paperId||value.routeId!==session.routeId||value.stage!==session.stage)throw Error('原卷题目对应关系未确认。')
 const item=value.questions?.find(item=>item.sourceQuestionId===q.id)
 if(!item||item.sourceQuestionId!==q.paperId+':q'+item.number)return null
 return {regions:normalizeQuestionFocus(item.questionFocus,q.paperId,q.id,q.images),options:item.choiceOptions?choiceOptions(item.choiceOptions):null}
}
module.exports={normalizeQuestionFocus,choiceOptions,questionDisplay}
