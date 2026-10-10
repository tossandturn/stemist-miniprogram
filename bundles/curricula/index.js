const {deviceState,syncDevice}=require('../../utils/page')
const {KNOWN_BOARDS,fetchCurriculumPapers}=require('./service')
const {fetchCatalog:fetchPracticeCatalog}=require('./practiceService')
const {createPdfDownloadController,formatBytes,initialPdfDownloadState}=require('../../utils/pdfDownload')

const filterOptions=(values,allLabel)=>[{value:'',label:allLabel},...(values||[]).map(value=>({value:String(value),label:String(value)}))]
const AP_VARIANTS=Object.freeze({standard:'标准卷','form-b':'Form B','released-exam':'历年考试整理','historical-collection':'历史整理',international:'国际卷','set-1':'Set 1','set-2':'Set 2','local-scan':'本地扫描','local-scan-form-obscured':'本地扫描 · 卷别未注明'})
const annotatedAnswer=value=>/批注参考答案/.test(String(value?.title||''))
const noOfficialAnswer=value=>/暂无官方答案/.test(String(value?.title||''))
const answerPresentation=(value,hasMarkScheme)=>{
 const annotated=hasMarkScheme&&annotatedAnswer(value)
 return{pairLabel:annotated?'附批注参考答案':value.pairStatus==='verified'&&hasMarkScheme?'原卷 / 评分标准已核对':value.pairStatus==='candidate'&&hasMarkScheme?'答案关联待核对':noOfficialAnswer(value)?'暂无官方答案':'未附答案',answerDocumentTitle:annotated?'批注参考答案':'评分标准',answerActionLabel:annotated?'查看批注参考答案':'查看评分标准',answerDownloadLabel:annotated?'批注参考答案':'评分标准',answerNotice:hasMarkScheme?'':noOfficialAnswer(value)?'这份原卷暂无官方答案。':'答案资料未收录，原卷仍可查看。'}
}
const displayPresentation=value=>{
 const board=String(value.board||''),rawVariant=String(value.variant||''),variant=board==='ap'?(AP_VARIANTS[rawVariant]||''):/^TZ[1-3]$/.test(rawVariant)?rawVariant:''
 const session=board==='ap'&&String(value.session||'').toLowerCase()==='annual'?'':String(value.session||'')
 const metaText=[value.year,session,value.paper,variant].filter(Boolean).join(' · ')
 const detailText=board==='ib'?[value.level].filter(Boolean).join(' · '):''
 const variantNote=board==='ib'&&/^TZ[1-3]$/.test(rawVariant)?'时区标签沿用来源文件':board==='ib'&&rawVariant==='unspecified'?'来源未标明时区版本':''
 return{metaText,detailText,variantNote}
}
const publicParam=value=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,100)

