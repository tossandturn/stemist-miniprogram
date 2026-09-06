const {deviceState,syncDevice}=require('../../utils/page')
const {recentRecords}=require('../../utils/nativeRecords')
const {requestIeltsLearning}=require('../../utils/ieltsLearning')
const {ensureWeChatSession}=require('../../utils/wechatAuth')
Page({
 data:deviceState({view:'dashboard',title:'今日计划',records:[],total:0,weeklyCount:0,target:6.5,targets:[5,5.5,6,6.5,7,7.5,8,8.5,9],targetIndex:3,user:null,membership:null,code:'',busy:false,error:'',status:''}),
 onLoad(options={}){this.__disposed=false;const view=['records','subscription'].includes(options.view)?options.view:'dashboard';this.setData({view,title:view==='records'?'学习记录':view==='subscription'?'会员':'今日计划'})},
 onShow(){syncDevice(this);this.refresh()},onResize(){syncDevice(this)},onUnload(){this.__disposed=true},
 refresh(){const user=wx.getStorageSync('stemistUser')||null;this.__owner=String(user?.id||'guest');const target=Number(wx.getStorageSync('stemistGoal:'+this.__owner)?.target)||6.5;this.__records=recentRecords();this.setData({user,records:this.__records.slice(0,20),total:this.__records.length,weeklyCount:this.__records.filter(record=>record.submittedAt>Date.now()-7*86400000).length,target,targetIndex:Math.max(0,this.data.targets.indexOf(target)),error:''});if(user&&wx.getStorageSync('stemistSessionToken'))this.loadAccount()},
 async loadAccount(){const expected=this.__owner;try{const payload=await requestIeltsLearning('/api/me',undefined,{method:'GET'});if(!this.__disposed&&this.__owner===expected)this.setData({membership:payload.user?.membership||payload.membership||null})}catch{if(!this.__disposed)this.setData({status:'本机记录可用，账号同步暂未完成'})}},
 chooseTarget(event){const targetIndex=Number(event.detail.value),target=this.data.targets[targetIndex];if(!target)return;wx.setStorageSync('stemistGoal:'+this.__owner,{target,updatedAt:Date.now()});this.setData({targetIndex,target,status:'目标已保存'})},
 openSkill(event){const module=event.currentTarget.dataset.module;if(['listening','reading','writing','speaking'].includes(module))wx.navigateTo({url:'/pages/ielts/library?module='+module})},
 more(){this.setData({records:this.__records.slice(0,Math.min(200,this.data.records.length+20))})},
 openRecord(event){const record=this.__records[Number(event.currentTarget.dataset.index)];if(!record)return;if(record.skill==='exam'&&record.id.startsWith('mini-exam-'))return wx.navigateTo({url:'/pages/ielts/exam?examKey='+encodeURIComponent(record.id)});if(record.taskId&&['listening','reading','writing','speaking'].includes(record.skill))return wx.navigateTo({url:'/pages/ielts/'+record.skill+'?taskId='+encodeURIComponent(record.taskId)});if(record.paperId)return wx.navigateTo({url:'/pages/stem/paper?paperId='+encodeURIComponent(record.paperId)+'&subject='+encodeURIComponent(record.subjectCode)+'&routeId='+encodeURIComponent(record.routeId)+'&mode='+encodeURIComponent(record.mode||'past-paper-practice')})},
 inputCode(event){this.setData({code:String(event.detail.value||'').slice(0,100),error:''})},
 async redeem(){if(this.data.busy||!this.data.code.trim())return;this.setData({busy:true,error:''});try{await requestIeltsLearning('/api/redeem',{code:this.data.code.trim()});if(!this.__disposed){this.setData({code:'',status:'已提交激活'});await this.loadAccount()}}catch(e){if(!this.__disposed)this.setData({error:e.message})}finally{if(!this.__disposed)this.setData({busy:false})}},
 async signIn(){if(this.data.busy)return;this.setData({busy:true,error:''});try{await ensureWeChatSession({silent:false});if(!this.__disposed)this.refresh()}catch(e){if(!this.__disposed)this.setData({error:e.message||'微信登录未完成'})}finally{if(!this.__disposed)this.setData({busy:false})}},
 account(){wx.navigateTo({url:'/pages/account/auth'})},
 back(){wx.navigateBack()}
})
