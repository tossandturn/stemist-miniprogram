const {deviceState,syncDevice}=require('../../utils/page')
const {fetchUniversityDirectory}=require('./universityService')

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
 data:deviceState({activeTab:'rankings',loading:false,loaded:false,error:'',dataSource:'',cacheNotice:'',rankingOptions:[],rankingIndex:0,currentRankingId:'',currentRanking:null,queryDraft:'',query:'',filteredCount:0,visibleItems:[],pageNumber:1,pageCount:0,examBoards:[],selectedBoardId:'ap',currentBoard:null}),
 onLoad(options={}){
  this.__disposed=false;this.__requestId=0;this.__rankings=[];this.__boards=[]
  this.__requestedRanking=safeOption(options.ranking,RANKING_IDS,'')
  const activeTab=safeOption(options.tab,TABS,'rankings'),selectedBoardId=safeOption(options.board,BOARD_IDS,'ap')
  this.setData({activeTab,selectedBoardId})
  return this.loadDirectory()
 },
 onShow(){syncDevice(this)},onResize(){syncDevice(this)},onUnload(){this.__disposed=true;this.__requestId++},
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
   return true
  }catch(error){
   if(this.__disposed||requestId!==this.__requestId)return false
   const message=clean(error?.message)
   this.setData({loaded:false,error:/^暂时无法加载大学目录/.test(message)?message:'暂时无法加载大学目录，请稍后重试。',visibleItems:[],filteredCount:0,pageCount:0})
   return false
  }finally{if(!this.__disposed&&requestId===this.__requestId)this.setData({loading:false})}
 },
 chooseTab(event){const tab=safeOption(event?.currentTarget?.dataset?.tab,TABS,'');if(tab)this.setData({activeTab:tab})},
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
  const ranking=this.__rankings.find(item=>item.id===this.data.currentRankingId)
  if(!ranking)return this.setData({visibleItems:[],filteredCount:0,pageNumber:1,pageCount:0})
  const needle=clean(this.data.query).toLowerCase()
  const filtered=needle?ranking.items.filter(item=>item.nameEn.toLowerCase().includes(needle)||item.nameZh.toLowerCase().includes(needle)||item.website.split('/')[2].includes(needle)):ranking.items
  const pageCount=Math.ceil(filtered.length/PAGE_SIZE),pageNumber=pageCount?Math.min(Math.max(1,Number(page)||1),pageCount):1,start=(pageNumber-1)*PAGE_SIZE
  this.setData({visibleItems:filtered.slice(start,start+PAGE_SIZE),filteredCount:filtered.length,pageNumber,pageCount})
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
