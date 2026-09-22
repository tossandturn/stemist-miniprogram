const assert=require('node:assert/strict')
const {call,evaluate}=require('./helpers/wechat-cli.cjs')
async function main(){
 const report=await evaluate(function(){
  const p=getCurrentPages().slice(-1)[0]
  if(p.route!=='bundles/marking/index')throw Error('Open marking page first')
  p.pause();p.__visible=false
  // Only in-memory fixture data; never write account storage or submit files.
  p.setData({authenticated:true})
  p.setJob({jobId:'qa-visual-report-001',status:'completed',result:{
   assessmentMode:'ai-provisional',officialScore:false,provisionalScore:36,maxScore:50,reviewRequired:true,
   summary:'你已掌握主要解题方法。第 2 题需要补充单位，第 4 题的图像较模糊，需要人工复核。',
   questionResults:[{questionLabel:'1(a)',provisionalScore:4,maxScore:5,rationale:'方法正确。请补充完整推导：$x^2=16$。',reviewRequired:false,evidence:['作答第 1 页'],criteria:[{label:'推导',comment:'请补充中间步骤'}]},{questionLabel:'2',provisionalScore:2,maxScore:4,rationale:'数值正确，但缺少单位。请检查有效数字。',reviewRequired:true}],
  }})
  return{scoreReady:p.data.result.scoreReady,questions:p.data.questions.length}
 })
 assert.equal(report.scoreReady,true);assert.equal(report.questions,2)
 const geometry=await evaluate(function(){return new Promise(resolve=>{
  wx.createSelectorQuery().select('.marking-output').boundingClientRect().select('.marking-page').boundingClientRect().exec(r=>{
   wx.pageScrollTo({scrollTop:r[0].top,duration:0,success:()=>resolve({viewport:wx.getSystemInfoSync().windowWidth,pageWidth:r[1].width})})
  })
 })})
 assert.ok(geometry.pageWidth<=geometry.viewport+1,'No horizontal page overflow')
 console.log(JSON.stringify({fixture:'synthetic-completed-report',geometry,screenshot:await call('simulator_screenshot',{path:'D:/CodexWork/whole-paper-report-phone.png',optimize:false,wait:1})}))
 await call('automation_navigate',{action:'navigateBack'})
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
