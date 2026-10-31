const {readCoachEffort,saveCoachEffort}=require('../../utils/coachEffort')
const levels=['low','high','max'],labels=['快速','深入','极致'],notes=['思考已开启 · 优先及时回复','思考已开启 · 适合更细致的分析，等待较久','思考已开启 · 耗时更长，不保证更准确']
const who=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')+':'+(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)
Component({
 properties:{scope:{type:String,value:'academic'},message:{type:String,value:''},effort:{type:String,value:''},disabled:{type:Boolean,value:false},locked:{type:Boolean,value:false},compact:{type:Boolean,value:false}},
 data:{labels,selected:'low',index:0,label:labels[0],note:notes[0],error:''},
 lifetimes:{attached(){this.refresh()}},pageLifetimes:{show(){this.refresh()}},observers:{'effort,locked,scope,message':function(){this.refresh()}},
 methods:{
  onOpen(){if(!this.data.disabled&&!this.data.locked){this.__selectionOwner=who();this.__selectionScope=this.data.scope}},
  onCancel(){this.__selectionOwner=null},
  refresh(){this.__who=who();const selected=levels.includes(this.data.effort)?this.data.effort:readCoachEffort(this.data.scope,this.data.message),index=levels.indexOf(selected);this.setData({selected,index,label:this.data.locked&&!this.data.effort?'原任务设置':labels[index],note:this.data.locked?'思考已开启 · 本次模式固定，重试不变':notes[index]})},
  onChange(event){if(this.data.disabled||this.data.locked)return;const openedOwner=this.__selectionOwner||this.__who,openedScope=this.__selectionScope||this.data.scope;this.__selectionOwner=null;this.__selectionScope=null;if(openedOwner!==who()||openedScope!==this.data.scope){this.refresh();return}const value=event?.detail?.value;if(![0,1,2,'0','1','2'].includes(value))return;const index=Number(value);try{saveCoachEffort(levels[index],this.data.scope);const selected=readCoachEffort(this.data.scope,this.data.message);this.setData({selected,index,label:labels[index],note:notes[index],error:''});this.triggerEvent('change',{value:selected,mode:levels[index],scope:this.data.scope})}catch(error){this.setData({error:error.message})}},
 }
})
