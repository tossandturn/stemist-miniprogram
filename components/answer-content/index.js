const {answerContent}=require('../../utils/nativeAnswer')
Component({
 properties:{text:{type:String,value:'',observer(value){this.setData(answerContent(value))}}},
 data:{nodes:[],links:[],error:''},
 methods:{openLink(event){const link=this.data.links[Number(event.currentTarget.dataset.index)];if(!link)return;if(link.target)wx.navigateTo({url:link.target,fail:()=>this.setData({error:'这个学习页面暂时无法打开。'})});else wx.setClipboardData({data:link.url,fail:()=>this.setData({error:'链接未能复制，请重试。'})})}}
})
