// Isolated native UI geometry; staged display fixtures are not model-progress evidence.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs'),account=require('./helpers/native-qa-account.cjs')
const index=process.argv.indexOf('--output');if(index<0)throw Error('Pass --output <QA directory>')
const output=path.resolve(process.argv[index+1]);fs.mkdirSync(output,{recursive:true})
async function geometry(selector){
 const args=path.join(output,'selector-input.json');fs.writeFileSync(args,JSON.stringify([selector]),'utf8')
 await call('automation_evaluate',{'fn-source':function(selector){getApp().__progressGeometry=null;const p=getCurrentPages().at(-1),component=selector==='.coach-progress'?p.selectComponent('#coach-panel'):null;const q=component?wx.createSelectorQuery().in(component):wx.createSelectorQuery();q.select(selector).boundingClientRect(r=>{const w=wx.getWindowInfo();getApp().__progressGeometry=r?{...r,viewportWidth:w.windowWidth,viewportHeight:w.windowHeight}:null}).exec();return true}.toString(),'args-file':args})
 return until(function(){return getApp().__progressGeometry?.height>0?getApp().__progressGeometry:null},'visible native progress')
}
async function main(){
 const checks=[]
 try{
  await account.begin()
  await call('automation_navigate',{action:'reLaunch',url:'/pages/coach/index'})
  await until(function(){return getCurrentPages().at(-1)?.route==='pages/coach/index'},'Coach ready')
  for(const tablet of [false,true]){
   for(const phase of ['calling','analysis','arranging']){
    const progress={phase,active:true,label:{calling:'连接 AI 中',analysis:'分析中',arranging:'整理答案中'}[phase],elapsedLabel:'已等待 8 秒',etaLabel:'预计剩余约 5–15 秒',percentage:null}
    await call('automation_page_action',{action:'setData',patch:JSON.stringify({message:'',answer:'',imagePath:'',entryHasImage:false,loading:true,deviceClass:'device-'+(tablet?'tablet':'phone'),isTablet:tablet,orientation:'portrait',progress})})
    const rect=await geometry('.coach-progress')
    assert(rect.left>=0&&rect.right<=rect.viewportWidth+1)
    checks.push({view:'coach',phase,tabletClass:tablet,height:rect.height,width:rect.width})
    if(phase==='analysis')await call('simulator_screenshot',{path:path.join(output,'coach-progress-'+(tablet?'tablet':'phone')+'.png'),optimize:false})
   }
  }
  await call('automation_page_action',{action:'setData',patch:JSON.stringify({loading:false,progress:{}})})
  await call('automation_navigate',{action:'reLaunch',url:'/bundles/marking/index'})
  await until(function(){return getCurrentPages().at(-1)?.route==='bundles/marking/index'},'Marking ready')
  for(const tablet of [false,true]){
   const markingProgress={active:true,label:'分析作答中',elapsedLabel:'已等待 14 秒',etaLabel:'预计还需约 20 秒',preparing:false,pagePercent:null,pageLabel:''}
   await call('automation_page_action',{action:'setData',patch:JSON.stringify({authenticated:true,jobId:'qa-display-only',jobStatus:'processing',flowStep:2,actionVisible:false,jobStateHint:'完成后可查看逐题反馈和 PDF 报告。',markingProgress,result:null,deviceClass:'device-'+(tablet?'tablet':'phone'),isTablet:tablet,orientation:'portrait'})})
   const rect=await geometry('.marking-live-progress');assert(rect.width>44&&rect.right<=rect.viewportWidth+1)
   checks.push({view:'marking',tabletClass:tablet,height:rect.height,width:rect.width})
   await call('simulator_screenshot',{path:path.join(output,'marking-progress-'+(tablet?'tablet':'phone')+'.png'),optimize:false})
  }
  const result={status:'pass',nativeGeometry:true,checks,scope:'phone/tablet CSS classes at simulator viewport; synthetic UI fixtures only, not physical device or provider percent'}
  fs.writeFileSync(path.join(output,'progress-native-live.json'),JSON.stringify(result,null,2),'utf8');console.log(JSON.stringify(result))
 }finally{await evaluate(function(){const p=getCurrentPages().at(-1);p?.setData?.({loading:false,jobId:'',jobStatus:'',markingProgress:{}});delete getApp().__progressGeometry;return true}).catch(()=>{});await account.end()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
