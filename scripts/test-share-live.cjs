const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const at=process.argv.indexOf('--output'),output=at>=0?process.argv[at+1]:''
if(!output)throw Error('Use --output <QA directory>')
async function main(){
 const current=await call('automation_runtime_info',{action:'currentPage'});assert.equal(current.currentPage?.path,'pages/index/index','Do not interrupt a learning session')
 fs.mkdirSync(output,{recursive:true});const results=[]
 try{
  await evaluate(function(){getApp().__shareMenuQA='pending';wx.showShareMenu({menus:['shareAppMessage'],success:()=>getApp().__shareMenuQA='enabled',fail:()=>getApp().__shareMenuQA='failed'});return true})
  assert.equal(await until(function(){const state=getApp().__shareMenuQA;return state!=='pending'?state:null},'native share menu'), 'enabled')
  const cases=[['/pages/index/index','/pages/index/index'],['/pages/calculator/index','/pages/calculator/index'],['/pages/ielts/library?module=speaking','/pages/ielts/library?module=speaking'],['/pages/stem/topics?routeId=cie-9702-as-physics','/pages/stem/topics?routeId=cie-9702-as-physics']]
  for(const [url,expected] of cases){
   if(url!=='/pages/index/index')await call('automation_navigate',{action:'navigateTo',url})
   const result=await evaluate(function(){return getCurrentPages().slice(-1)[0].onShareAppMessage({from:'menu'})})
   assert.equal(result.path,expected);assert.equal(result.imageUrl,'/design-system/share-card.png');results.push(result)
  }
  await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'})
  await call('simulator_screenshot',{path:path.join(output,'home-share.png'),optimize:false})
  console.log(JSON.stringify({status:'pass',nativeMenu:'enabled',results,messagesSent:0,contactsSelected:0}))
 }finally{await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'});await evaluate(function(){delete getApp().__shareMenuQA;return true})}
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
