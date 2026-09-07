const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const output='D:/CodexWork/qa-artifacts/native-materials-runtime-20260907'
fs.mkdirSync(output,{recursive:true})
const tap=selector=>call('automation_element_action',{action:'tap',selector,'wait-for-selector':selector})
const navigate=url=>call('automation_navigate',{action:'reLaunch',url})
const shot=name=>call('simulator_screenshot',{path:path.join(output,name+'.png'),optimize:false})
const results=[]
const pass=(check,details={})=>{const result={check,status:'pass',...details};results.push(result);console.log(JSON.stringify(result))}
async function ready(route=''){return until('function(){const p=getCurrentPages().slice(-1)[0];if(!p||p.data.loading||('+JSON.stringify(route)+'&&p.route!=='+JSON.stringify(route)+'))return false;return {route:p.route,error:p.data.error||"",items:p.data.items?.length,total:p.data.total??p.data.matchCount,stage:p.data.stage,routeId:p.data.routeId,page:p.data.pageNumber,images:p.data.sourceImages?.length}}','native page loaded '+route)}
async function run(){let backedUp=false;try{
 if(await evaluate(function(){return getCurrentPages().slice(-1)[0]?.route})!=='pages/index/index')await navigate('/pages/index/index')
 await evaluate(function(){const app=getApp();if(app.__materialsQA)throw Error('Materials QA is already active');const keys=wx.getStorageInfoSync().keys.filter(k=>k.startsWith('stemistIeltsObjective:')||k.startsWith('stemistNativePaper:'));app.__materialsQA=keys.map(key=>({key,value:wx.getStorageSync(key)}));return true});backedUp=true
 await navigate('/pages/ielts/library?module=reading');assert.equal((await ready()).error,'')
 await tap('[data-scope="topic"]')
 const topics=await until(function(){const p=getCurrentPages().slice(-1)[0];return p.data.scope==='topic'&&p.data.topics.length?{count:p.data.topics.length,items:p.data.items.length}:false},'topic categories')
 assert.ok(topics.count>8);assert.equal(topics.items,0);await shot('ielts-topic-icons')
 const geometry=await evaluate(function(){return new Promise(resolve=>wx.createSelectorQuery().selectAll('.native-topic-card').boundingClientRect().selectAll('.topic-icon-image').boundingClientRect().exec(rows=>resolve({cards:rows[0],icons:rows[1],window:wx.getWindowInfo()})))})
 assert.ok(geometry.cards.every(r=>r.width>=44&&r.height>=44&&r.left>=0&&r.right<=geometry.window.windowWidth+1));assert.equal(geometry.icons.length,topics.count)
 pass('Reading semantic topic directory and phone geometry',{topics:topics.count,width:geometry.window.windowWidth})
 await tap('[data-key="science"]');const topic=await ready();assert.ok(topic.items>0&&topic.items<=20);await shot('ielts-science-passages')
 await tap('.native-task-card');const task=await ready('pages/ielts/reading');assert.equal(task.error,'');assert.ok(task.images>0);await shot('ielts-source-image');pass('Topic card opens the source-bound Reading passage',{images:task.images})
 if(!process.argv.includes('--ielts-only')){
  await navigate('/pages/papers/index?subject=9709&stage=A2&routeId=cie-9709-a2-after-p1-p5-p3-p6');const maths=await ready();assert.equal(maths.error,'');assert.equal(maths.stage,'a2');assert.equal(maths.routeId,'cie-9709-a2-after-p1-p5-p3-p6');assert.equal(maths.items,30);await shot('maths-a2-catalog');pass('A2 mathematical route retained with one 30-row page',maths)
  await evaluate(function(){return new Promise(resolve=>wx.pageScrollTo({selector:'.paper-pagination',duration:0,success:resolve,fail:resolve}))});await tap('.paper-next');await until(function(){const d=getCurrentPages().slice(-1)[0].data;return !d.loading&&d.pageNumber===2},'second catalog page');const second=await ready();assert.equal(second.page,2);assert.ok(second.items<=30);pass('Actual next-page action loads a bounded second page',{page:second.page,items:second.items})
  await navigate('/pages/papers/index?category=competition&subject=amc12');const competition=await ready();assert.equal(competition.error,'');assert.ok(competition.items>0&&competition.items<=30);await shot('competition-catalog');pass('Competition uses its existing original-paper catalog',{items:competition.items,total:competition.total})
  await navigate('/pages/stem/paper?subject=9702&stage=AS&routeId=cie-9702-as-physics&paperId=cie-9702-9702_m25_qp_22')
  const paper=await ready('pages/stem/paper');assert.equal(paper.error,'');await until(function(){const d=getCurrentPages().slice(-1)[0].data;return d.sourceImages?.length>0},'bound original question image');await evaluate(function(){return new Promise(resolve=>wx.pageScrollTo({selector:'.paper-source-image',offsetTop:-90,duration:0,success:resolve,fail:resolve}))});await until(function(){const d=getCurrentPages().slice(-1)[0].data;return d.sourceLoadedCount>0},'original image decoded');const clear=await evaluate(function(){return new Promise(resolve=>wx.createSelectorQuery().select('.paper-sticky-head').boundingClientRect().select('.paper-source-image').boundingClientRect().exec(r=>resolve({headerBottom:r[0]?.bottom,imageTop:r[1]?.top}))) });assert.ok(clear.headerBottom<=clear.imageTop+1,'Coach/header must not overlay the source image');await shot('stem-bound-question');pass('Existing Physics original is mapped, decoded and clear of the fixed Coach/header')
 }
 fs.writeFileSync(path.join(output,process.argv.includes('--ielts-only')?'ielts-acceptance.json':'acceptance.json'),JSON.stringify({surface:'official WeChat phone simulator',results},null,2)+'\n','utf8')
}finally{if(backedUp){await navigate('/pages/index/index');await evaluate(function(){const app=getApp(),saved=app.__materialsQA||[],kept=new Set(saved.map(s=>s.key));for(const key of wx.getStorageInfoSync().keys)if((key.startsWith('stemistIeltsObjective:')||key.startsWith('stemistNativePaper:'))&&!kept.has(key))wx.removeStorageSync(key);for(const item of saved)wx.setStorageSync(item.key,item.value);delete app.__materialsQA;return {restored:true}})}}}
run().catch(e=>{console.error(e.message);process.exitCode=1})
