const {deviceState,syncDevice}=require('../../utils/page')
const {fetchCatalogue}=require('./ieltsAudioService')
const {createAudioDownloadController}=require('./audioDownload')
const {formatBytes}=require('../../utils/pdfDownload')
Page({
 ...require('../../utils/share').public,
 onShareAppMessage(){return{title:'STEMist · 听力音频下载',path:'/bundles/curricula/ieltsAudio',imageUrl:'/design-system/share-card.png'}},
 data:deviceState({loading:true,error:'',offline:false,books:[],book:0,bookIndex:0,taskFilter:'',items:[],total:0,page:0,pages:0,download:{active:false,sharing:false,ready:false,progress:null}}),
 onLoad(options={}){this.__disposed=false;this.__generation=0;this.__track=Number(options.track)||0;const taskFilter=/^cam\d+-l-test\d+$/.test(String(options.taskId||''))?String(options.taskId):'';this.setData({taskFilter,book:Number(options.book)||0});this.__download=createAudioDownloadController({onState:download=>{if(!this.__disposed)this.setData({download})}});return this.load()},
 scope(){return[this.data.book,this.data.taskFilter,this.data.page].join('|')},
 onShow(){syncDevice(this);this.__download?.setScope(this.scope())},onResize(){syncDevice(this)},onHide(){this.__download?.suspend()},onUnload(){this.__disposed=true;this.__generation++;this.__download?.dispose()},
 locked(){return this.data.download.active||this.data.download.sharing},
 async load(){if(this.locked())return;const generation=++this.__generation;this.setData({loading:true,error:''});try{const catalog=await fetchCatalogue();if(this.__disposed||generation!==this.__generation)return;this.__catalog=catalog;const books=catalog.books.map(value=>({value,label:'Cambridge '+value})),match=catalog.items.find(i=>i.taskId===this.data.taskFilter),wanted=match?.book||this.data.book,book=books.some(b=>b.value===wanted)?wanted:books[0]?.value||0;this.setData({books,book,bookIndex:Math.max(0,books.findIndex(b=>b.value===book)),page:0,offline:catalog.offline});this.render()}catch(error){if(!this.__disposed&&generation===this.__generation)this.setData({error:error.message||'音频目录暂时无法读取，请重试。'})}finally{if(!this.__disposed&&generation===this.__generation)this.setData({loading:false})}},
 render(){const list=(this.__catalog?.items||[]).filter(i=>i.book===this.data.book&&(!this.data.taskFilter||i.taskId===this.data.taskFilter)),pages=Math.ceil(list.length/8),page=Math.min(this.data.page,Math.max(0,pages-1));this.setData({page,pages,total:list.length,items:list.slice(page*8,page*8+8).map(i=>({...i,meta:'Cambridge '+i.book+' · Test '+i.test,trackLabel:i.trackCount===1?'完整音频':'音频 '+i.track+' / '+i.trackCount,sizeLabel:formatBytes(i.bytes),practiceNote:i.practiceTest!==i.test?'对应站内第 '+i.practiceTest+' 套':'',focused:!!this.data.taskFilter&&i.track===this.__track}))});this.__download?.setScope(this.scope())},
 chooseBook(event){if(this.locked())return;const index=Number(event.detail.value),book=this.data.books[index];if(!book)return;this.setData({book:book.value,bookIndex:index,page:0,taskFilter:''});this.render()},
 showAll(){if(this.locked())return;this.setData({taskFilter:'',page:0});this.render()},
 previous(){if(this.locked()||this.data.page<=0)return;this.setData({page:this.data.page-1});this.render();wx.pageScrollTo?.({scrollTop:0,duration:0})},
 next(){if(this.locked()||this.data.page+1>=this.data.pages)return;this.setData({page:this.data.page+1});this.render();wx.pageScrollTo?.({scrollTop:0,duration:0})},
 download(event){if(this.locked())return;const item=this.data.items.find(i=>i.id===event.currentTarget.dataset.id);if(item)return this.__download.download(item)},
 share(){return this.__download?.share()},cancel(){this.__download?.cancel()},retry(){return this.__download?.retry()},
 back(){wx.navigateBack({fail:()=>wx.reLaunch({url:'/pages/practice/index?category=ielts'})})}
})
