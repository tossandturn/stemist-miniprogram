const {DEFAULT_API_BASE,safeApiBase}=require('../../utils/apiOrigin')
const TAVERN_MEDIA_VERSION='tavern-media.v1',PREFIX='/api/ai/tavern/media/v1/'
const ID=/^[a-z0-9][a-z0-9-]{1,79}$/,FILE=/^[a-z0-9][a-z0-9-]{1,100}\.(?:jpg|png|webp)$/
const clean=(value,max)=>typeof value==='string'?Array.from(value.replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,max).join(''):''
const dimension=value=>Number.isInteger(value)&&value>0&&value<=4096
function normalizeTavernMedia(value){
 const result=[],seen=new Set(),source=Array.isArray(value)?value:[]
 for(let index=0;index<Math.min(source.length,8);index++){
  const item=source[index]
  if(!item||typeof item.id!=='string'||!ID.test(item.id||'')||seen.has(item.id)||!['sticker','image'].includes(item.kind)||typeof item.src!=='string'||!item.src.startsWith(PREFIX)||!FILE.test(item.src.slice(PREFIX.length))||!dimension(item.width)||!dimension(item.height))continue
  const alt=clean(item.alt,120),caption=clean(item.caption,32);let frame
  if(!alt)continue
  if(item.kind==='sticker'){
   const value=item.frame||{},columns=value.columns,rows=value.rows,column=value.column,row=value.row
   if(!Number.isInteger(columns)||columns<1||columns>8||!Number.isInteger(rows)||rows<1||rows>8||!Number.isInteger(column)||column<0||column>=columns||!Number.isInteger(row)||row<0||row>=rows)continue
   frame={columns,rows,column,row}
  }
  result.push({id:item.id,kind:item.kind,src:item.src,width:item.width,height:item.height,alt,caption,...(frame?{frame}:{})});seen.add(item.id)
  if(result.length===2)break
 }
 return result
}
function mediaBase(){try{return safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE}catch{return DEFAULT_API_BASE}}
function decorateTavernTurns(turns,windowWidth=390){
 const available=Math.max(120,Math.min(252,(Number(windowWidth)||390)-88)),base=mediaBase()
 return Array.from(turns||[],turn=>{
  const media=turn.role==='assistant'?normalizeTavernMedia(turn.media):[]
  if(!media.length){const {media:ignored,...textTurn}=turn;return textTurn}
  return{...turn,media:media.map(item=>{
   const viewWidth=item.kind==='sticker'?Math.min(148,available):available
   const ratio=item.frame?(item.height/item.frame.rows)/(item.width/item.frame.columns):item.height/item.width
   const viewHeight=Math.round(Math.min(224,viewWidth*ratio)),frame=item.frame
   return{...item,key:turn.id+'|'+item.id,renderUrl:base+item.src,viewWidth,viewHeight,atlasStyle:frame?`width:${viewWidth*frame.columns}px;height:${viewHeight*frame.rows}px;left:${-viewWidth*frame.column}px;top:${-viewHeight*frame.row}px;`:''}
  })}
 })
}
function tavernMediaState(turns,width,previous={}){const decorated=decorateTavernTurns(turns,width),keys=new Set(decorated.flatMap(turn=>(turn.media||[]).map(item=>item.key))),mediaFailures={},mediaLoaded={};for(const key of keys){if(previous.mediaFailures?.[key])mediaFailures[key]=true;if(previous.mediaLoaded?.[key])mediaLoaded[key]=true}return{turns:decorated,mediaFailures,mediaLoaded}}
const tavernMediaViewMethods={
 findReplyMedia(event){if(!this.current()||this.__disposed)return null;const key=String(event?.currentTarget?.dataset?.mediaKey||'');for(const turn of this.data.turns||[])for(const item of turn.media||[])if(item.key===key)return item;return null},
 onReplyMediaLoad(event){const item=this.findReplyMedia(event);if(!item)return;const failed={...this.data.mediaFailures};delete failed[item.key];this.setData({mediaLoaded:{...this.data.mediaLoaded,[item.key]:true},mediaFailures:failed})},
 onReplyMediaError(event){const item=this.findReplyMedia(event);if(!item)return;this.setData({mediaFailures:{...this.data.mediaFailures,[item.key]:true}})},
 retryReplyMedia(event){const item=this.findReplyMedia(event);if(!item)return;const failed={...this.data.mediaFailures},loaded={...this.data.mediaLoaded};delete failed[item.key];delete loaded[item.key];this.setData({mediaFailures:failed,mediaLoaded:loaded})},
 previewReplyMedia(event){const item=this.findReplyMedia(event);if(!item||item.kind!=='image'||this.data.mediaFailures?.[item.key])return;wx.previewImage?.({current:item.renderUrl,urls:[item.renderUrl],fail:()=>{if(this.current())this.onReplyMediaError(event)}})},
}
module.exports={TAVERN_MEDIA_VERSION,normalizeTavernMedia,decorateTavernTurns,tavernMediaState,tavernMediaViewMethods}
