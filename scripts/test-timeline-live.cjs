// Native callbacks/menu registration only. Never publishes to Moments.
const assert=require('node:assert/strict')
const {call,evaluate}=require('./helpers/wechat-cli.cjs')
async function main(){
 const results=[]
 try{
  for(const [route,query] of [['pages/index/index',''],['pages/ielts/library','module=speaking'],['pages/stem/topics','routeId=cie-9702-as-physics']]){
   await call('automation_navigate',{action:'reLaunch',url:'/'+route+(query?'?'+query:'')})
   const result=await evaluate(function(){
    return new Promise(resolve=>{
     const p=getCurrentPages().slice(-1)[0]
     const payload=typeof p.onShareTimeline==='function'?p.onShareTimeline():null
     const complete=r=>resolve({route:p.route,payload,menu:r.errMsg})
     wx.showShareMenu({menus:['shareAppMessage','shareTimeline'],success:complete,fail:complete})
    })
   })
   assert.equal(result.route,route);assert.ok(result.payload);assert.equal(result.payload.query,query);assert.equal(result.menu,'showShareMenu:ok');assert.equal(result.payload.path,undefined)
   results.push(result)
  }
  console.log(JSON.stringify({status:'pass',published:false,results}))
 }finally{await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'})}
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
