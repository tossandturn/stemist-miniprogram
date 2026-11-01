const {normalizeDiagram,drawDiagram}=require('../../utils/coachDiagram')
Component({
 properties:{diagram:{type:Object,value:null,observer(){this.draw()}}},
 data:{title:'',description:'',height:220,error:'',ready:false},
 lifetimes:{attached(){this.__disposed=false;this.__version=0},ready(){this.__ready=true;this.draw()},detached(){this.__disposed=true;this.__version++}},
 pageLifetimes:{resize(){this.draw()}},
 methods:{
  draw(){
   if(!this.__ready||this.__disposed)return
   const diagram=normalizeDiagram(this.data.diagram),version=++this.__version
   if(!diagram)return this.setData({ready:false,error:'图示暂不可用，请参考文字解答。'})
   this.setData({title:diagram.title,description:diagram.description,ready:false,error:''})
   this.createSelectorQuery().select('#diagram-canvas').fields({node:true,size:true}).exec(rows=>{
    if(this.__disposed||version!==this.__version)return
    try{const {node,width}=rows[0]||{};if(!node||!width)throw Error('canvas');const height=Math.round(width*diagram.height/diagram.width),ratio=Math.min(3,Number(wx.getWindowInfo?.().pixelRatio||wx.getSystemInfoSync().pixelRatio)||1);node.width=Math.round(width*ratio);node.height=Math.round(height*ratio);const ctx=node.getContext('2d');ctx.scale(ratio,ratio);drawDiagram(ctx,diagram,width,height);this.__canvas=node;this.setData({height,ready:true})}catch{this.setData({ready:false,error:'当前设备未能显示图示，请参考下方说明和文字步骤。'})}
   })
  },
  preview(){
   if(!this.data.ready||!this.__canvas||this.__disposed||typeof wx.canvasToTempFilePath!=='function')return
   const version=this.__version
   wx.canvasToTempFilePath({canvas:this.__canvas,fileType:'png',success:r=>{if(!this.__disposed&&version===this.__version)wx.previewImage({current:r.tempFilePath,urls:[r.tempFilePath]})},fail:()=>{if(!this.__disposed)this.setData({error:'暂时无法放大，图示仍可在这里查看。'})}},this)
  },
 }
})
