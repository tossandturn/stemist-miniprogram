const {deviceState,syncDevice}=require('../../utils/page')
const {PAPER_SUBJECTS,fetchPaperPage}=require('../../utils/paperCatalog')
const {normalizeStemCategory,subjectsForCategory,categoryForSubject}=require('../../utils/stemCatalog')
const {STEM_ROUTES,routeById}=require('../../utils/stemRoutes')
const {createPdfDownloadController,initialPdfDownloadState}=require('../../utils/pdfDownload')
const LABELS={as:'AS',a2:'A2',igcse:'IGCSE',competition:'竞赛',admissions:'入学考试'}
const SEASONS={spring:'春季（2–3月）',summer:'夏季（5–6月）',winter:'秋冬季（10–11月）'}
const scopes=category=>PAPER_SUBJECTS.filter(item=>subjectsForCategory(category).some(s=>s.code===item.code))
const choices=(subject,stage='all')=>STEM_ROUTES.filter(route=>route.subjectCode===subject&&(stage==='all'||route.stage.toLowerCase()===stage))
Page({
 data:deviceState({category:'alevel',categoryLabel:'学科真题',showStageFilter:true,subjects:scopes('alevel'),subject:'9702',subjectIndex:0,stageFilters:[],stage:'all',stageIndex:0,routeOptions:[],routeIndex:0,routeId:'',family:'exam',query:'',year:'all',season:'all',filterReady:false,yearOptions:[],seasonOptions:[],yearIndex:0,seasonIndex:0,loading:false,error:'',catalog:false,items:[],totalQuestionPapers:0,pairedQuestionPapers:0,matchCount:0,hasMore:false,pageNumber:1,pageCount:0,pdfBusy:'',pdfDownload:initialPdfDownloadState(),mode:'past-paper-practice'}),
 onLoad(options={}){
  this.__requestId=0;this.__disposed=false;this.__pageItems=[];this.setupPdfDownload()
  const incoming=routeById(String(options.routeId||'')),requested=String(options.subject||options.subjectCode||incoming?.subjectCode||''),category=normalizeStemCategory(options.category||(requested?categoryForSubject(requested):'alevel')),subjects=scopes(category),subject=subjects.find(item=>item.code===requested)||subjects[0]
  const stage=String(options.stage||incoming?.stage||'all').toLowerCase()
  this.setData({category,categoryLabel:category==='competition'?'竞赛与入学真题':'学科真题',showStageFilter:category!=='competition',subjects,year:String(options.year||'all'),season:String(options.season||'all').toLowerCase(),mode:options.mode==='exam-simulation'?'exam-simulation':'past-paper-practice'})
  if(requested&&subject.code!==requested||options.routeId&&!incoming||incoming&&(incoming.subjectCode!==subject.code||stage!=='all'&&incoming.stage.toLowerCase()!==stage)){this.setData({error:'课程与阶段不匹配，请返回重新选择。'});return}
  this.setScope(subject.code,stage,incoming?.routeId||'');return this.loadCatalog()
 },
 onShow(){syncDevice(this);this.syncPdfDownloadScope()},onResize(){syncDevice(this)},onHide(){this.__pdfDownload?.suspend()},onUnload(){this.__disposed=true;this.__requestId++;clearTimeout(this.__searchTimer);this.__pdfDownload?.dispose()},
 pdfScope(){return[this.__requestId||0,this.data.category,this.data.subject,this.data.stage,this.data.routeId,this.data.year,this.data.season,this.data.query,this.data.pageNumber].join('|')},
 setupPdfDownload(){
  if(this.__pdfDownload)return
  this.__pdfDownload=createPdfDownloadController({wxApi:wx,isScopeCurrent:scope=>!this.__disposed&&scope===this.pdfScope(),onState:state=>{if(!this.__disposed)this.setData({pdfDownload:state,pdfBusy:state.active?state.itemId:''})}})
  this.__pdfDownload.setScope(this.pdfScope())
 },
 syncPdfDownloadScope(){if(!this.__disposed)this.__pdfDownload?.setScope(this.pdfScope())},
 setScope(subject,stage='all',routeId=''){
  const available=choices(subject),stages=[...new Set(available.map(r=>r.stage.toLowerCase()))]
  const selected=stages.includes(stage)?stage:'all',stageFilters=[{id:'all',label:'全部阶段'},...stages.map(id=>({id,label:LABELS[id]}))]
  const routeOptions=[{routeId:'',label:'全部课程路线'},...choices(subject,selected).map(r=>({routeId:r.routeId,label:r.stage+' · '+r.components}))]
  if(!routeId&&routeOptions.length===2)routeId=routeOptions[1].routeId
  this.__pageItems=[]
  this.setData({subject,subjectIndex:this.data.subjects.findIndex(s=>s.code===subject),stage:selected,scopeStage:available.find(r=>r.stage.toLowerCase()===selected)?.stage||'',stageFilters,stageIndex:stageFilters.findIndex(s=>s.id===selected),routeId,routeOptions,showRouteFilter:stages.some(s=>choices(subject,s).length>1),routeIndex:Math.max(0,routeOptions.findIndex(r=>r.routeId===routeId)),family:stages[0]==='admissions'?'admissions':this.data.category==='competition'?'competition':'exam',catalog:false,items:[]});this.syncPdfDownloadScope()
 },
 chooseSubject(event){const index=event.detail?.value!==undefined?Number(event.detail.value):this.data.subjects.findIndex(s=>s.code===event.currentTarget?.dataset?.subject),subject=this.data.subjects[index];if(!subject)return;this.setScope(subject.code);this.setData({query:'',year:'all',season:'all',filterReady:false});return this.loadCatalog()},
 chooseStage(event){const option=this.data.stageFilters[Number(event.detail?.value)];if(!option||!this.data.showStageFilter)return;this.setScope(this.data.subject,option.id);return this.loadCatalog()},
 chooseRoute(event){const option=this.data.routeOptions[Number(event.detail.value)];if(!option)return;const route=routeById(option.routeId);this.setScope(this.data.subject,route?.stage.toLowerCase()||this.data.stage,option.routeId);return this.loadCatalog()},
 onSearch(event){this.setData({query:String(event.detail.value||'').slice(0,120)});this.syncPdfDownloadScope();clearTimeout(this.__searchTimer);this.__searchTimer=setTimeout(()=>{if(!this.__disposed)this.loadCatalog()},180)},
 clearSearch(){clearTimeout(this.__searchTimer);this.setData({query:''});return this.loadCatalog()},
 chooseYear(event){const option=this.data.yearOptions[Number(event.detail.value)];if(!option)return;this.setData({year:option.value});return this.loadCatalog()},
 chooseSeason(event){const option=this.data.seasonOptions[Number(event.detail.value)];if(!option)return;this.setData({season:option.value});return this.loadCatalog()},
 clearFilters(){clearTimeout(this.__searchTimer);this.setData({query:'',year:'all',season:'all'});return this.loadCatalog()},
 retry(){return this.loadCatalog()},
 async loadCatalog(page=1){
  const request=++this.__requestId,scope={subject:this.data.subject,stage:this.data.stage,routeId:this.data.routeId,year:this.data.year,season:this.data.season,query:this.data.query,page:typeof page==='number'?page:1}
  this.syncPdfDownloadScope()
  clearTimeout(this.__searchTimer);this.__pageItems=[];this.setData({loading:true,error:'',pdfBusy:'',catalog:false,items:[]})
  try{
   const result=await fetchPaperPage(scope);if(this.__disposed||request!==this.__requestId)return
   this.__pageItems=result.items
   const items=result.items.map(item=>({id:item.id,year:item.year,seasonLabel:item.seasonLabel,displayTitle:item.file.replace(/\.pdf$/i,'').replace(/[_-]+/g,' '),stageLabel:item.stages.map(s=>LABELS[s]).filter(Boolean).join(' · '),title:item.title,paperNumber:item.paperNumber,canPractice:item.routeIds.length>0,hasMarkScheme:Boolean(item.markScheme),hasPdf:Boolean(item.localUrl),pairLabel:item.markScheme?'含参考答案':''}))
   const yearOptions=[{value:'all',label:'全部年份'},...(result.facets?.years||[]).map(year=>({value:String(year),label:String(year)}))],seasonOptions=[{value:'all',label:this.data.category==='competition'?'全部场次':'全部考试季'},...(result.facets?.seasons||[])]
   if(this.data.year!=='all'&&!yearOptions.some(o=>o.value===this.data.year))yearOptions.push({value:this.data.year,label:this.data.year})
   if(this.data.season!=='all'&&!seasonOptions.some(o=>o.value===this.data.season))seasonOptions.push({value:this.data.season,label:SEASONS[this.data.season]||this.data.season})
   this.setData({catalog:true,items,filterReady:Boolean(result.facets),yearOptions,seasonOptions,yearIndex:yearOptions.findIndex(o=>o.value===this.data.year),seasonIndex:seasonOptions.findIndex(o=>o.value===this.data.season),matchCount:result.total,totalQuestionPapers:result.subjectTotal,pairedQuestionPapers:result.pairedTotal,pageNumber:result.page,pageCount:result.pageCount,hasMore:result.page<result.pageCount})
  }catch(error){if(!this.__disposed&&request===this.__requestId)this.setData({error:error.statusCode===404?'真题目录正在更新，请稍后重试。':error.message||'真题暂时无法加载，请重试。'})}
  finally{if(!this.__disposed&&request===this.__requestId)this.setData({loading:false})}
 },
 async loadMore(){if(!this.data.hasMore||this.data.loading)return;await this.loadCatalog(this.data.pageNumber+1);if(!this.__disposed)wx.pageScrollTo?.({scrollTop:0,duration:0})},
 async previousPage(){if(this.data.pageNumber<=1||this.data.loading)return;await this.loadCatalog(this.data.pageNumber-1);if(!this.__disposed)wx.pageScrollTo?.({scrollTop:0,duration:0})},
 openPaper(event){
  if(this.data.loading)return
  const item=(this.__pageItems||[]).find(p=>p.id===String(event.currentTarget.dataset.id||''));if(!item)return
  const matches=choices(item.subject,this.data.stage).filter(route=>item.stages.includes(route.stage.toLowerCase())&&item.routeIds.includes(route.routeId)&&(!this.data.routeId||route.routeId===this.data.routeId))
  const open=route=>{if(!route||this.__disposed)return;wx.navigateTo({url:'/pages/stem/paper?subject='+encodeURIComponent(item.subject)+'&routeId='+encodeURIComponent(route.routeId)+'&stage='+encodeURIComponent(route.stage)+'&paperId='+encodeURIComponent(item.id)+'&mode='+encodeURIComponent(this.data.mode),fail:()=>{if(!this.__disposed)this.setData({error:'练习暂时无法打开，请重试。'})}})}
  if(!matches.length)return this.setData({error:'这份原卷尚未关联当前课程，可先查看原卷。'})
  if(matches.length===1)return open(matches[0])
  wx.showActionSheet({itemList:matches.map(r=>r.stage+' · '+r.components),success:result=>open(matches[result.tapIndex])})
 },
 openPdf(event){
  const item=(this.__pageItems||[]).find(p=>p.id===String(event.currentTarget.dataset.id||'')),kind=event.currentTarget.dataset.kind==='ms'?'ms':'qp',document=kind==='ms'?item?.markScheme:item
  if(!document||this.data.loading)return
  this.setupPdfDownload();this.syncPdfDownloadScope();if(this.data.pdfDownload?.active)return
  if(kind==='ms'&&this.data.mode==='exam-simulation')return
  const url=String(document.localUrl||'');if(!url.startsWith('/local-pdf/'+item.subject+'/')||/\.\.|[?#]|%2e|%2f|%5c/i.test(url))return this.setData({error:'试卷文件暂不可用。'})
  this.setData({error:''})
  return this.__pdfDownload.open({url:'https://stem.ieltsist.com'+url,cacheKey:'https://stem.ieltsist.com'+url,ownerKey:item.id+':'+kind,itemId:item.id,label:kind==='ms'?'参考答案':'原卷',scope:this.pdfScope()})
 },
 cancelPdfDownload(){this.__pdfDownload?.cancel()},retryPdfDownload(){return this.__pdfDownload?.retry()},togglePdfDownloadProgress(){this.__pdfDownload?.toggleCollapsed()},
})
