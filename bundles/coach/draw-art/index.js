const {fetchDrawArtCatalog,artForDraw}=require('../drawArt')
const stamp=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')+':'+(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)
Component({
 properties:{draw:{type:Object,value:null}},
 data:{cards:[],three:false,catalogLoading:false,catalogError:'',loaded:{},failed:{},previewCards:[],previewIndex:0,previewError:false,previewVisible:true,previewLoaded:false},
 observers:{draw(){if(this.__alive)this.renderDraw()}},
 lifetimes:{
  attached(){this.__alive=true;this.__stamp=stamp();this.__revision=0;this.__timers={};this.renderDraw();this.loadCatalog()},
  detached(){this.__alive=false;this.__revision++;this.clearTimers()},
 },
 pageLifetimes:{hide(){this.closePreview()},show(){this.valid()}},
 methods:{
  valid(){if(!this.__alive)return false;if(this.__stamp!==stamp()){this.clearTimers();this.setData({cards:[],previewCards:[]});return false}return true},
  clearTimers(){for(const timer of Object.values(this.__timers||{}))clearTimeout(timer);this.__timers={}},
  timerFor(key){clearTimeout(this.__timers[key]);this.__timers[key]=setTimeout(()=>{if(this.valid()&&this.data.cards.some(c=>c.key===key)&&!this.data.loaded[key])this.setData({failed:{...this.data.failed,[key]:true}})},20000)},
  async loadCatalog(){
   if(!this.valid()||this.data.catalogLoading)return
   const revision=++this.__revision;this.setData({catalogLoading:true,catalogError:''})
   try{const result=await fetchDrawArtCatalog({force:Boolean(this.__catalog)});if(!this.valid()||revision!==this.__revision)return;this.__catalog=result.catalog;this.renderDraw()}
   catch(error){if(this.valid()&&revision===this.__revision)this.setData({catalogError:error.message||'牌面暂未加载，请重试。'})}
   finally{if(this.valid()&&revision===this.__revision)this.setData({catalogLoading:false})}
  },
  renderDraw(){
   if(!this.valid())return
   this.clearTimers();const cards=artForDraw(this.properties.draw,this.__catalog),loaded={},failed={}
   for(const c of cards){if(this.data.loaded[c.key])loaded[c.key]=true;if(this.data.failed[c.key])failed[c.key]=true}
   const signature=cards.map(c=>c.key+':'+c.angle).join(','),changed=signature!==this.__signature;this.__signature=signature
   this.setData({cards,three:cards.length===3,loaded,failed,...(changed?{previewCards:[],previewError:false}:{})})
   for(const card of cards)if(card.url&&!loaded[card.key]&&!failed[card.key])this.timerFor(card.key)
  },
  find(event){if(!this.valid())return null;const key=String(event?.currentTarget?.dataset?.key||'');return this.data.cards.find(c=>c.key===key)||null},
  onImageLoad(event){const card=this.find(event);if(!card)return;clearTimeout(this.__timers[card.key]);const failed={...this.data.failed};delete failed[card.key];this.setData({loaded:{...this.data.loaded,[card.key]:true},failed})},
  onImageError(event){const card=this.find(event);if(!card)return;clearTimeout(this.__timers[card.key]);this.setData({failed:{...this.data.failed,[card.key]:true}})},
  retryImage(event){const card=this.find(event);if(!card)return;if(!card.url){this.loadCatalog();return}const failed={...this.data.failed},loaded={...this.data.loaded};delete failed[card.key];delete loaded[card.key];this.setData({failed,loaded});this.timerFor(card.key)},
  openPreview(event){const card=this.find(event);if(!card?.url)return;wx.hideKeyboard?.();this.setData({previewCards:[card],previewIndex:this.data.cards.findIndex(c=>c.key===card.key),previewError:false,previewVisible:true,previewLoaded:false})},
  closePreview(){if(this.__alive)this.setData({previewCards:[],previewError:false})},
  nextPreview(){this.changePreview(1)},previousPreview(){this.changePreview(-1)},
  changePreview(offset){if(!this.valid())return;const index=this.data.previewIndex+offset,card=this.data.cards[index];if(card?.url)this.setData({previewCards:[card],previewIndex:index,previewError:false,previewVisible:true,previewLoaded:false})},
  onPreviewLoad(event){const card=this.find(event);if(card&&this.data.previewCards[0]?.key===card.key)this.setData({previewLoaded:true})},
  onPreviewError(event){const card=this.find(event);if(card&&this.data.previewCards[0]?.key===card.key)this.setData({previewError:true})},
  retryPreview(){if(!this.valid())return;this.setData({previewVisible:false,previewError:false,previewLoaded:false},()=>{if(this.valid())this.setData({previewVisible:true})})},
  copyCredit(){if(!this.valid())return;const credit=this.data.previewCards[0]?.credit;if(credit)wx.setClipboardData?.({data:[credit.title,credit.author,credit.license,credit.sourceUrl,credit.licenseUrl,'图片文件未修改；逆位为界面旋转显示。'].filter(Boolean).join('\n')})},
  stopTouch(){},
 },
})
