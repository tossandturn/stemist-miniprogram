// Deliberately subpackage-local: no dependency from one lazy bundle to another.
const DIRECTORY_ENTRY_KEY='stemistDirectoryCoachEntry:v1'
const DIRECTORY_ENTRY_MAX_AGE_MS=10*60*1000
const owner=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const text=(v,max)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(v)
const publicUrl=v=>text(v,1000)&&/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}(?:\/[^\s?#\\]*)?$/.test(v)&&!v.includes('/../')&&!/\.(?:local|internal|invalid|test|example|onion)(?:\/|$)/.test(v)
function validEntry(entry){return entry&&['university','course'].includes(entry.kind)&&text(entry.id,100)&&text(entry.title,180)&&text(entry.subtitle,400)&&publicUrl(entry.officialUrl)&&text(entry.prompt,3000)&&entry.prompt.includes(entry.title)&&entry.prompt.includes(entry.officialUrl)}
function consumeDirectoryEntry(nonce){
 if(typeof nonce!=='string'||!/^[a-z0-9-]{8,70}$/.test(nonce))return null
 try{
  const raw=wx.getStorageSync(DIRECTORY_ENTRY_KEY),age=Date.now()-Number(raw?.at)
  if(!raw||raw.schemaVersion!==1||raw.nonce!==nonce||raw.owner!==owner()||raw.epoch!==epoch()||!Number.isFinite(age)||age<0||age>DIRECTORY_ENTRY_MAX_AGE_MS||!validEntry(raw.entry))return null
  wx.removeStorageSync(DIRECTORY_ENTRY_KEY)
  return{kind:raw.entry.kind,id:raw.entry.id,title:raw.entry.title,subtitle:raw.entry.subtitle,officialUrl:raw.entry.officialUrl,prompt:raw.entry.prompt,at:raw.at}
 }catch{return null}
}
function withDirectoryCoachEntry(base){
 return{...base,data:{...base.data,directoryEntry:null,directoryEntryPending:false,directoryEntryNote:'',canRestoreDirectoryDraft:false},
  onLoad(options={}){
   base.onLoad.call(this,options);this.__directoryPreviousDraft='';this.__directoryGuestLogin=false
   const entry=consumeDirectoryEntry(options.directoryEntry)
   if(entry)this.offerDirectoryEntry(entry)
   else if(options.directoryEntry)this.setData({directoryEntryNote:'这次学校或课程信息未能带入，请返回目录重新选择；原草稿未改动。'})
  },
  onShow(){
   const beforeOwner=this.__owner,beforeEpoch=this.__epoch,entry=this.data.directoryEntry,guestReturn=this.__directoryGuestLogin&&beforeOwner==='guest'&&entry&&Date.now()-entry.at<=DIRECTORY_ENTRY_MAX_AGE_MS
   base.onShow.call(this)
   if(beforeOwner!==this.__owner||beforeEpoch!==this.__epoch){
    this.__directoryPreviousDraft='';this.setData({directoryEntry:null,directoryEntryPending:false,directoryEntryNote:'',canRestoreDirectoryDraft:false})
    if(guestReturn&&wx.getStorageSync('stemistSessionToken')&&this.__owner!=='guest')this.offerDirectoryEntry(entry)
   }
   this.__directoryGuestLogin=false
  },
  offerDirectoryEntry(entry){
   if(!this.current())return false
   const conflict=Boolean(this.data.message||this.__pending||this.data.clearPending||this.data.sendBlocked)
   this.setData({directoryEntry:entry,directoryEntryPending:conflict,directoryEntryNote:conflict?'已有未发送的内容，先保留原草稿；你可以选择替换。':'已带入名称、官网与提问建议，可编辑后发送。',canRestoreDirectoryDraft:false})
   if(!conflict){base.onMessage.call(this,{detail:{value:entry.prompt}})}
   return true
  },
  useDirectoryQuestion(){
   const entry=this.data.directoryEntry;if(!entry||!this.current()||this.data.loading||this.data.clearPending||this.data.sendBlocked)return
   if(this.__pending){this.setData({directoryEntryNote:'当前提问尚未确认，请先完成重试或清空，再带入新问题。'});return}
   const old=this.data.message,expectedOwner=this.__owner,expectedEpoch=this.__epoch
   const apply=()=>{
    if(!this.current()||this.__owner!==expectedOwner||this.__epoch!==expectedEpoch||this.data.message!==old||this.data.directoryEntry!==entry||this.__pending)return
    this.__directoryPreviousDraft=old&&old!==entry.prompt?old:''
    base.onMessage.call(this,{detail:{value:entry.prompt}})
    this.setData({directoryEntryPending:false,canRestoreDirectoryDraft:Boolean(this.__directoryPreviousDraft),directoryEntryNote:'已带入提问建议，可编辑后发送。'})
   }
   if(old&&old!==entry.prompt)wx.showModal({title:'替换当前草稿？',content:'将使用这所学校或课程的提问建议。离开本页前可以恢复原草稿；不会清空云端聊天。',confirmText:'替换草稿',success:result=>{if(result.confirm)apply()}})
   else apply()
  },
  restoreDirectoryDraft(){
   if(!this.current()||this.data.loading||this.__pending||!this.__directoryPreviousDraft)return
   base.onMessage.call(this,{detail:{value:this.__directoryPreviousDraft}});this.__directoryPreviousDraft=''
   this.setData({directoryEntry:null,directoryEntryPending:false,canRestoreDirectoryDraft:false,directoryEntryNote:''})
  },
  dismissDirectoryEntry(){
   if(!this.current()||this.data.loading)return
   this.setData({directoryEntry:null,directoryEntryPending:false,directoryEntryNote:'',canRestoreDirectoryDraft:false});this.__directoryPreviousDraft=''
  },
  copyDirectoryOfficial(){if(this.current()&&this.data.directoryEntry)wx.setClipboardData({data:this.data.directoryEntry.officialUrl})},
  submit(){
   if(this.data.directoryEntryPending){this.setData({directoryEntryNote:'请先选择“使用这份提问”或“保留当前草稿”，避免把上一所学校的问题发出去。'});return Promise.resolve()}
   return base.submit.call(this)
  },
  openAccount(){this.__directoryGuestLogin=this.__owner==='guest'&&Boolean(this.data.directoryEntry);base.openAccount.call(this)},
  async clearConversation(){const result=await base.clearConversation.call(this);if(result&&this.current())this.dismissDirectoryEntry();return result},
 }
}
module.exports={DIRECTORY_ENTRY_KEY,DIRECTORY_ENTRY_MAX_AGE_MS,consumeDirectoryEntry,withDirectoryCoachEntry}