Page({
 data:deviceState({board:'',boardLabel:'',invalidBoard:false,course:'',courseOptions:[],courseIndex:0,level:'',levelOptions:[],levelIndex:0,year:'',yearOptions:[],yearIndex:0,session:'',sessionOptions:[],sessionIndex:0,paper:'',paperOptions:[],paperIndex:0,query:'',queryDraft:'',loading:false,catalog:false,error:'',items:[],summary:{papers:0,downloadable:0,sourceOnly:0},pageNumber:1,pageCount:0,total:0,practiceLoading:false,practiceRoutes:[],visiblePracticeRoutes:[],practiceExpanded:false,practiceHint:'',pdfBusy:'',pdfDownload:initialPdfDownloadState()}),
 onLoad(options={}){
  this.__disposed=false;this.__requestId=0;this.__practiceRequestId=0;this.__items=[];this.__practiceRoutes=[];this.setupPdfDownload()
  const board=publicParam(options.board).toLowerCase()
  if(!KNOWN_BOARDS[board]){this.setData({invalidBoard:true,error:'课程体系参数无效，请从首页重新进入。'});return Promise.resolve(false)}
  this.setData({board,boardLabel:KNOWN_BOARDS[board],course:publicParam(options.course),level:publicParam(options.level),year:publicParam(options.year),session:publicParam(options.session),paper:publicParam(options.paper),query:'',queryDraft:''})
  const loaded=this.loadCatalog(1);if(board==='ap')this.loadPracticeCatalog();return loaded
 },
 onShow(){syncDevice(this);this.syncPdfScope();this.__pdfDownload?.resume?.()},onResize(){syncDevice(this)},onHide(){this.__pdfDownload?.suspend()},onUnload(){this.__disposed=true;this.__requestId++;this.__practiceRequestId++;this.__pdfDownload?.dispose()},
 pdfScope(){return[this.__requestId||0,this.data.board,this.data.course,this.data.level,this.data.year,this.data.session,this.data.paper,this.data.query,this.data.pageNumber].join('|')},
 setupPdfDownload(){if(this.__pdfDownload)return;this.__pdfDownload=createPdfDownloadController({wxApi:wx,isScopeCurrent:scope=>!this.__disposed&&scope===this.pdfScope(),onState:state=>{if(!this.__disposed)this.setData({pdfDownload:state,pdfBusy:state.active?state.itemId:''})}});this.__pdfDownload.setScope(this.pdfScope())},
 syncPdfScope(){if(!this.__disposed)this.__pdfDownload?.setScope(this.pdfScope())},
 queryFilters(page=1){return{board:this.data.board,course:this.data.course,level:this.data.level,year:this.data.year,session:this.data.session,paper:this.data.paper,query:this.data.query,page}},
 retry(){return this.loadCatalog(this.data.pageNumber||1)},
 async loadCatalog(page=1){
  if(!KNOWN_BOARDS[this.data.board])return false
  const request=++this.__requestId,filters=this.queryFilters(Math.max(1,Number(page)||1));this.syncPdfScope();this.__items=[];this.setData({loading:true,catalog:false,error:'',items:[],pdfBusy:''})
  try{
   const result=await fetchCurriculumPapers(filters);if(this.__disposed||request!==this.__requestId)return false
   this.__items=result.items
   const items=result.items.map(value=>{
    const qp=value.questionPaper,ms=value.markScheme
    const canDownloadQp=value.availability==='downloadable'&&qp.availability==='downloadable'&&Boolean(qp.downloadUrl),canDownloadMs=Boolean(ms&&ms.availability==='downloadable'&&ms.downloadUrl),sourceOnly=!canDownloadQp
    const meta=document=>[document?.pages?document.pages+' 页':'',document?.bytes?formatBytes(document.bytes):''].filter(Boolean).join(' · '),notice=String(value.notice||''),displayNotice=sourceOnly?'公开分发授权尚未确认。':/[\u4e00-\u9fff]/.test(notice)&&!/[A-Za-z]{4}/.test(notice)?notice:''
    return{id:value.id,board:value.board,title:value.title||value.courseLabel,courseLabel:value.courseLabel,subject:value.subject,level:value.level,year:value.year,session:value.session,paper:value.paper,variant:value.variant,...displayPresentation(value),section:value.section,fullExam:value.fullExam,...answerPresentation(value,Boolean(ms)),pairStatus:value.pairStatus,hasMarkScheme:Boolean(ms),displayNotice,sourceOnly,availabilityMessage:sourceOnly?'资料已整理，暂未开放下载':'可查看已开放的 PDF',canDownloadQp,canDownloadMs,qpSourceUrl:qp.sourceUrl||'',msSourceUrl:ms?.sourceUrl||'',sourceLinkLabel:value.board==='ap'?'复制 AP 官方链接':'复制来源链接',qpMeta:meta(qp),msMeta:meta(ms)}
   })
   const keep=(options,current)=>{if(current&&!options.some(option=>option.value===current))options.push({value:current,label:current});return options}
   const courseOptions=keep([{value:'',label:'全部课程'},...result.courses.map(course=>({value:course.id,label:course.label}))],this.data.course),levelOptions=keep(filterOptions(result.filters.levels,'全部级别'),this.data.level),yearOptions=keep(filterOptions(result.filters.years,'全部年份'),this.data.year),sessionOptions=keep(filterOptions(result.filters.sessions,'全部考试季'),this.data.session),paperOptions=keep(filterOptions(result.filters.papers,'全部卷型'),this.data.paper)
   this.setData({catalog:true,items,summary:result.summary,total:result.total,pageNumber:result.page,pageCount:result.pages,courseOptions,courseIndex:Math.max(0,courseOptions.findIndex(option=>option.value===this.data.course)),levelOptions,levelIndex:Math.max(0,levelOptions.findIndex(option=>option.value===this.data.level)),yearOptions,yearIndex:Math.max(0,yearOptions.findIndex(option=>option.value===this.data.year)),sessionOptions,sessionIndex:Math.max(0,sessionOptions.findIndex(option=>option.value===this.data.session)),paperOptions,paperIndex:Math.max(0,paperOptions.findIndex(option=>option.value===this.data.paper))})
   return true
  }catch(error){if(!this.__disposed&&request===this.__requestId)this.setData({catalog:false,error:error?.code==='invalid_board'?'课程体系参数无效，请从首页重新进入。':error?.message||'真题目录暂时无法加载，请重试。'});return false}
  finally{if(!this.__disposed&&request===this.__requestId)this.setData({loading:false})}
 },
 async loadPracticeCatalog(){const request=++this.__practiceRequestId;this.setData({practiceLoading:true,practiceRoutes:[],visiblePracticeRoutes:[],practiceExpanded:false,practiceHint:''});try{const catalog=await fetchPracticeCatalog();if(this.__disposed||request!==this.__practiceRequestId)return false;this.__practiceRoutes=catalog.routes.filter(route=>route.questionCount>0);this.setData({practiceRoutes:this.__practiceRoutes.map(route=>({id:route.id,course:route.course,label:route.label,questionCount:route.questionCount,topicCount:route.topics.filter(topic=>topic.questionCount>0).length}))});this.syncPracticeRoutes(true);return true}catch{return false}finally{if(!this.__disposed&&request===this.__practiceRequestId)this.setData({practiceLoading:false})}},
 syncPracticeRoutes(collapse=false){const selected=String(this.data.course||''),visible=(this.data.practiceRoutes||[]).filter(route=>!selected||route.course===selected),courseCount=new Set(visible.map(route=>route.course)).size;this.setData({visiblePracticeRoutes:visible,practiceExpanded:collapse||!visible.length?false:Boolean(this.data.practiceExpanded),practiceHint:selected?'当前课程有已开放练习':courseCount+' 门课程有已开放练习'})},
 togglePractice(){if(!this.data.visiblePracticeRoutes.length)return;this.setData({practiceExpanded:!this.data.practiceExpanded})},
 openPractice(event){const route=String(event.currentTarget?.dataset?.route||''),item=(this.data.visiblePracticeRoutes||[]).find(value=>value.id===route);if(!item||item.questionCount<=0)return;wx.navigateTo({url:'/bundles/curricula/practice?routeId='+encodeURIComponent(route)})},
 chooseCourse(event){const option=this.data.courseOptions[Number(event.detail?.value)];if(!option||this.data.loading)return;this.setData({course:option.value,level:'',levelIndex:0,year:'',yearIndex:0,session:'',sessionIndex:0,paper:'',paperIndex:0});this.syncPracticeRoutes(true);return this.loadCatalog(1)},
 chooseFilter(event){const key=String(event.currentTarget?.dataset?.filter||''),map={level:'levelOptions',year:'yearOptions',session:'sessionOptions',paper:'paperOptions'};if(!map[key]||this.data.loading)return;const option=this.data[map[key]][Number(event.detail?.value)];if(!option)return;this.setData({[key]:option.value});return this.loadCatalog(1)},
 onQuery(event){this.setData({queryDraft:String(event.detail?.value||'').slice(0,120)})},
 applySearch(){if(this.data.loading)return;this.setData({query:this.data.queryDraft});return this.loadCatalog(1)},
 clearSearch(){if(this.data.loading)return;this.setData({query:'',queryDraft:''});return this.loadCatalog(1)},
 clearFilters(){if(this.data.loading)return;this.setData({course:'',level:'',year:'',session:'',paper:'',query:'',queryDraft:''});this.syncPracticeRoutes(true);return this.loadCatalog(1)},
 previousPage(){if(this.data.loading||this.data.pageNumber<=1)return;return this.loadCatalog(this.data.pageNumber-1).then(()=>{if(!this.__disposed)wx.pageScrollTo?.({scrollTop:0,duration:0})})},
 nextPage(){if(this.data.loading||this.data.pageNumber>=this.data.pageCount)return;return this.loadCatalog(this.data.pageNumber+1).then(()=>{if(!this.__disposed)wx.pageScrollTo?.({scrollTop:0,duration:0})})},
 findDocument(event){const item=(this.__items||[]).find(value=>value.id===String(event.currentTarget?.dataset?.id||'')),kind=event.currentTarget?.dataset?.kind==='ms'?'ms':'qp';return{item,kind,document:kind==='ms'?item?.markScheme:item?.questionPaper}},
 openPdf(event){const {item,kind,document}=this.findDocument(event);if(!item||!document||this.data.loading)return;if(item.availability!=='downloadable'||document.availability!=='downloadable'||!document.downloadUrl)return this.setData({error:'资料已整理，暂未开放下载。'});this.setupPdfDownload();this.syncPdfScope();if(this.data.pdfDownload?.active)return;this.setData({error:''});const answer=answerPresentation(item,Boolean(item.markScheme));return this.__pdfDownload.open({url:document.downloadUrl,cacheKey:document.sha256||document.id,cacheScope:'identity',cacheVersion:document.sha256||document.id,ownerKey:item.id+':'+kind,itemId:item.id,label:item.courseLabel+' · '+(kind==='ms'?answer.answerDownloadLabel:'原卷'),fileName:document.name,expectedBytes:document.bytes,sha256:document.sha256,scope:this.pdfScope()})},
 copySource(event){const {item,kind,document}=this.findDocument(event),url=String(document?.sourceUrl||'');if(!item||!url)return this.setData({error:'这份资料暂未提供可复制的公开来源链接。'});wx.setClipboardData({data:url,success:()=>{if(!this.__disposed)wx.showToast?.({title:item.board==='ap'?'AP 官方链接已复制':'来源链接已复制',icon:'none'})},fail:()=>{if(!this.__disposed)this.setData({error:'链接复制失败，请重试。'})}})},
 cancelPdfDownload(){this.__pdfDownload?.cancel()},retryPdfDownload(){return this.__pdfDownload?.retry()},togglePdfDownloadProgress(){this.__pdfDownload?.toggleCollapsed()},
 sharePath(){const params=[['board',this.data.board],['course',this.data.course],['level',this.data.level],['year',this.data.year],['session',this.data.session],['paper',this.data.paper]].filter(([,value])=>publicParam(value)).map(([key,value])=>encodeURIComponent(key)+'='+encodeURIComponent(publicParam(value)));return'/bundles/curricula/index?'+params.join('&')},
 onShareAppMessage(){return{title:'STEMist · '+this.data.boardLabel+' 真题资料',path:this.sharePath(),imageUrl:'/design-system/share-card.png'}},
 onShareTimeline(){const value=this.onShareAppMessage();return{title:value.title,query:value.path.split('?')[1]||''}},
})
