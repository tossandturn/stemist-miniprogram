const {deviceState,syncDevice}=require('../../utils/page')
const {loadIeltsContent,catalogPage}=require('../../utils/ieltsContent')
const {libraryUnits}=require('../../utils/ieltsUnits')
const {writingPairs}=require('../../utils/ieltsWriting')
const {topicDirectory,topicIcon}=require('../../utils/ieltsTopics')
const TITLES={listening:'Listening',reading:'Reading',writing:'Writing',speaking:'Speaking'}
Page({
 data:deviceState({module:'listening',title:'Listening',loading:true,error:'',items:[],total:0,page:0,pageCount:0,query:'',books:[],book:0,bookIndex:0,scope:'paper',scopes:[{id:'paper',label:'整套'},{id:'section',label:'分段'},{id:'topic',label:'主题'}],topics:[],topic:'',topicIndex:0}),
 onLoad(options={}){this.__disposed=false;this.__generation=0;const module=TITLES[options.module]?options.module:'listening';this.setData({module,title:TITLES[module],...(module==='writing'?{scopes:[{id:'paper',label:'单题'},{id:'pair',label:'完整写作'}]}:{})});this.load()},
 onShow(){syncDevice(this)},onResize(){syncDevice(this)},onUnload(){this.__disposed=true;this.__generation++;clearTimeout(this.__searchTimer)},
 async load(){const generation=++this.__generation;this.setData({loading:true,error:''});try{const data=await loadIeltsContent();if(this.__disposed||generation!==this.__generation)return;this.__tasks=data[this.data.module];const books=[{value:0,label:'全部书册'},...[...new Set(this.__tasks.map(t=>t.book).filter(Boolean))].sort((a,b)=>b-a).map(value=>({value,label:'Cambridge '+value}))];this.setData({books});this.render()}catch(e){if(!this.__disposed)this.setData({error:e.message})}finally{if(!this.__disposed&&generation===this.__generation)this.setData({loading:false})}},
 render(){if(!this.__tasks)return;this.__units=this.data.module==='writing'&&this.data.scope==='pair'?writingPairs(this.__tasks).map(pair=>({...pair,source:'Cambridge IELTS',minutes:60,questions:[],questionCount:0,kind:'pair'})):libraryUnits(this.__tasks,this.data.scope,this.data.topic);const topics=topicDirectory(this.__tasks,this.data),directory=this.data.scope==='topic'&&!this.data.topic;const selected=topics.find(t=>t.key===this.data.topic);this.setData({...catalogPage(this.__units,this.data),...(directory?{items:[],pageCount:0}:{}),topics,topicLabel:selected?.label||this.data.topic,topicIcon:topicIcon(this.data.topic)})},
 chooseScope(event){const scope=String(event.currentTarget.dataset.scope||'');if(!this.data.scopes.some(s=>s.id===scope))return;this.setData({scope,page:0,topic:'',topicIndex:0});this.render()},
 chooseTopic(event){const key=event.currentTarget?.dataset?.key||this.data.topics[Number(event.detail?.value)]?.key;if(!this.data.topics.some(t=>t.key===key))return;this.setData({topic:key,page:0});this.render()},
 clearTopic(){this.setData({topic:'',page:0});this.render()},
 search(event){this.setData({query:String(event.detail.value||''),page:0});clearTimeout(this.__searchTimer);this.__searchTimer=setTimeout(()=>{if(!this.__disposed)this.render()},180)},
 chooseBook(event){const bookIndex=Number(event.detail.value),book=this.data.books[bookIndex]?.value||0;this.setData({bookIndex,book,page:0});this.render()},
 previous(){this.setData({page:Math.max(0,this.data.page-1)});this.render();wx.pageScrollTo?.({scrollTop:0,duration:0})},
 next(){if(this.data.page+1>=this.data.pageCount)return;this.setData({page:this.data.page+1});this.render();wx.pageScrollTo?.({scrollTop:0,duration:0})},
 open(event){const id=String(event.currentTarget.dataset.id||''),unit=this.__units?.find(t=>t.id===id);if(!unit)return;const url=unit.kind==='pair'?'/pages/ielts/writing-full?pairId='+encodeURIComponent(id):`/pages/ielts/${this.data.module}?taskId=${encodeURIComponent(unit.baseTaskId||id)}`+(unit.section?'&section='+unit.section:'');wx.navigateTo({url,fail:()=>this.setData({error:'试题未能打开，请重试。'})})},
 back(){wx.navigateBack({fail:()=>wx.reLaunch({url:'/pages/practice/index?category=ielts'})})}
})
