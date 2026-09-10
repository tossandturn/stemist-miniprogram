const assert=require('node:assert/strict')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
async function main(){
 const results=[]
 try{
  for(const category of ['alevel','competition']){
   await call('automation_navigate',{action:'reLaunch',url:'/pages/papers/index?category='+category+(category==='alevel'?'&subject=9702&stage=as&routeId=cie-9702-as-physics':'')})
   const data=await until(function(){const p=getCurrentPages().slice(-1)[0];if(p?.route!=='pages/papers/index'||p.data.loading)return null;return {category:p.data.category,total:p.data.totalQuestionPapers,rows:p.data.items.length,error:p.data.error,components:p.data.componentOptions.length,seasons:p.data.seasonOptions.length}},'paper catalog',20000)
   assert.equal(data.error,'');assert.ok(data.rows>0);assert.ok(data.rows<=50)
   if(category==='alevel'){assert.ok(data.components>1);assert.ok(data.seasons>1)}
   results.push(data)
  }
  for(const module of ['listening','reading','writing','speaking']){
   await call('automation_navigate',{action:'reLaunch',url:'/pages/ielts/library?module='+module})
   const data=await until(function(){const p=getCurrentPages().slice(-1)[0];if(p?.route!=='pages/ielts/library'||p.data.loading)return null;return {module:p.data.module,total:p.data.total,rows:p.data.items.length,topics:p.data.topicItems.length,iconCount:p.data.topicItems.filter(t=>t.icon).length,error:p.data.error}},'IELTS library',20000)
   assert.equal(data.error,'');assert.ok(data.rows>0||data.topics>0)
   if(module==='speaking')assert.equal(data.iconCount,data.topics)
   results.push(data)
  }
  await call('automation_navigate',{action:'reLaunch',url:'/pages/coach/index?source=speaking&category=ielts'})
  assert.equal(await evaluate(function(){return getCurrentPages().slice(-1)[0].data.contextId}),'ielts')
  await call('automation_page_action',{action:'querySelector',selector:'.coach-media-primary'})
  console.log(JSON.stringify({status:'pass',results,coachImageEntry:true,scope:'real native catalog reads and routes; no marking or microphone capture'}))
 }finally{await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'})}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
