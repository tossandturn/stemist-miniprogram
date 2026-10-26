const {requestJson,isAuthError}=require('./api')
const states=new WeakMap()
const identity=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')+':'+String(wx.getStorageSync('stemistPrivacyEpoch')||0)
function clearCoachSource(page,render=true){const old=states.get(page);states.delete(page);if(old){old.payload=null;old.cancel?.()}try{old?.task?.abort()}catch{}if(render&&!page.__disposed)page.setData({sourceAction:null})}
function offerCoachSource(page,request,result){
 clearCoachSource(page)
 if(!result?.completed||result.sourceLookupAvailable!==true||String(request.context?.product||'').toLowerCase().includes('ielts'))return
 const state={owner:identity(),payload:{message:String(request.message||''),context:JSON.parse(JSON.stringify(request.context||{})),imageDataUrls:(request.imageDataUrls||[]).slice(0,4),confirmed:true},busy:false}
 states.set(page,state);page.setData({sourceAction:{status:'offer',text:'',error:''}})
}
async function lookupCoachSource(page){
 const state=states.get(page),current=()=>states.get(page)===state&&state.owner===identity()&&!page.__disposed&&(!page.current||page.current())
 if(!state||state.busy||page.data.sourceAction?.status==='done'||!current())return
 state.busy=true;page.setData({sourceAction:{status:'loading',text:'',error:''}})
 try{
  const cancelled=new Promise((resolve,reject)=>{state.cancel=()=>reject(Error('cancelled'))})
  const result=await Promise.race([requestJson('/api/ai/coach/source',state.payload,{timeout:35000,onTask:task=>{state.task=task;if(!current())try{task.abort()}catch{}},isCancelled:()=>!current()}),cancelled])
  if(!current())return
  if(typeof result.sourceText!=='string'||!result.sourceText.trim())throw Error('empty source')
  // Release the original image bytes once lookup is complete; never persist
  // photos, request payloads or source offers in page data/local storage.
  state.payload=null;page.setData({sourceAction:{status:'done',text:result.sourceText,error:''}})
 }catch(error){if(current())page.setData({sourceAction:{status:'error',text:'',error:isAuthError(error)?'请重新登录后查询，原答案已保留。':'出处查询未完成，原答案已保留。'}})}
 finally{state.busy=false;state.task=null;state.cancel=null;if(states.get(page)===state&&!current())clearCoachSource(page)}
}
module.exports={offerCoachSource,lookupCoachSource,clearCoachSource}
