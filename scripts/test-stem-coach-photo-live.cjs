// Real STEM photo Coach, synthetic pixels only; auth stays in the native app.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs'),account=require('./helpers/native-qa-account.cjs')
if(!process.argv.includes('--run-production'))throw Error('Explicit --run-production required: one real vision request')
const index=process.argv.indexOf('--output'),out=index>=0?path.resolve(process.argv[index+1]):null
const r=createRequire('D:/CodexWork/stem-profile-apib-candidate/package.json'),{createCanvas}=r('@napi-rs/canvas')
async function main(){
 const canvas=createCanvas(600,400),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,600,400);ctx.fillStyle='black';ctx.font='34px sans-serif';ctx.fillText('Solve the equation:',35,100);ctx.fillText('2x + 3 = 11',35,185)
 const picture='data:image/jpeg;base64,'+canvas.toBuffer('image/jpeg').toString('base64')
 try{
  await evaluate(function(){return new Promise((resolve,reject)=>wx.reLaunch({url:'/pages/index/index',success:()=>resolve(true),fail:()=>reject(Error('Native Home unavailable'))}))})
  await account.begin()
  if(out)fs.mkdirSync(path.dirname(out),{recursive:true})
  const args=path.join(out?path.dirname(out):'D:/CodexWork/stemist-release-coordination/release-1.0.29-20261003','synthetic-photo-input.json')
  fs.writeFileSync(args,JSON.stringify([picture]),'utf8')
  await call('automation_evaluate',{'args-file':args,'fn-source':function(image){
   const app=getApp();if(String(wx.getStorageSync('stemistUser')?.id)!==app.__nativeQa?.id)throw Error('Synthetic account changed')
   const q=app.__stemPhotoQa={status:'pending',started:Date.now()}
   require('utils/coach.js').runCoach({message:'请仅根据图片里清晰可见的题目说明方法并给出答案；如果看不清请明确说明。',context:{product:'STEM Studio',skill:'stem-photo',stage:'AS',subjectCode:'9709',routeId:'cie-9709-as-p1-p2',inputMode:'photo'},imageDataUrls:[image]}).then(v=>{q.status='done';q.result={mode:v.mode,providerStatus:v.providerStatus,connected:v.coachState.isConnected,answerPresent:Boolean(v.answer?.trim()),matchesExpected:/\b4\b/.test(v.answer||''),warning:v.coachState.warning,elapsedMs:Date.now()-q.started}}).catch(e=>{q.status='failed';q.result={code:e.code||'request_failed',elapsedMs:Date.now()-q.started}})
   return {scheduled:true,studentPhotoUsed:false}
  }.toString()})
  const result=await until(function(){const q=getApp().__stemPhotoQa;return q&&q.status!=='pending'?{status:q.status,...q.result,studentPhotoUsed:false}:null},'real STEM photo Coach',85000)
  if(out)fs.writeFileSync(out,JSON.stringify(result,null,2),'utf8')
  console.log(JSON.stringify(result))
  assert.equal(result.status,'done');assert.equal(result.mode,'ai');assert.equal(result.providerStatus,'connected');assert.equal(result.matchesExpected,true)
 }finally{await evaluate(function(){delete getApp().__stemPhotoQa;return true}).catch(()=>{});await account.end()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
