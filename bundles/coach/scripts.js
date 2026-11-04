const {deviceState,syncDevice}=require('../../utils/page')
const api=require('./scriptRoomApi')
const {THEMES}=require('./scriptAtmosphere')
Page({
 entryPublic:true,
 data:deviceState({scripts:[],rooms:[],invite:'',loading:true,error:''}),
 onLoad(){this.__alive=true;this.__request=0},
 onShow(){syncDevice(this);if(this.__owner!==api.identity()||!require('../../utils/entryAccess').canEnter())this.setData({rooms:[]});this.__owner=api.identity();this.refresh()},onResize(){syncDevice(this)},onUnload(){this.__alive=false;this.__request++},
 async refresh(){const request=++this.__request;this.setData({loading:true,error:''});try{
  const data=await api.catalog();if(!this.__alive||request!==this.__request)return
  this.setData({scripts:data.scripts.map(s=>({...s,cover:api.media(s.cover),theme:THEMES[s.id]?.theme||'neutral',atmosphereLine:THEMES[s.id]?.eyebrow||''})),loading:false})
  if(require('../../utils/entryAccess').canEnter()){const list=await api.list();if(this.__alive&&request===this.__request)this.setData({rooms:list.rooms.map(r=>({...r,status:{lobby:'等待开始',play:'正在体验',vote:'最终投票',ended:'已完成',closed:'已关闭'}[r.phase]||''}))})}
 }catch(e){if(this.__alive&&request===this.__request)this.setData({loading:false,error:e.message})}},
 create(e){const id=e.currentTarget.dataset.id;if(this.data.scripts.some(s=>s.id===id))wx.navigateTo({url:'/bundles/coach/scriptRoom?create='+encodeURIComponent(id)})},
 resume(e){const id=e.currentTarget.dataset.id;if(/^[a-f0-9-]{36}$/.test(id||''))wx.navigateTo({url:'/bundles/coach/scriptRoom?roomId='+id})},
 typeInvite(e){this.setData({invite:String(e.detail.value||'').replace(/\s/g,'').toUpperCase()})},
 join(){if(!/^[A-F0-9]{16}$/.test(this.data.invite)){this.setData({error:'请输入16位邀请码，或打开好友分享的邀请。'});return}wx.navigateTo({url:'/bundles/coach/scriptRoom?invite='+this.data.invite})},
 onShareAppMessage(){return{...require('../../utils/share').onShareAppMessage.call(this),title:'AI 剧本杀 · 一个人也能开场',path:'/bundles/coach/scripts'}},
})
