const {deviceState,syncDevice}=require('../../utils/page')
const api=require('./scriptRoomApi')
const {THEMES}=require('./scriptAtmosphere')
const {roomFailure}=require('./scriptRoomRecovery')
Page({
 entryPublic:true,
 data:deviceState({scripts:[],rooms:[],latestRoom:null,invite:'',inviteError:'',joinOpen:false,selectedScript:null,historyOpen:false,loading:true,error:''}),
 onLoad(){this.__alive=true;this.__request=0},
 onShow(){syncDevice(this);this.__navigating=false;if(this.__owner!==api.identity()||!require('../../utils/entryAccess').canEnter())this.setData({rooms:[],latestRoom:null,historyOpen:false});this.__owner=api.identity();this.refresh()},onResize(){syncDevice(this)},onUnload(){this.__alive=false;this.__request++},
 async refresh(){const owner=api.identity();if(this.__refreshing&&this.__refreshOwner===owner)return;this.__refreshing=true;this.__refreshOwner=owner;const request=++this.__request;this.setData({loading:true,error:''});try{
  const allowed=require('../../utils/entryAccess').canEnter(),[catalog,list]=await Promise.allSettled([api.catalog(),allowed?api.list():Promise.resolve(null)])
  if(!this.__alive||request!==this.__request)return
  const errors=[]
  if(catalog.status==='fulfilled')this.setData({scripts:catalog.value.scripts.map(s=>({...s,cover:api.media(s.cover),theme:THEMES[s.id]?.theme||'neutral',atmosphereLine:THEMES[s.id]?.eyebrow||''}))})
  else errors.push('剧本目录暂未刷新。'+roomFailure(catalog.reason).message)
  if(owner!==api.identity()||!require('../../utils/entryAccess').canEnter())this.setData({rooms:[],latestRoom:null,historyOpen:false})
  else if(list.status==='fulfilled'&&list.value){const rooms=list.value.rooms.map(r=>({...r,status:{lobby:'等待开始',play:'正在体验',vote:'最终投票',ended:'已完成',closed:'已关闭'}[r.phase]||''}));this.setData({rooms,latestRoom:rooms.find(r=>['lobby','play','vote'].includes(r.phase))||rooms[0]||null})}
  else if(list.status==='rejected')errors.push('我的房间暂未刷新。'+roomFailure(list.reason).message)
  this.setData({loading:false,error:errors.join('\n')})
 }catch(e){if(this.__alive&&request===this.__request)this.setData({loading:false,error:roomFailure(e).message})}finally{if(request===this.__request)this.__refreshing=false}},
 navigateRoom(url){if(this.__navigating)return;this.__navigating=true;wx.navigateTo({url,fail:()=>{this.__navigating=false}})},
 create(e){const id=e.currentTarget.dataset.id;if(this.data.scripts.some(s=>s.id===id)){this.closeOverlays();this.navigateRoom('/bundles/coach/scriptRoom?create='+encodeURIComponent(id))}},
 resume(e){const id=e.currentTarget.dataset.id;if(/^[a-f0-9-]{36}$/.test(id||''))this.navigateRoom('/bundles/coach/scriptRoom?roomId='+id)},
 showScript(e){const selectedScript=this.data.scripts.find(s=>s.id===e.currentTarget.dataset.id);if(selectedScript)this.setData({selectedScript,joinOpen:false,historyOpen:false})},
 openInvite(){this.setData({joinOpen:true,selectedScript:null,historyOpen:false,inviteError:''})},openHistory(){this.setData({historyOpen:true,joinOpen:false,selectedScript:null})},
 closeOverlays(){try{wx.hideKeyboard?.()}catch{};this.setData({selectedScript:null,joinOpen:false,historyOpen:false})},swallowTouch(){},
 typeInvite(e){this.setData({invite:String(e.detail.value||'').replace(/\s/g,'').toUpperCase(),inviteError:''})},
 join(){if(!/^[A-F0-9]{16}$/.test(this.data.invite)){this.setData({inviteError:'请输入16位邀请码，或打开好友分享的邀请。'});return}this.closeOverlays();this.navigateRoom('/bundles/coach/scriptRoom?invite='+this.data.invite)},
 onShareAppMessage(){return{...require('../../utils/share').onShareAppMessage.call(this),title:'AI 剧本杀 · 一个人也能开场',path:'/bundles/coach/scripts'}},
})
