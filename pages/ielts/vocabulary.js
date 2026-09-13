const {deviceState,syncDevice}=require('../../utils/page')
const {vocabularyIndex,vocabularyDetail}=require('../../utils/nativeVocabulary')
const {requestIeltsLearning}=require('../../utils/ieltsLearning')
const {subjectLabel,identifier,inPack,packCards,subjectCards,isDue,wordView,notebookPayload,savedIds}=require('../../utils/vocabularyStudy')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
Page({
 data:deviceState({loading:true,error:'',view:'study',mode:'study',pack:'ielts',bank:'ielts',subject:'ielts',scopeLabel:'IELTS Core',query:'',items:[],total:0,page:0,pageCount:0,stages:[],stage:'',stageIndex:0,topics:[],topic:'',topicIndex:0,reviewOnly:false,word:null,revealed:true,expanded:false,detailBusy:false,status:'',mastered:0,due:0,savedCount:0,wordIndex:0,progressPercent:0,packs:[],subjects:[],filtersOpen:false,completed:false,saving:false,rating:false,saved:false,scopeLocked:false}),
 onLoad(options={}){
  this.__disposed=false;this.__owner=owner();this.__epoch=epoch();this.__key='stemistVocabProgress:'+this.__owner
  const stored=wx.getStorageSync(this.__key);this.__progress=stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{}
  this.__saved=new Set(wx.getStorageInfoSync().keys.filter(k=>k.startsWith('stemistSavedWord:'+this.__owner+':')).map(k=>k.slice(('stemistSavedWord:'+this.__owner+':').length)))
  this.__request=0;this.__index=[];this.__matched=[];this.__targetTerms=null
  if(options.termIds){try{const ids=JSON.parse(options.termIds);this.__targetTerms=new Set(Array.isArray(ids)?ids.filter(id=>typeof id==='string').slice(0,200).map(identifier):[])}catch{this.__targetTerms=new Set()}}
  const stem=options.bank==='stem';this.setData({bank:stem?'stem':'ielts',pack:stem?'alevel':'ielts',subject:stem?'':'ielts',view:stem&&!this.__targetTerms?'packs':'study',scopeLocked:Boolean(this.__targetTerms)})
  return this.load()
 },
 onShow(){syncDevice(this);if(this.__owner&&!this.current()){this.__request++;this.__word=null;this.setData({word:null,items:[],view:'study',loading:false,detailBusy:false,error:'账号已变化，请返回后重新打开词汇。'})}},
 onResize(){syncDevice(this)},onUnload(){this.__disposed=true;this.__request++;clearTimeout(this.__searchTimer)},
 current(){return !this.__disposed&&this.__owner===owner()&&this.__epoch===epoch()},
 async load(){if(!this.current())return;this.setData({loading:true,error:''});try{const index=await vocabularyIndex();if(!this.current())return;this.__index=index;this.setData({packs:packCards(index)});await this.filter();this.loadSaved()}catch(e){if(this.current())this.setData({error:e.message})}finally{if(this.current())this.setData({loading:false})}},
 async loadSaved(){
  if(this.__owner==='guest'||!wx.getStorageSync('stemistSessionToken'))return
  try{const data=await requestIeltsLearning('/api/vocabulary',undefined,{method:'GET'});if(!this.current())return;for(const id of savedIds(data.items,this.__index))this.__saved.add(id);this.updateCounts();if(this.data.mode==='saved'||this.data.mode==='due')this.filter();else if(this.data.word)this.setData({saved:this.__saved.has(this.data.word.id)})}catch{if(this.current())this.setData({status:'本机词汇可用，账号收藏暂未同步。'})}
 },
 scoped(){const query=identifier(this.data.query),global=Boolean(query)&&!this.__targetTerms;return this.__index.filter(item=>(!this.__targetTerms||this.__targetTerms.has(identifier(item.id)))&&(global||(this.__targetTerms?true:inPack(item,this.data.pack)))&&(global||!this.data.subject||item.subject===this.data.subject)&&(global||!this.data.stage||item.stage===this.data.stage)&&(global||!this.data.topic||item.topicLabel===this.data.topic)&&(!query||identifier(item.word+' '+item.meaning+' '+item.topicLabel).includes(query)))},
 updateCounts(){const pool=this.scoped(),now=Date.now();this.setData({mastered:pool.filter(i=>(this.__progress[i.id]?.level||0)>=3).length,due:pool.filter(i=>isDue(this.__progress,i.id,this.__saved,now)).length,savedCount:pool.filter(i=>this.__saved.has(i.id)).length})},
 async filter({retain=false}={}){
  if(!this.current())return
  const previous=this.data.word?.id;this.__request++;this.__word=null;const pool=this.scoped(),now=Date.now()
  this.__matched=pool.filter(i=>this.data.mode==='due'?isDue(this.__progress,i.id,this.__saved,now):this.data.mode==='saved'?this.__saved.has(i.id):true).sort((a,b)=>a.word.localeCompare(b.word))
  const subjectPool=this.__index.filter(i=>inPack(i,this.data.pack)&&(!this.data.subject||i.subject===this.data.subject))
  const stages=[{value:'',label:'全部阶段'},...[...new Set(subjectPool.map(i=>i.stage).filter(Boolean))].map(value=>({value,label:value}))]
  const topics=[{value:'',label:'全部主题'},...[...new Set(subjectPool.filter(i=>!this.data.stage||i.stage===this.data.stage).map(i=>i.topicLabel).filter(Boolean))].sort().map(value=>({value,label:value}))]
  const wordIndex=retain?Math.max(0,this.__matched.findIndex(i=>i.id===previous)):0
  this.setData({word:null,detailBusy:false,completed:false,wordIndex,stages,topics,stageIndex:Math.max(0,stages.findIndex(x=>x.value===this.data.stage)),topicIndex:Math.max(0,topics.findIndex(x=>x.value===this.data.topic)),subjects:subjectCards(this.__index,this.data.pack),scopeLabel:this.data.query?'全部词包搜索':this.__targetTerms?'当前题目词包':this.data.subject?subjectLabel(this.data.subject):(this.data.pack==='igcse'?'IGCSE 学科词汇':'A-Level 学科词汇')})
  this.updateCounts();this.render()
  if(this.data.view==='study'&&this.__matched.length)return this.showCard(wordIndex)
 },
 render(){const total=this.__matched.length,pageCount=Math.ceil(total/20),page=Math.max(0,Math.min(this.data.page,pageCount-1));this.setData({total,page,pageCount,items:this.data.view==='list'?this.__matched.slice(page*20,(page+1)*20).map(i=>({id:i.id,word:i.word,meaning:i.meaning,topicLabel:i.topicLabel})):[]})},
 async showCard(index){
  if(!this.current())return;const entry=this.__matched[index];if(!entry)return
  const request=++this.__request;this.__word=null;this.setData({word:null,detailBusy:true,error:'',wordIndex:index,completed:false,expanded:false,revealed:this.data.mode!=='recall',progressPercent:Math.round(index/Math.max(1,this.__matched.length)*100)})
  try{const item=await vocabularyDetail(entry.id);if(!this.current()||request!==this.__request)return;if(item.id!==entry.id)throw Error('词条与当前词包不一致。');this.__word=item;this.setData({word:wordView(item),saved:this.__saved.has(item.id),syncPending:wx.getStorageSync('stemistSavedWord:'+this.__owner+':'+item.id)?.syncPending===true})
   const next=this.__matched[index+1];if(next)vocabularyDetail(next.id).catch(()=>{})
  }catch(error){if(this.current()&&request===this.__request)this.setData({error:error.message})}finally{if(this.current()&&request===this.__request)this.setData({detailBusy:false})}
 },
 openPacks(){if(!this.current())return;this.closeWord();this.setData({view:'packs',items:[],query:'',scopeLocked:false});this.__targetTerms=null;this.filter()},
 choosePack(event){if(!this.current())return;const pack=event.currentTarget.dataset.pack;if(!['ielts','igcse','alevel','competition','admissions'].includes(pack))return;this.closeWord();this.__targetTerms=null;this.setData({pack,bank:pack==='ielts'?'ielts':'stem',subject:pack==='ielts'?'ielts':'',stage:'',topic:'',query:'',page:0,scopeLocked:false,view:pack==='ielts'?'study':'packs',mode:'study',reviewOnly:false,status:''});return this.filter()},
 chooseSubject(event){const subject=event.currentTarget.dataset.subject;if(!this.current()||!this.data.subjects.some(x=>x.id===subject))return;this.setData({subject,view:'study',stage:'',topic:'',page:0});return this.filter()},
 switchBank(event){return this.choosePack({currentTarget:{dataset:{pack:event.currentTarget.dataset.bank==='stem'?'alevel':'ielts'}}})},
 setMode(event){const mode=event.currentTarget.dataset.mode;if(!this.current()||!['study','recall','due','saved'].includes(mode))return;this.setData({mode,view:'study',reviewOnly:mode==='due',page:0,status:''});return this.filter({retain:true})},
 chooseStage(event){if(!this.current())return;this.setData({stage:this.data.stages[Number(event.detail.value)]?.value||'',topic:'',page:0});return this.filter()},
 chooseTopic(event){if(!this.current())return;this.setData({topic:this.data.topics[Number(event.detail.value)]?.value||'',page:0});return this.filter()},
 toggleFilters(){this.setData({filtersOpen:!this.data.filtersOpen})},
 search(event){if(!this.current())return;this.closeWord();this.setData({query:String(event.detail.value||''),view:'study',page:0});clearTimeout(this.__searchTimer);this.__searchTimer=setTimeout(()=>{if(this.current())this.filter()},180)},
 toggleReview(){return this.setMode({currentTarget:{dataset:{mode:this.data.mode==='due'?'study':'due'}}})},
 showList(){if(!this.current())return;this.closeWord();this.setData({view:'list'});this.render()},
 next(){if(this.data.view==='list'){if(this.data.page+1<this.data.pageCount){this.setData({page:this.data.page+1});this.render()}return}return this.showCard(Math.min(this.__matched.length-1,this.data.wordIndex+1))},
 previous(){if(this.data.view==='list'){if(this.data.page>0){this.setData({page:this.data.page-1});this.render()}return}return this.showCard(Math.max(0,this.data.wordIndex-1))},
 openWord(event){const index=this.__matched.findIndex(x=>x.id===String(event.currentTarget.dataset.id||''));if(index<0)return;this.setData({view:'study'});this.render();return this.showCard(index)},
 reveal(){if(this.current()&&this.data.word)this.setData({revealed:!this.data.revealed})},
 expand(){if(this.current())this.setData({expanded:!this.data.expanded})},
 closeWord(){this.__request++;this.__word=null;this.setData({word:null,detailBusy:false,status:''})},
 restart(){return this.filter()},
 async remember(event){
  if(!this.current()||!this.data.word||this.data.rating||this.data.detailBusy||this.data.mode==='recall'&&!this.data.revealed)return
  const id=this.data.word.id;if(event.currentTarget.dataset.id&&event.currentTarget.dataset.id!==id)return
  const known=event.currentTarget.dataset.known==='yes',level=known?Math.min(5,(this.__progress[id]?.level||0)+1):0,index=this.data.wordIndex
  this.setData({rating:true,status:known?'已记住，已安排下次复习':'已加入稍后复习'})
  try{this.__progress={...this.__progress,[id]:{...this.__progress[id],level,due:Date.now()+(known?[1,3,7,14,30][Math.max(0,level-1)]*86400000:600000),reviewedAt:Date.now()}};wx.setStorageSync(this.__key,this.__progress);this.updateCounts()
   if(index+1<this.__matched.length)await this.showCard(index+1);else{this.__request++;this.__word=null;this.setData({word:null,completed:true,progressPercent:100})}
  }catch(error){if(this.current())this.setData({error:error.message||'复习记录未能保存，请重试。'})}finally{if(this.current())this.setData({rating:false})}
 },
 async saveWord(){
  if(!this.__word||!this.current()||this.data.saving)return;const word=this.__word,id=word.id
  const key='stemistSavedWord:'+this.__owner+':'+id,shouldSync=this.__owner!=='guest'&&Boolean(wx.getStorageSync('stemistSessionToken'))
  this.setData({saving:true});try{wx.setStorageSync(key,{...word,syncPending:shouldSync});this.__saved.add(id);this.updateCounts();this.setData({saved:true,syncPending:shouldSync,status:'已收藏到本机'})
   if(shouldSync){await requestIeltsLearning('/api/vocabulary',notebookPayload(word));if(this.current()){wx.setStorageSync(key,{...word,syncPending:false});if(this.data.word?.id===id)this.setData({syncPending:false,status:'已收藏并同步网页端词汇本'})}}
  }catch{if(this.current()&&this.data.word?.id===id)this.setData({status:'本机收藏已保留，账号同步暂未完成。'})}finally{if(this.current())this.setData({saving:false})}
 },
 back(){wx.navigateBack()}
})
