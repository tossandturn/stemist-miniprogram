const {deviceState,syncDevice}=require('../../utils/page')
const {examChoices,newExam,readExam,submitExam}=require('../../utils/nativeExam')
const {rememberRecord}=require('../../utils/nativeRecords')
Page({
 data:deviceState({context:'same-test',title:'剑桥套题',choices:[],choiceIndex:0,examKey:'',loading:false,busy:false,error:'',cards:[],submitted:false,feedback:'',canSubmit:false}),
 onLoad(options={}){this.__disposed=false;const context=options.mode==='random-exam'?'random-exam':'same-test';this.setData({context,title:context==='same-test'?'剑桥套题':'随机模考',examKey:String(options.examKey||'')});if(this.data.examKey)this.refresh();else this.load()},
 onShow(){syncDevice(this);if(this.data.examKey)this.refresh()},onResize(){syncDevice(this)},onUnload(){this.__disposed=true},
 async load(){this.setData({loading:true,error:''});try{this.__choices=await examChoices();if(!this.__disposed)this.setData({choices:this.__choices.map(c=>({id:c.id,title:c.title}))})}catch(e){if(!this.__disposed)this.setData({error:e.message})}finally{if(!this.__disposed)this.setData({loading:false})}},
 choose(event){this.setData({choiceIndex:Number(event.detail.value)})},
 async start(){if(this.data.busy)return;this.setData({busy:true,error:''});try{const exam=await newExam(this.data.context,this.data.choices[this.data.choiceIndex]?.id);if(!this.__disposed){this.setData({examKey:exam.key});this.refresh()}}catch(e){if(!this.__disposed)this.setData({error:e.message})}finally{if(!this.__disposed)this.setData({busy:false})}},
 refresh(){const exam=readExam(this.data.examKey);if(!exam)return this.setData({error:'未找到可恢复的模拟，请重新开始。'});this.__exam=exam;const cards=[['listening','Listening'],['reading','Reading'],['writing1','Writing · Task 1'],['writing2','Writing · Task 2'],['speaking','Speaking']].map(([id,title])=>({id,title,complete:Boolean(exam.modules[id]?.complete)}));this.setData({cards,submitted:exam.submitted,feedback:exam.result?.feedback||'',canSubmit:cards.every(c=>c.complete)})},
 openModule(event){const id=event.currentTarget.dataset.module,exam=this.__exam;if(!exam||exam.submitted)return;const module=id.startsWith('writing')?'writing':id;const taskId=module==='writing'?exam.sources.writing[id==='writing1'?0:1]:exam.sources[module];if(!taskId)return;wx.navigateTo({url:'/pages/ielts/'+module+'?taskId='+encodeURIComponent(taskId)+'&examKey='+encodeURIComponent(exam.key),fail:()=>this.setData({error:'练习未能打开，请重试。'})})},
 async submit(){if(this.data.busy||!this.data.canSubmit)return;this.setData({busy:true,error:''});try{const exam=await submitExam(this.data.examKey);if(!this.__disposed){rememberRecord({id:exam.key,skill:'exam',category:'ielts',title:this.data.title,submittedAt:Date.now(),coachMode:exam.result.mode});this.refresh()}}catch(e){if(!this.__disposed)this.setData({error:e.message})}finally{if(!this.__disposed)this.setData({busy:false})}},
 back(){wx.navigateBack()}
})
