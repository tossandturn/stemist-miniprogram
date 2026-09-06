const automator=require(process.env.WECHAT_AUTOMATOR_MODULE||'D:/CodexWork/qa-artifacts/stemist-devtools/node_modules/miniprogram-automator')
;(async()=>{
 const app=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'})
 try{
  await app.evaluate(()=>{
   const paths=['/healthz','/api/native/ielts/catalog','/api/native/ielts/tasks/reading/cam15-r-test1','/api/listening/asr-cache?id=cam15-l-test1&section=1']
   getApp().__qaNativeNetwork=[]
   for(const path of paths){const start=Date.now();wx.request({url:'https://ieltsist.com'+path,method:'GET',timeout:15000,success:r=>getApp().__qaNativeNetwork.push({path,status:r.statusCode,elapsedMs:Date.now()-start,jsonCharacters:JSON.stringify(r.data).length}),fail:()=>getApp().__qaNativeNetwork.push({path,status:0,elapsedMs:Date.now()-start})})}
  })
  let result=[];const end=Date.now()+20000
  while(Date.now()<end){result=await app.evaluate(()=>getApp().__qaNativeNetwork||[]);if(result.length===4)break;await new Promise(r=>setTimeout(r,500))}
  console.log(JSON.stringify({surface:'WeChat DevTools, real HTTPS requests',requests:result}))
  await app.evaluate(()=>{delete getApp().__qaNativeNetwork})
 }finally{app.disconnect()}
})().catch(e=>{console.error(e.message);process.exitCode=1})
