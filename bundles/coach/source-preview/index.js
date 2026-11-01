const {requestJson}=require('../../../utils/api')
const {normalizeSources}=require('../admissionsSources')
const identity=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')+':'+String(wx.getStorageSync('stemistPrivacyEpoch')||0)
Component({
 properties:{sources:{type:Array,value:[]},conversationId:{type:String,value:''},turnId:{type:String,value:''},autoPreview:{type:Boolean,value:false}},
 data:{cards:[]},
 observers:{'sources, conversationId, turnId'(){if(this.__ready)this.refreshSources()}},
 lifetimes:{attached(){this.__ready=true;this.__disposed=false;this.__owner=identity();this.__generation=0;this.__files=new Set();this.refreshSources()},detached(){this.__disposed=true;this.__generation++;this.clearImages()}},
 pageLifetimes:{show(){if(this.__ready&&this.__owner!==identity()){this.__generation++;this.clearImages();this.setData({cards:[]})}}},
 methods:{
  clearImages(){for(const path of this.__files||[]){try{wx.getFileSystemManager().unlink({filePath:path,fail(){}})}catch{}}this.__files?.clear()},
  current(generation){return !this.__disposed&&generation===this.__generation&&this.__owner===identity()},
  refreshSources(){
   const sources=normalizeSources(this.data.sources),key=JSON.stringify([this.data.conversationId,this.data.turnId,sources])
   if(key===this.__key)return
   this.__key=key;this.__generation++;this.clearImages()
   this.setData({cards:sources.map(source=>({...source,busy:false,imagePath:'',previewKind:'',previewLabel:'',note:'',expanded:false}))})
   // Only the newest completed answer may opt in; recovered history never renders en masse.
   if(this.data.autoPreview&&sources.length)void this.fetchPreview({currentTarget:{dataset:{id:sources[0].id}}})
  },
  patch(id,patch){this.setData({cards:this.data.cards.map(card=>card.id===id?{...card,...patch}:card)})},
  toggle(event){const id=String(event?.currentTarget?.dataset?.id||''),card=this.data.cards.find(x=>x.id===id);if(card)this.patch(id,{expanded:!card.expanded})},
  async fetchPreview(event){
   const id=String(event?.currentTarget?.dataset?.id||''),card=this.data.cards.find(x=>x.id===id),generation=this.__generation
   if(!card||card.busy||card.imagePath||!this.current(generation)||!this.data.conversationId||!this.data.turnId)return
   this.patch(id,{busy:true,note:'',expanded:true})
   try{
    const response=await requestJson('/api/ai/admissions/source-preview',{conversationId:this.data.conversationId,turnId:this.data.turnId,sourceId:id},{method:'POST',timeout:25000})
    if(!this.current(generation))return
    const preview=response?.preview
    if(preview?.kind!=='static-webpage-screenshot'){
     this.patch(id,{busy:false,previewKind:'excerpt-card',previewLabel:'官网原文摘录 · 非网页截图',note:'未能生成网页截图，已保留本次读取的原文。'})
     return
    }
    if(preview.sourceUrl!==card.url||preview.mimeType!=='image/png'||typeof preview.base64!=='string'||preview.base64.length>2800000||!/^iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(preview.base64)||!Number.isInteger(preview.width)||preview.width<100||preview.width>1600||!Number.isInteger(preview.height)||preview.height<100||preview.height>2400||!Number.isFinite(Date.parse(preview.capturedAt)))throw Error('invalid-preview')
    const root=wx.env?.USER_DATA_PATH
    if(!root)throw Error('storage-unavailable')
    const filePath=root+'/admissions-preview-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)+'.png'
    this.__files.add(filePath)
    await new Promise((resolve,reject)=>wx.getFileSystemManager().writeFile({filePath,data:preview.base64,encoding:'base64',success:resolve,fail:reject}))
    if(!this.current(generation)){try{wx.getFileSystemManager().unlink({filePath,fail(){}})}catch{};this.__files.delete(filePath);return}
    this.patch(id,{busy:false,imagePath:filePath,previewKind:'static-webpage-screenshot',previewLabel:'静态网页截图 · '+preview.capturedAt.slice(0,10),note:'截图供核对；动态内容可能未显示，以已读取原文为准。'})
   }catch{
    if(this.current(generation))this.patch(id,{busy:false,previewKind:'excerpt-card',previewLabel:'官网原文摘录 · 非网页截图',note:'截图暂不可用，可重试；文字答复和原文仍可查看。'})
   }
  },
  imageFailed(event){const id=String(event?.currentTarget?.dataset?.id||'');this.patch(id,{imagePath:'',previewKind:'excerpt-card',previewLabel:'官网原文摘录 · 非网页截图',note:'图片未能显示，原文仍可查看。'})},
  zoom(event){if(this.__owner!==identity()||this.__disposed)return;const card=this.data.cards.find(x=>x.id===String(event?.currentTarget?.dataset?.id||''));if(card?.imagePath)wx.previewImage({current:card.imagePath,urls:[card.imagePath]})},
 }
})
