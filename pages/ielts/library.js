const {deviceState,syncDevice}=require('../../utils/page')
const {loadIeltsContent,catalogPage}=require('../../utils/ieltsContent')
const TITLES={listening:'Listening',reading:'Reading',writing:'Writing',speaking:'Speaking'}
Page({
 data:deviceState({module:'listening',title:'Listening',loading:true,error:'',items:[],total:0,page:0,pageCount:0,query:'',books:[],book:0,bookIndex:0}),
 onLoad(options={}){this.__disposed=false;this.__generation=0;const module=TITLES[options.module]?options.module:'listening';this.setData({module,title:TITLES[module]});this.load()},
 onShow(){syncDevice(this)},onResize(){syncDevice(this)},onUnload(){this.__disposed=true;this.__generation++;clearTimeout(this.__searchTimer)},
 async load(){const generation=++this.__generation;this.setData({loading:true,error:''});try{const data=await loadIeltsContent();if(this.__disposed||generation!==this.__generation)return;this.__tasks=data[this.data.module];const books=[{value:0,label:'全部书册'},...[...new Set(this.__tasks.map(t=>t.book).filter(Boolean))].sort((a,b)=>b-a).map(value=>({value,label:'Cambridge '+value}))];this.setData({books});this.render()}catch(e){if(!this.__disposed)this.setData({error:e.message})}finally{if(!this.__disposed&&generation===this.__generation)this.setData({loading:false})}},
 render(){if(!this.__tasks)return;this.setData(catalogPage(this.__tasks,this.data))},
 search(event){this.setData({query:String(event.detail.value||''),page:0});clearTimeout(this.__searchTimer);this.__searchTimer=setTimeout(()=>{if(!this.__disposed)this.render()},180)},
 chooseBook(event){const bookIndex=Number(event.detail.value),book=this.data.books[bookIndex]?.value||0;this.setData({bookIndex,book,page:0});this.render()},
 previous(){this.setData({page:Math.max(0,this.data.page-1)});this.render();wx.pageScrollTo?.({scrollTop:0,duration:0})},
 next(){if(this.data.page+1>=this.data.pageCount)return;this.setData({page:this.data.page+1});this.render();wx.pageScrollTo?.({scrollTop:0,duration:0})},
 open(event){const id=String(event.currentTarget.dataset.id||'');if(!this.__tasks?.some(t=>t.id===id))return;wx.navigateTo({url:`/pages/ielts/${this.data.module}?taskId=${encodeURIComponent(id)}`,fail:()=>this.setData({error:'试题未能打开，请重试。'})})},
 back(){wx.navigateBack({fail:()=>wx.reLaunch({url:'/pages/practice/index?category=ielts'})})}
})
