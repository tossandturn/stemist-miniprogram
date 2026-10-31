const {deviceState,syncDevice}=require('../../utils/page')
const api=require('./taskData')
const {taskProgressView}=require('../../utils/coachTaskView')
const ID=/^cj-[A-Za-z0-9_-]{16,80}$/
const dateLabel=ms=>{const d=new Date(ms),pad=x=>String(x).padStart(2,'0');return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`}
Page({
 onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
 data:deviceState({authenticated:false,items:[],loading:false,error:'',id:'',detail:null,answer:'',partial:false,local:false,nextCursor:null,pageNumber:1,canPrevious:false,autoPaused:false}),
 onLoad(options){this.__disposed=false;this.__visible=false;this.__generation=0;this.__cursor='';this.__previous=[];this.__scope=api.scope();this.__observedAt=0;this.__snapshot=null;const id=String(options?.id||'');this.setData({id:ID.test(id)?id:'',error:id&&!ID.test(id)?'任务编号无效。':''})},
 onShow(){this.__visible=true;syncDevice(this);this.bindOwner();this.__pollStarted=Date.now();return this.refresh()},
 onResize(){syncDevice(this)},
 onHide(){this.__visible=false;this.pause()},
 onUnload(){this.__disposed=true;this.__visible=false;this.pause();this.__snapshot=null;this.setData({answer:'',detail:null,items:[]})},
 bindOwner(){if(!api.current(this.__scope)){this.pause();this.__scope=api.scope();this.__cursor='';this.__previous=[];this.__snapshot=null;this.setData({id:'',items:[],detail:null,answer:'',partial:false,error:'',nextCursor:null,pageNumber:1,canPrevious:false})}this.setData({authenticated:this.__scope.owner!=='guest'&&Boolean(wx.getStorageSync('stemistSessionToken'))})},
 valid(g){return !this.__disposed&&this.__visible&&g===this.__generation&&api.current(this.__scope)},
 pause(){this.__generation++;clearTimeout(this.__pollTimer);clearTimeout(this.__expiryTimer);clearInterval(this.__tickTimer);this.__pollTimer=null;this.__tickTimer=null;try{this.__request?.abort()}catch{}this.__request=null;this.setData({loading:false})},
 tick(){if(!this.__snapshot)return;const view=taskProgressView(this.__snapshot,Math.max(0,Date.now()-this.__observedAt));if(view)this.setData({detail:{...view,createdLabel:dateLabel(view.createdAt),expiryLabel:dateLabel(view.expiresAt)}})},
 async refresh(){
  this.pause();this.bindOwner();if(!this.__visible||this.__disposed||!this.data.authenticated)return
  const g=this.__generation;this.setData({loading:true,error:''})
  try{
   const options={onTask:t=>{if(this.valid(g))this.__request=t;else t?.abort?.()}}
   if(this.data.id){
    const result=await api.detail(this.__scope,this.data.id,options);if(!this.valid(g))return
    if(this.__snapshot&&result.snapshot.serverNow<this.__snapshot.serverNow)return
    this.__snapshot=result.snapshot;this.__observedAt=Date.now();this.setData({answer:result.answer,partial:result.partial,local:result.local});this.tick()
    this.__expiryTimer=setTimeout(()=>{if(this.valid(g)){this.pause();this.__snapshot=null;this.setData({answer:'',detail:null,partial:false,error:'任务已到期，结果保存时间为 3 天。'})}},Math.max(1,result.snapshot.expiresAt-result.snapshot.serverNow))
    if(result.view.active){this.__tickTimer=setInterval(()=>{if(this.valid(g))this.tick()},1000);if(Date.now()-this.__pollStarted<180000)this.__pollTimer=setTimeout(()=>{if(this.valid(g))this.refresh()},1500);else this.setData({autoPaused:true})}
   }else{
    const result=await api.list(this.__scope,this.__cursor,options);if(!this.valid(g))return
    this.setData({items:result.items.map(item=>{const v=taskProgressView(item);return{id:item.id,title:v.taskTitle,status:v.label,active:v.active,effort:v.effortLabel,createdLabel:dateLabel(item.createdAt),expiryLabel:dateLabel(item.expiresAt)}}),nextCursor:result.nextCursor,pageNumber:this.__previous.length+1,canPrevious:this.__previous.length>0})
   }
  }catch(error){if(!this.valid(g)){if(!this.__disposed&&!api.current(this.__scope))this.bindOwner();return}this.__snapshot=null;this.setData({error:api.errorMessage(error),answer:'',detail:null,items:[],partial:false,...(error?.code==='auth_required'||error?.statusCode===401?{authenticated:false}:{})})}
  finally{if(this.valid(g)){this.__request=null;this.setData({loading:false})}}
 },
 manualRefresh(){this.__pollStarted=Date.now();this.setData({autoPaused:false});return this.refresh()},
 open(event){const id=String(event.currentTarget?.dataset?.id||'');if(!ID.test(id)||!this.data.items.some(x=>x.id===id))return;this.__snapshot=null;this.__pollStarted=Date.now();this.setData({id,answer:'',detail:null,autoPaused:false});return this.refresh()},
 allTasks(){this.pause();this.__snapshot=null;this.__cursor='';this.__previous=[];this.setData({id:'',answer:'',detail:null,partial:false,pageNumber:1,canPrevious:false,autoPaused:false});return this.refresh()},
 nextPage(){if(this.data.loading||!this.data.nextCursor||this.__previous.length>=49)return;this.__previous.push(this.__cursor);this.__cursor=this.data.nextCursor;return this.refresh()},
 previousPage(){if(this.data.loading||!this.__previous.length)return;this.__cursor=this.__previous.pop();return this.refresh()},
 login(){wx.navigateTo({url:'/pages/account/auth'})},
 askNew(){wx.navigateTo({url:'/pages/coach/index?feature=answers&source=alevel'})},
})
