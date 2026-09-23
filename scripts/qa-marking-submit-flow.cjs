const assert=require('node:assert/strict')
const {call,evaluate}=require('./helpers/wechat-cli.cjs')
const directory='D:/CodexWork/stemist-release-coordination'
async function main(){
 console.log('UI fixture: initialize')
 const initialized=await evaluate(function(){
  const p=getCurrentPages().slice(-1)[0]
  if(p.route!=='bundles/marking/index')throw Error('Open whole-paper marking first')
  if(p.data.busy||p.data.picking||p.data.jobId||p.__draft.files.length)throw Error('Do not replace an active or selected user draft')
  p.__uxOriginal={data:JSON.parse(JSON.stringify(p.data)),draft:p.__draft,job:p.__job,questions:p.__questions,visible:p.__visible}
  p.pause();p.__visible=false;p.__refresh=(p.__refresh||0)+1
  p.__draft={...p.__draft,files:[]};p.__job=null;p.__questions=[]
  p.setData({history:[],selectionError:'',selectionCode:'',error:'',status:'',privacy:false})
  p.renderFiles()
  return {fixture:true}
 })
 assert.equal(initialized.fixture,true)
 const results=[]
 try{
  for(const mode of ['empty','selected','queued','processing','completed']){
   console.log('UI fixture: '+mode)
   const data=await evaluate(`function(){
    const p=getCurrentPages().slice(-1)[0],mode=${JSON.stringify(mode)}
    if(mode==='selected'){
     p.__draft.files=[{id:'qa-answer-pdf',role:'answer',kind:'pdf',mediaType:'application/pdf',path:'/qa/synthetic.pdf',name:'测试作答.pdf',size:18000}]
     p.renderFiles()
    }
    if(['queued','processing','completed'].includes(mode)){
     p.__draft.files=p.__draft.files.map(file=>({...file,uploaded:true}));p.renderFiles()
     const job={jobId:'qa-visual-marking-001',title:'界面测试：整卷批改',status:mode,progress:mode==='processing'?{completedPages:1,totalPages:2}:undefined}
     if(mode==='completed')Object.assign(job,{sourcePdfPath:'/qa/source.pdf',reportPdfPath:'/qa/report.pdf',result:{assessmentMode:'ai-advisory-unscored',officialScore:false,provisionalScore:null,maxScore:null,reviewRequired:true,summary:'已完成逐题反馈；未提供评分标准，不显示总分。',questionResults:[{questionLabel:'1(a)',rationale:'请补充单位。',reviewRequired:true}]}})
     p.__draft.jobId=job.jobId;p.setJob(job)
    }
    wx.pageScrollTo({scrollTop:0,duration:0})
    return {jobStatus:p.data.jobStatus,answers:p.data.answers.length,flowStep:p.data.flowStep}
   }`)
   const geometry=await evaluate(function(){return new Promise(resolve=>{
    wx.createSelectorQuery().select('#marking-submit-primary').boundingClientRect().select('#marking-primary-action').boundingClientRect().select('#marking-job-state').boundingClientRect().select('.marking-page').boundingClientRect().exec(items=>{
     const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync()
     resolve({button:items[0],action:items[1],job:items[2],page:items[3],width:info.windowWidth,height:info.windowHeight})
    })
   })})
   assert.ok(geometry.page.width<=geometry.width+1,'No horizontal overflow')
   if(['empty','selected'].includes(mode)){
    assert.ok(geometry.button,'Submit action remains present even before selecting a file')
    assert.ok(geometry.button.top>=0&&geometry.button.bottom<=geometry.height,'Submit action visible in the phone viewport')
   }else{
    assert.equal(data.jobStatus,mode)
    assert.ok(geometry.job,'Current job status remains available')
    assert.ok(geometry.job.top>=0&&geometry.job.bottom<=geometry.height-80,'Current job status must be visible above phone navigation without scrolling')
   }
   const screenshot=await call('simulator_screenshot',{path:`${directory}/marking-${mode}-20260924.png`,optimize:false,wait:1})
   results.push({mode,data,geometry,screenshot})
  }
  console.log(JSON.stringify({fixture:'synthetic UI only; no files submitted or account storage changed',results}))
 }finally{
  await evaluate(function(){const p=getCurrentPages().slice(-1)[0],old=p.__uxOriginal;if(!old)return;p.pause();p.__draft=old.draft;p.__job=old.job;p.__questions=old.questions;p.__visible=old.visible;p.setData(old.data);delete p.__uxOriginal})
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
