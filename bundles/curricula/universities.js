const {deviceState,syncDevice}=require('../../utils/page')
const {fetchUniversityDirectory}=require('./universityService')
const {fetchProfileIndex,fetchProfile,profileAssetUrl}=require('./universityProfiles')

const PAGE_SIZE=20
const TABS=new Set(['rankings','official'])
const RANKING_IDS=new Set(['qs-world','usnews-national'])
const BOARD_IDS=new Set(['ap','ib','alevel'])
const clean=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,120)
const safeOption=(value,allowed,fallback)=>allowed.has(clean(value))?clean(value):fallback
const dateLabel=value=>String(value||'').slice(0,10)
const cachedLabel=value=>{const date=new Date(Number(value));if(!Number.isFinite(date.getTime()))return'';const pad=part=>String(part).padStart(2,'0');return`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`}
const rankingMeta=ranking=>ranking?{editionYear:ranking.editionYear,verifiedAt:dateLabel(ranking.verifiedAt),scopeLabel:ranking.scope==='world'?'全球大学':'美国综合大学',sourceUrl:ranking.sourceUrl,methodologyUrl:ranking.methodologyUrl}:null

Page({
 data:deviceState({activeTab:'rankings',loading:false,loaded:false,error:'',dataSource:'',cacheNotice:'',rankingOptions:[],rankingIndex:0,currentRankingId:'',currentRanking:null,queryDraft:'',query:'',filteredCount:0,visibleItems:[],pageNumber:1,pageCount:0,examBoards:[],selectedBoardId:'ap',currentBoard:null,expandedId:'',profileLoading:false,profileError:'',activeProfile:null}),
 onLoad(options={}){
  this.__disposed=false;this.__requestId=0;this.__rankings=[];this.__boards=[]
  this.__profileMap=new Map();this.__failedLogos=new Set();this.__detailToken=0
  this.__requestedRanking=safeOption(options.ranking,RANKING_IDS,'')
  const activeTab=safeOption(options.tab,TABS,'rankings'),selectedBoardId=safeOption(options.board,BOARD_IDS,'ap')
  this.setData({activeTab,selectedBoardId})
  return this.loadDirectory()
 },
 onShow(){syncDevice(this);if(this.__failedLogos?.size){this.__failedLogos.clear();this.refreshProfileCards()}},onResize(){syncDevice(this)},onUnload(){this.__disposed=true;this.__requestId++;this.__detailToken++},
 retry(){return this.loadDirectory()},
 async loadDirectory(){
  const requestId=++this.__requestId
  this.setData({loading:true,error:''})
  try{
   const result=await fetchUniversityDirectory()
   if(this.__disposed||requestId!==this.__requestId)return false
   this.__rankings=result.directory.rankings;this.__boards=result.directory.examBoards
   const requested=this.__requestedRanking&&this.__rankings.some(item=>item.id===this.__requestedRanking)?this.__requestedRanking:this.__rankings[0].id
   const boardId=this.__boards.some(item=>item.id===this.data.selectedBoardId)?this.data.selectedBoardId:this.__boards[0].id
   const rankingOptions=this.__rankings.map(item=>({id:item.id,label:item.label}))
   const rankingIndex=Math.max(0,rankingOptions.findIndex(item=>item.id===requested))
   this.setData({loaded:true,dataSource:result.source,cacheNotice:result.source==='cache'?`网络不可用，正在显示 ${cachedLabel(result.cachedAt)} 保存的缓存数据。`:'',rankingOptions,rankingIndex,currentRankingId:requested,currentRanking:rankingMeta(this.__rankings[rankingIndex]),examBoards:this.__boards,selectedBoardId:boardId,currentBoard:this.__boards.find(item=>item.id===boardId)||null,query:'',queryDraft:''})
   this.updateRankingList(1)
   if(this.data.activeTab==='rankings')this.loadProfileIndex()
   return true
  }catch(error){
   if(this.__disposed||requestId!==this.__requestId)return false
   const message=clean(error?.message)
   this.setData({loaded:false,error:/^暂时无法加载大学目录/.test(message)?message:'暂时无法加载大学目录，请稍后重试。',visibleItems:[],filteredCount:0,pageCount:0})
   return false
  }finally{if(!this.__disposed&&requestId===this.__requestId)this.setData({loading:false})}
 },
 chooseTab(event){const tab=safeOption(event?.currentTarget?.dataset?.tab,TABS,'');if(tab){if(tab!==this.data.activeTab){this.__detailToken++;this.setData({expandedId:'',activeProfile:null,profileLoading:false,profileError:''})}this.setData({activeTab:tab});if(tab==='rankings'&&!this.__profileMap?.size)this.loadProfileIndex()}},
 chooseRanking(event){
  const index=Number(event?.detail?.value)
  if(!Number.isSafeInteger(index)||index<0||index>=this.__rankings.length)return
  const ranking=this.__rankings[index]
  this.__requestedRanking=ranking.id
  this.setData({rankingIndex:index,currentRankingId:ranking.id,currentRanking:rankingMeta(ranking),query:'',queryDraft:''})
  this.updateRankingList(1)
 },
 onSearchInput(event){this.setData({queryDraft:clean(event?.detail?.value)})},
 applySearch(){this.setData({query:clean(this.data.queryDraft)},()=>this.updateRankingList(1))},
 clearSearch(){this.setData({query:'',queryDraft:''},()=>this.updateRankingList(1))},
 updateRankingList(page=1){
  this.__detailToken++;this.setData({expandedId:'',profileLoading:false,profileError:'',activeProfile:null})
  const ranking=this.__rankings.find(item=>item.id===this.data.currentRankingId)
  if(!ranking)return this.setData({visibleItems:[],filteredCount:0,pageNumber:1,pageCount:0})
  const needle=clean(this.data.query).toLowerCase()
  const filtered=needle?ranking.items.filter(item=>item.nameEn.toLowerCase().includes(needle)||item.nameZh.toLowerCase().includes(needle)||item.website.split('/')[2].includes(needle)):ranking.items
  const pageCount=Math.ceil(filtered.length/PAGE_SIZE),pageNumber=pageCount?Math.min(Math.max(1,Number(page)||1),pageCount):1,start=(pageNumber-1)*PAGE_SIZE
  this.setData({visibleItems:filtered.slice(start,start+PAGE_SIZE),filteredCount:filtered.length,pageNumber,pageCount})
  this.refreshProfileCards()
 },
 refreshProfileCards(){
  if(this.__disposed)return
  this.setData({visibleItems:this.data.visibleItems.map(item=>{const entry=this.__profileMap?.get(item.id),logo=entry?.logo;return{...item,logoSrc:logo&&!this.__failedLogos.has(logo.path)?profileAssetUrl(logo.path):'',logoPath:logo?.path||'',logoTone:logo?.tone||'light',logoInitial:[...item.nameZh][0]||'',profileSummary:entry?.kind==='verified-overview'?entry.summary:'',profileButtonLabel:entry?.kind==='verified-overview'?'申请要求':'申请参考'}})})
 },
 loadProfileIndex(force=false){
  if(this.__profileIndexPromise)return this.__profileIndexPromise
  const task=(async()=>{try{const result=await fetchProfileIndex({force});if(this.__disposed)return false;this.__profileMap=new Map();for(const entry of result.index.items)for(const alias of entry.aliases)this.__profileMap.set(alias,entry);this.refreshProfileCards();return true}catch{return false}})().finally(()=>{if(this.__profileIndexPromise===task)this.__profileIndexPromise=null})
  this.__profileIndexPromise=task;return task
 },
 onUniversityLogoError(event){
  if(this.__disposed)return
  const itemId=clean(event?.currentTarget?.dataset?.id),logoPath=String(event?.currentTarget?.dataset?.logoPath||'')
  if(this.__profileMap.get(itemId)?.logo?.path!==logoPath)return
  this.__failedLogos.add(logoPath);this.refreshProfileCards()
 },
 async showRequirements(event,force=false){
  const itemId=clean(event?.currentTarget?.dataset?.id)
  if(this.__disposed||!this.data.visibleItems.some(x=>x.id===itemId))return false
  if(this.data.expandedId===itemId&&!force){this.__detailToken++;this.setData({expandedId:'',activeProfile:null,profileLoading:false,profileError:''});return true}
  const token=++this.__detailToken;this.setData({expandedId:itemId,profileLoading:true,profileError:'',activeProfile:null})
  try{
   if(!this.__profileMap.has(itemId))await this.loadProfileIndex(force)
   if(this.__disposed||token!==this.__detailToken)return false
   const entry=this.__profileMap.get(itemId);if(!entry)throw Error('unavailable')
   const result=await fetchProfile(entry,{force})
   if(this.__disposed||token!==this.__detailToken)return false
   this.setData({activeProfile:result.profile});return true
  }catch{if(!this.__disposed&&token===this.__detailToken)this.setData({profileError:'申请参考暂未加载，可重试或先查看学校官网。'});return false}
  finally{if(!this.__disposed&&token===this.__detailToken)this.setData({profileLoading:false})}
 },
 retryRequirements(){return this.showRequirements({currentTarget:{dataset:{id:this.data.expandedId}}},true)},
 copyAdmissionSource(event){
  if(this.__disposed||!this.data.expandedId)return
  const source=this.data.activeProfile?.sources.find(x=>x.id===clean(event?.currentTarget?.dataset?.source))
  if(source)this.copyUrl(source.url,'官方来源已复制')
 },
 showRankingPage(page){this.updateRankingList(page);if(typeof wx.pageScrollTo==='function')wx.pageScrollTo({scrollTop:0,duration:0})},
 previousPage(){if(this.data.pageNumber>1)this.showRankingPage(this.data.pageNumber-1)},
 nextPage(){if(this.data.pageNumber<this.data.pageCount)this.showRankingPage(this.data.pageNumber+1)},
 chooseBoard(event){
  const boardId=safeOption(event?.currentTarget?.dataset?.board,BOARD_IDS,'')
  const board=this.__boards.find(item=>item.id===boardId)
  if(board)this.setData({selectedBoardId:boardId,currentBoard:board})
 },
 copyUrl(url,title){
  if(!url)return
  wx.setClipboardData({data:url,success:()=>{if(!this.__disposed)wx.showToast({title,icon:'success'})},fail:()=>{if(!this.__disposed)wx.showToast({title:'复制失败，请重试',icon:'none'})}})
 },
 copyOfficial(){this.copyUrl(this.data.currentBoard?.url,'官网链接已复制')},
 copyUniversity(event){
  const ranking=this.__rankings.find(item=>item.id===this.data.currentRankingId),item=ranking?.items.find(value=>value.id===clean(event?.currentTarget?.dataset?.id))
  if(item)this.copyUrl(item.website,'官网链接已复制')
 },
 copyRankingLink(event){const kind=clean(event?.currentTarget?.dataset?.kind);if(kind==='source')this.copyUrl(this.data.currentRanking?.sourceUrl,'榜单来源已复制');if(kind==='methodology')this.copyUrl(this.data.currentRanking?.methodologyUrl,'排名方法已复制')},
 sharePath(){return this.data.activeTab==='official'?`/bundles/curricula/universities?tab=official&board=${safeOption(this.data.selectedBoardId,BOARD_IDS,'ap')}`:`/bundles/curricula/universities?tab=rankings&ranking=${safeOption(this.data.currentRankingId,RANKING_IDS,'qs-world')}`},
 onShareAppMessage(){return{title:this.data.activeTab==='official'?'STEMist · 课程官网':'STEMist · 大学排名与官网',path:this.sharePath(),imageUrl:'/design-system/share-card.png'}},
 onShareTimeline(){const value=this.onShareAppMessage();return{title:value.title,query:value.path.split('?')[1]||''}},
})
