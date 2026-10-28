const {captureReview,currentReview}=require('./practiceReview')
const {renderReview,removeTemp}=require('./practiceRender')
const {stageCoachEntry}=require('../../utils/coachEntry')
const {persistCoachPhotos,clearCoachPhoto}=require('../../utils/nativeCoachPhoto')
const {deviceState,syncDevice}=require('../../utils/page')

Page({
 onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
 data:deviceState({busy:false,label:'正在准备错题',error:'',number:'',source:'',percent:null,bytes:'',authRequired:false}),
 onLoad(options={}){const decode=value=>{try{return decodeURIComponent(String(value||''))}catch{return ''}};this.__options={sessionId:decode(options.sessionId),questionId:decode(options.questionId)};this.__cancelled=false;this.__disposed=false;this.__leaving=false},
 onReady(){this.prepare()},
 onShow(){syncDevice(this);if(this.data.authRequired&&wx.getStorageSync('stemistSessionToken'))this.setData({authRequired:false,error:'',label:'已登录，点击继续准备'})},
 onResize(){syncDevice(this)},
 onHide(){if(!this.__leaving)this.stop()},
 onUnload(){this.__disposed=true;if(!this.__leaving)this.stop()},
 guard(){if(this.__cancelled||this.__disposed||!this.__review||!currentReview(this.__review))throw Error('题目或账号已变化，请返回当前错题重试。')},
 stop(){
  this.__cancelled=true;this.__abort?.();this.__abort=null
  this.discardPrepared()
  if(!this.__disposed)this.setData({busy:false,label:'已暂停',percent:null,bytes:''})
 },
 discardPrepared(){
  const prepared=this.__prepared
  if(prepared){
   if(wx.getStorageSync('stemistCoachPhotoMeta')?.entryKey===prepared.key)clearCoachPhoto(this.__review.identity)
   if(wx.getStorageSync('stemistCoachEntry')?.key===prepared.key)wx.removeStorageSync('stemistCoachEntry')
   this.__prepared=null
  }
 },
 cancel(){this.stop();wx.navigateBack({fail:()=>wx.redirectTo({url:'/pages/stem/practice?sessionId='+encodeURIComponent(this.__options.sessionId||'')})})},
 openAccount(){wx.navigateTo({url:'/pages/account/auth'})},
 canvas(){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('图片画布尚未就绪，请重试。')),5000)
  wx.createSelectorQuery().in(this).select('#review-canvas').fields({node:true,size:true}).exec(results=>{clearTimeout(timer);results?.[0]?.node?resolve(results[0].node):reject(Error('图片画布尚未就绪，请重试。'))})
 })},
 navigate(){
  this.guard();const key=this.__prepared.key
  const entry=wx.getStorageSync('stemistCoachEntry'),age=Date.now()-Number(entry?.at)
  if(!entry||entry.key!==key||entry.owner!==this.__review.identity.owner||entry.epoch!==this.__review.identity.epoch||!Number.isFinite(age)||age<0||age>=120000){this.discardPrepared();throw Error('题目上下文已过期，请点重试重新准备。')}
  this.__leaving=true;this.setData({label:'已保存，正在打开 AI Coach',error:'',percent:null,bytes:''})
  wx.redirectTo({url:'/pages/coach/index?source=practice&feature=answers&entry='+encodeURIComponent(key)+'&routeId='+encodeURIComponent(this.__review.context.routeId||'')+'&stage='+encodeURIComponent(this.__review.context.stage||'')+'&subjectCode='+encodeURIComponent(this.__review.context.subject?.code||'')+'&category=alevel&family=exam',fail:()=>{this.__leaving=false;if(!this.__disposed)this.setData({busy:false,error:'AI Coach 未能打开，图片已保存，请重试。'})}})
 },
 async prepare(){
  if(this.data.busy||this.__disposed)return
  this.__cancelled=false
  if(!wx.getStorageSync('stemistSessionToken'))return this.setData({authRequired:true,error:'请登录后使用 AI Coach，练习和作答会保留。',label:'需要登录'})
  let outputs=[],key='',previousEntry
  this.setData({busy:true,error:'',authRequired:false,percent:null,bytes:'',label:'正在读取本题与作答'})
  try{
   if(this.__prepared){this.navigate();return}
   this.__review=captureReview(String(this.__options.sessionId||''),String(this.__options.questionId||''));this.guard()
   this.setData({number:this.__review.number,source:this.__review.source})
   const canvas=await this.canvas();this.guard()
   outputs=await renderReview(this.__review,canvas,{guard:()=>this.guard(),setAbort:abort=>{this.__abort=abort},onProgress:p=>{this.guard();const total=Number(p.total),loaded=Number(p.loaded);this.setData({label:p.label,percent:total>0&&loaded>=0?Math.min(100,Math.floor(loaded/total*100)):null,bytes:loaded>=0?`${Math.ceil(loaded/1024)} KB${total>0?' / '+Math.ceil(total/1024)+' KB':''}`:''})}})
   this.guard()
   const nonce=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)
   previousEntry=wx.getStorageSync('stemistCoachEntry')
   key=stageCoachEntry({...this.__review.context,taskId:'chapter-'+nonce,initialMessage:this.__review.message})
   if(!key)throw Error('题目上下文未能保存，请重试。')
   const paths=await persistCoachPhotos(outputs,this.__review.identity,{contextId:'stem-photo',feature:'answers',entryKey:key,autoSubmitNonce:nonce},{cancelled:()=>this.__cancelled||this.__disposed||!currentReview(this.__review)})
   this.__prepared={key,paths};this.guard();this.navigate()
  }catch(error){
   if(key&&!this.__prepared&&wx.getStorageSync('stemistCoachEntry')?.key===key){try{const age=Date.now()-Number(previousEntry?.at);if(previousEntry&&previousEntry.owner===this.__review?.identity.owner&&previousEntry.epoch===this.__review?.identity.epoch&&age>=0&&age<120000&&currentReview(this.__review))wx.setStorageSync('stemistCoachEntry',previousEntry);else wx.removeStorageSync('stemistCoachEntry')}catch{}}
   if(!this.__disposed&&!this.__cancelled)this.setData({error:error.message||'题图准备失败，请重试。',label:'暂未发送给 AI',percent:null,bytes:''})
  }finally{outputs.forEach(removeTemp);this.__abort=null;if(!this.__disposed)this.setData({busy:false})}
 }
})
