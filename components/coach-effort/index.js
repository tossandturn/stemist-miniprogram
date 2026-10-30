const {readCoachEffort,saveCoachEffort}=require('../../utils/coachEffort')
const levels=['low','high','max'],labels=['快速 · low','深入 · high','极致 · max'],notes=['保留思考，较快回复','更深入分析，可能等待更久','适合复杂问题，等待可能明显更久']
const who=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')+':'+(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)
Component({
 properties:{effort:{type:String,value:''},disabled:{type:Boolean,value:false},locked:{type:Boolean,value:false},compact:{type:Boolean,value:false}},
 data:{labels,selected:'low',index:0,label:labels[0],note:notes[0],error:''},
 lifetimes:{attached(){this.refresh()}},pageLifetimes:{show(){this.refresh()}},observers:{'effort,locked':function(){this.refresh()}},
 methods:{
  onOpen(){if(!this.data.disabled&&!this.data.locked)this.__selectionOwner=who()},
  onCancel(){this.__selectionOwner=null},
  refresh(){this.__who=who();const selected=levels.includes(this.data.effort)?this.data.effort:readCoachEffort(),index=levels.indexOf(selected);this.setData({selected,index,label:this.data.locked&&!this.data.effort?'原任务设置':labels[index],note:this.data.locked?'重试沿用原任务档位':notes[index]})},
  onChange(event){if(this.data.disabled||this.data.locked)return;const openedOwner=this.__selectionOwner||this.__who;this.__selectionOwner=null;if(openedOwner!==who()){this.refresh();return}const value=event?.detail?.value;if(![0,1,2,'0','1','2'].includes(value))return;const index=Number(value),selected=levels[index];try{saveCoachEffort(selected);this.setData({selected,index,label:labels[index],note:notes[index],error:''});this.triggerEvent('change',{value:selected})}catch(error){this.setData({error:error.message})}},
 }
})
