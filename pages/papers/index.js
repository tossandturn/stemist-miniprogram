const {deviceState,syncDevice}=require('../../utils/page')
const {PAPER_SUBJECTS,fetchPaperPage}=require('../../utils/paperCatalog')
const {normalizeStemCategory,subjectsForCategory,categoryForSubject}=require('../../utils/stemCatalog')
const {STEM_ROUTES,routeById}=require('../../utils/stemRoutes')
const LABELS={as:'AS',a2:'A2',igcse:'IGCSE',competition:'竞赛',admissions:'入学考试'}
const scopes=category=>PAPER_SUBJECTS.filter(item=>subjectsForCategory(category).some(s=>s.code===item.code))
const choices=(subject,stage='all')=>STEM_ROUTES.filter(route=>route.subjectCode===subject&&(stage==='all'||route.stage.toLowerCase()===stage))
Page({
 data:deviceState({category:'alevel',categoryLabel:'学科真题',showStageFilter:true,subjects:scopes('alevel'),subject:'9702',subjectIndex:0,stageFilters:[],stage:'all',stageIndex:0,routeOptions:[],routeIndex:0,routeId:'',family:'exam',query:'',loading:false,error:'',catalog:false,items:[],totalQuestionPapers:0,pairedQuestionPapers:0,matchCount:0,hasMore:false,pageNumber:1,pageCount:0,pdfBusy:'',mode:'past-paper-practice'}),
 onLoad(options={}){
  this.__requestId=0;this.__disposed=false;this.__pageItems=[]
  const incoming=routeById(String(options.routeId||'')),requested=String(options.subject||options.subjectCode||incoming?.subjectCode||''),category=normalizeStemCategory(options.category||(requested?categoryForSubject(requested):'alevel')),subjects=scopes(category),subject=subjects.find(item=>item.code===requested)||subjects[0]
  const stage=String(options.stage||incoming?.stage||'all').toLowerCase()
  this.setData({category,categoryLabel:category==='competition'?'竞赛与入学真题':'学科真题',showStageFilter:category!=='competition',subjects,mode:options.mode==='exam-simulation'?'exam-simulation':'past-paper-practice'})
  if(requested&&subject.code!==requested||options.routeId&&!incoming||incoming&&(incoming.subjectCode!==subject.code||stage!=='all'&&incoming.stage.toLowerCase()!==stage)){this.setData({error:'课程与阶段不匹配，请返回重新选择。'});return}
  this.setScope(subject.code,stage,incoming?.routeId||'');return this.loadCatalog()
 },
 onShow(){syncDevice(this)},onResize(){syncDevice(this)},onUnload(){this.__disposed=true;this.__requestId++;clearTimeout(this.__searchTimer)},
 setScope(subject,stage='all',routeId=''){
  const available=choices(subject),stages=[...new Set(available.map(r=>r.stage.toLowerCase()))]
  const selected=stages.includes(stage)?stage:'all',stageFilters=[{id:'all',label:'全部阶段'},...stages.map(id=>({id,label:LABELS[id]}))]
  const routeOptions=[{routeId:'',label:'全部课程路线'},...choices(subject,selected).map(r=>({routeId:r.routeId,label:r.stage+' · '+r.components}))]
  if(!routeId&&routeOptions.length===2)routeId=routeOptions[1].routeId
  this.__pageItems=[]
  this.setData({subject,subjectIndex:this.data.subjects.findIndex(s=>s.code===subject),stage:selected,scopeStage:available.find(r=>r.stage.toLowerCase()===selected)?.stage||'',stageFilters,stageIndex:stageFilters.findIndex(s=>s.id===selected),routeId,routeOptions,showRouteFilter:stages.some(s=>choices(subject,s).length>1),routeIndex:Math.max(0,routeOptions.findIndex(r=>r.routeId===routeId)),family:stages[0]==='admissions'?'admissions':this.data.category==='competition'?'competition':'exam',catalog:false,items:[]})
 },
 chooseSubject(event){const index=event.detail?.value!==undefined?Number(event.detail.value):this.data.subjects.findIndex(s=>s.code===event.currentTarget?.dataset?.subject),subject=this.data.subjects[index];if(!subject)return;this.setScope(subject.code);this.setData({query:''});return this.loadCatalog()},
 chooseStage(event){const option=this.data.stageFilters[Number(event.detail?.value)];if(!option||!this.data.showStageFilter)return;this.setScope(this.data.subject,option.id);return this.loadCatalog()},
 chooseRoute(event){const option=this.data.routeOptions[Number(event.detail.value)];if(!option)return;const route=routeById(option.routeId);this.setScope(this.data.subject,route?.stage.toLowerCase()||this.data.stage,option.routeId);return this.loadCatalog()},
 onSearch(event){this.setData({query:String(event.detail.value||'').slice(0,120)});clearTimeout(this.__searchTimer);this.__searchTimer=setTimeout(()=>{if(!this.__disposed)this.loadCatalog()},180)},
 clearSearch(){clearTimeout(this.__searchTimer);this.setData({query:''});return this.loadCatalog()},
 retry(){return this.loadCatalog()},
 async loadCatalog(page=1){
  const request=++this.__requestId,scope={subject:this.data.subject,stage:this.data.stage,routeId:this.data.routeId,query:this.data.query,page:typeof page==='number'?page:1}
  clearTimeout(this.__searchTimer);this.setData({loading:true,error:'',pdfBusy:''})
  try{
   const result=await fetchPaperPage(scope);if(this.__disposed||request!==this.__requestId)return
   this.__pageItems=result.items
   const items=result.items.map(item=>({id:item.id,year:item.year,displayTitle:item.file.replace(/\.pdf$/i,'').replace(/[_-]+/g,' '),stageLabel:item.stages.map(s=>LABELS[s]).filter(Boolean).join(' · '),title:item.title,paperNumber:item.paperNumber,canPractice:item.routeIds.length>0,hasMarkScheme:Boolean(item.markScheme),hasPdf:Boolean(item.localUrl),pairLabel:item.markScheme?'含参考答案':''}))
   this.setData({catalog:true,items,matchCount:result.total,totalQuestionPapers:result.subjectTotal,pairedQuestionPapers:result.pairedTotal,pageNumber:result.page,pageCount:result.pageCount,hasMore:result.page<result.pageCount})
  }catch(error){if(!this.__disposed&&request===this.__requestId)this.setData({error:error.statusCode===404?'真题目录正在更新，请稍后重试。':'真题暂时无法加载，请重试。'})}
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
  const item=this.__pageItems.find(p=>p.id===String(event.currentTarget.dataset.id||'')),document=event.currentTarget.dataset.kind==='ms'?item?.markScheme:item
  if(!document||this.data.pdfBusy||this.data.loading)return
  const url=String(document.localUrl||'');if(!url.startsWith('/local-pdf/'+item.subject+'/')||/\.\.|[?#]|%2e|%2f|%5c/i.test(url))return this.setData({error:'试卷文件暂不可用。'})
  const generation=this.__requestId;this.setData({pdfBusy:item.id,error:''})
  const active=()=>!this.__disposed&&generation===this.__requestId
  wx.downloadFile({url:'https://stem.ieltsist.com'+url,timeout:30000,success:result=>{if(!active())return;if(result.statusCode!==200)return this.setData({pdfBusy:'',error:'试卷下载失败，请重试。'});wx.openDocument({filePath:result.tempFilePath,fileType:'pdf',showMenu:true,fail:()=>{if(active())this.setData({error:'PDF 暂时无法打开，请重试。'})},complete:()=>{if(active())this.setData({pdfBusy:''})}})},fail:()=>{if(active())this.setData({pdfBusy:'',error:'试卷下载失败，请检查网络。'})}})
 },
})
