const {deviceState,syncDevice}=require('../../utils/page')
const {KNOWN_BOARDS,fetchCurriculumPapers}=require('./service')
const {createPdfDownloadController,formatBytes,initialPdfDownloadState}=require('../../utils/pdfDownload')

const filterOptions=(values,allLabel)=>[{value:'',label:allLabel},...(values||[]).map(value=>({value:String(value),label:String(value)}))]
const pairLabel=(status,hasMarkScheme)=>status==='verified'&&hasMarkScheme?'QP / MS 已核对':status==='candidate'&&hasMarkScheme?'答案关联待核对':'缺评分标准'
const publicParam=value=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,100)

Page({
 data:deviceState({board:'',boardLabel:'',invalidBoard:false,course:'',courseOptions:[],courseIndex:0,level:'',levelOptions:[],levelIndex:0,year:'',yearOptions:[],yearIndex:0,session:'',sessionOptions:[],sessionIndex:0,paper:'',paperOptions:[],paperIndex:0,query:'',queryDraft:'',loading:false,catalog:false,error:'',items:[],summary:{papers:0,downloadable:0,sourceOnly:0},pageNumber:1,pageCount:0,total:0,pdfBusy:'',pdfDownload:initialPdfDownloadState()}),
 onLoad(options={}){
  this.__disposed=false;this.__requestId=0;this.__items=[];this.setupPdfDownload()
  const board=publicParam(options.board).toLowerCase()
  if(!KNOWN_BOARDS[board]){this.setData({invalidBoard:true,error:'课程体系参数无效，请从首页重新进入。'});return Promise.resolve(false)}
  this.setData({board,boardLabel:KNOWN_BOARDS[board],course:publicParam(options.course),level:publicParam(options.level),year:publicParam(options.year),session:publicParam(options.session),paper:publicParam(options.paper),query:'',queryDraft:''})
  return this.loadCatalog(1)
 },
 onShow(){syncDevice(this);this.syncPdfScope()},onResize(){syncDevice(this)},onHide(){this.__pdfDownload?.suspend()},onUnload(){this.__disposed=true;this.__requestId++;this.__pdfDownload?.dispose()},
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
    return{id:value.id,board:value.board,title:value.title||value.courseLabel,courseLabel:value.courseLabel,subject:value.subject,level:value.level,year:value.year,session:value.session,paper:value.paper,variant:value.variant,variantNote:value.board==='ib'&&value.variant?'版本标签沿用来源文件':'',section:value.section,fullExam:value.fullExam,pairLabel:pairLabel(value.pairStatus,Boolean(ms)),pairStatus:value.pairStatus,hasMarkScheme:Boolean(ms),displayNotice,sourceOnly,availabilityMessage:sourceOnly?'资料已整理，暂未开放下载':'可查看已开放的 PDF',canDownloadQp,canDownloadMs,qpSourceUrl:qp.sourceUrl||'',msSourceUrl:ms?.sourceUrl||'',sourceLinkLabel:value.board==='ap'?'复制 AP 官方链接':'复制来源链接',qpMeta:meta(qp),msMeta:meta(ms)}
   })
   const keep=(options,current)=>{if(current&&!options.some(option=>option.value===current))options.push({value:current,label:current});return options}
   const courseOptions=keep([{value:'',label:'全部课程'},...result.courses.map(course=>({value:course.id,label:course.label}))],this.data.course),levelOptions=keep(filterOptions(result.filters.levels,'全部级别'),this.data.level),yearOptions=keep(filterOptions(result.filters.years,'全部年份'),this.data.year),sessionOptions=keep(filterOptions(result.filters.sessions,'全部考试季'),this.data.session),paperOptions=keep(filterOptions(result.filters.papers,'全部卷型'),this.data.paper)
   this.setData({catalog:true,items,summary:result.summary,total:result.total,pageNumber:result.page,pageCount:result.pages,courseOptions,courseIndex:Math.max(0,courseOptions.findIndex(option=>option.value===this.data.course)),levelOptions,levelIndex:Math.max(0,levelOptions.findIndex(option=>option.value===this.data.level)),yearOptions,yearIndex:Math.max(0,yearOptions.findIndex(option=>option.value===this.data.year)),sessionOptions,sessionIndex:Math.max(0,sessionOptions.findIndex(option=>option.value===this.data.session)),paperOptions,paperIndex:Math.max(0,paperOptions.findIndex(option=>option.value===this.data.paper))})
   return true
  }catch(error){if(!this.__disposed&&request===this.__requestId)this.setData({catalog:false,error:error?.code==='invalid_board'?'课程体系参数无效，请从首页重新进入。':error?.message||'真题目录暂时无法加载，请重试。'});return false}
  finally{if(!this.__disposed&&request===this.__requestId)this.setData({loading:false})}
 },
 chooseCourse(event){const option=this.data.courseOptions[Number(event.detail?.value)];if(!option||this.data.loading)return;this.setData({course:option.value});return this.loadCatalog(1)},
 chooseFilter(event){const key=String(event.currentTarget?.dataset?.filter||''),map={level:'levelOptions',year:'yearOptions',session:'sessionOptions',paper:'paperOptions'};if(!map[key]||this.data.loading)return;const option=this.data[map[key]][Number(event.detail?.value)];if(!option)return;this.setData({[key]:option.value});return this.loadCatalog(1)},
 onQuery(event){this.setData({queryDraft:String(event.detail?.value||'').slice(0,120)})},
 applySearch(){if(this.data.loading)return;this.setData({query:this.data.queryDraft});return this.loadCatalog(1)},
 clearSearch(){if(this.data.loading)return;this.setData({query:'',queryDraft:''});return this.loadCatalog(1)},
 clearFilters(){if(this.data.loading)return;this.setData({course:'',level:'',year:'',session:'',paper:'',query:'',queryDraft:''});return this.loadCatalog(1)},
 previousPage(){if(this.data.loading||this.data.pageNumber<=1)return;return this.loadCatalog(this.data.pageNumber-1).then(()=>{if(!this.__disposed)wx.pageScrollTo?.({scrollTop:0,duration:0})})},
 nextPage(){if(this.data.loading||this.data.pageNumber>=this.data.pageCount)return;return this.loadCatalog(this.data.pageNumber+1).then(()=>{if(!this.__disposed)wx.pageScrollTo?.({scrollTop:0,duration:0})})},
 findDocument(event){const item=(this.__items||[]).find(value=>value.id===String(event.currentTarget?.dataset?.id||'')),kind=event.currentTarget?.dataset?.kind==='ms'?'ms':'qp';return{item,kind,document:kind==='ms'?item?.markScheme:item?.questionPaper}},
 openPdf(event){const {item,kind,document}=this.findDocument(event);if(!item||!document||this.data.loading)return;if(item.availability!=='downloadable'||document.availability!=='downloadable'||!document.downloadUrl)return this.setData({error:'资料已整理，暂未开放下载。'});this.setupPdfDownload();this.syncPdfScope();if(this.data.pdfDownload?.active)return;this.setData({error:''});return this.__pdfDownload.open({url:document.downloadUrl,cacheKey:document.sha256||document.id,cacheScope:'identity',cacheVersion:document.sha256||document.id,ownerKey:item.id+':'+kind,itemId:item.id,label:item.courseLabel+' · '+(kind==='ms'?'评分标准':'原卷'),fileName:document.name,scope:this.pdfScope()})},
 copySource(event){const {item,kind,document}=this.findDocument(event),url=String(document?.sourceUrl||'');if(!item||!url)return this.setData({error:'这份资料暂未提供可复制的公开来源链接。'});wx.setClipboardData({data:url,success:()=>{if(!this.__disposed)wx.showToast?.({title:item.board==='ap'?'AP 官方链接已复制':'来源链接已复制',icon:'none'})},fail:()=>{if(!this.__disposed)this.setData({error:'链接复制失败，请重试。'})}})},
 cancelPdfDownload(){this.__pdfDownload?.cancel()},retryPdfDownload(){return this.__pdfDownload?.retry()},togglePdfDownloadProgress(){this.__pdfDownload?.toggleCollapsed()},
 sharePath(){const params=[['board',this.data.board],['course',this.data.course],['level',this.data.level],['year',this.data.year],['session',this.data.session],['paper',this.data.paper]].filter(([,value])=>publicParam(value)).map(([key,value])=>encodeURIComponent(key)+'='+encodeURIComponent(publicParam(value)));return'/bundles/curricula/index?'+params.join('&')},
 onShareAppMessage(){return{title:'STEMist · '+this.data.boardLabel+' 真题资料',path:this.sharePath(),imageUrl:'/design-system/share-card.png'}},
 onShareTimeline(){const value=this.onShareAppMessage();return{title:value.title,query:value.path.split('?')[1]||''}},
})
