const {readCoachEffort,saveCoachEffort,coachEffortPreference}=require('../../utils/coachEffort')
const levels=['auto','low','high','max'],labels=['按场景推荐','快速 · low','深入 · high','极致 · max'],notes=['','思考已开启 · 优先及时回复','思考已开启 · 适合更细致的分析，等待较久','思考已开启 · 耗时更长，不保证更准确']
const academic=scope=>['academic','steps','answers','check'].includes(scope||'academic')
const selectedLabel=(scope,mode,selected)=>mode==='auto'&&academic(scope)?'默认 · low':(mode==='auto'?'推荐 · ':'')+labels[levels.indexOf(selected)]
const who=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')+':'+(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)
Component({
 properties:{scope:{type:String,value:'academic'},message:{type:String,value:''},effort:{type:String,value:''},disabled:{type:Boolean,value:false},locked:{type:Boolean,value:false},compact:{type:Boolean,value:false}},
 data:{labels,selected:'low',index:0,label:labels[1],note:notes[1],error:''},
 lifetimes:{attached(){this.refresh()}},pageLifetimes:{show(){this.refresh()}},observers:{'effort,locked,scope,message':function(){this.refresh()}},
 methods:{
  onOpen(){if(!this.data.disabled&&!this.data.locked){this.__selectionOwner=who();this.__selectionScope=this.data.scope}},
  onCancel(){this.__selectionOwner=null},
  refresh(){this.__who=who();const mode=coachEffortPreference(this.data.scope),selected=levels.slice(1).includes(this.data.effort)?this.data.effort:readCoachEffort(this.data.scope,this.data.message),n=levels.indexOf(selected);this.setData({selected,index:levels.indexOf(mode),labels:labels.map((label,index)=>index===0&&academic(this.data.scope)?'默认 low · 开启思考':label),label:this.data.locked&&!this.data.effort?'原任务设置':this.data.locked?labels[n]:selectedLabel(this.data.scope,mode,selected),note:this.data.locked?'本次任务已固定档位，重试不变':notes[n]})},
  onChange(event){if(this.data.disabled||this.data.locked)return;const openedOwner=this.__selectionOwner||this.__who,openedScope=this.__selectionScope||this.data.scope;this.__selectionOwner=null;this.__selectionScope=null;if(openedOwner!==who()||openedScope!==this.data.scope){this.refresh();return}const value=event?.detail?.value;if(![0,1,2,3,'0','1','2','3'].includes(value))return;const index=Number(value);try{saveCoachEffort(levels[index],this.data.scope);const selected=readCoachEffort(this.data.scope,this.data.message);this.setData({selected,index,label:selectedLabel(this.data.scope,levels[index],selected),note:notes[levels.indexOf(selected)],error:''});this.triggerEvent('change',{value:selected,mode:levels[index],scope:this.data.scope})}catch(error){this.setData({error:error.message})}},
 }
})
