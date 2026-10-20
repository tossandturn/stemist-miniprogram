const {answerContent}=require('../../utils/nativeAnswer')
Component({
 properties:{text:{type:String,value:'',observer(){this.updateContent()}},compact:{type:Boolean,value:false,observer(){this.updateContent()}}},
 data:{nodes:[],links:[],error:''},
 methods:{updateContent(){const content=answerContent(this.data.text);if(this.data.compact)content.nodes=content.nodes.map((node,index)=>({...node,attrs:{...node.attrs,style:(node.attrs?.style||'')+(index===0?'margin-top:0;':'')+(index===content.nodes.length-1?'margin-bottom:0;':'')}}));this.setData(content)},openLink(event){const link=this.data.links[Number(event.currentTarget.dataset.index)];if(!link)return;if(link.target)wx.navigateTo({url:link.target,fail:()=>this.setData({error:'这个学习页面暂时无法打开。'})});else wx.setClipboardData({data:link.url,fail:()=>this.setData({error:'链接未能复制，请重试。'})})}}
})
