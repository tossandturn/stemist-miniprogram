const {deviceState,syncDevice}=require('../../utils/page')
const {isAuthError}=require('../../utils/api')
const {keyboardData,keyboardMethods}=require('./tavernKeyboard')
const {mergeTavernMessages}=require('./tavernConversation')
const {cleanAdmissionsMessage,newClientTurnId,resumeAdmissions,fetchAdmissionsMessages,deleteAdmissions,sendAdmissions}=require('./admissionsConversation')
const owner=()=>String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const LOCAL_CLEAR_FENCES=new Map()
const revisionConflict=error=>Number(error?.statusCode)===409&&/revision_conflict|generated_result_pending/.test(String(error?.code||''))
const confirmedDeleted=error=>Number(error?.statusCode)===410&&String(error?.code||'')==='admissions_conversation_deleted'
const canonicalDraft=value=>{try{return cleanAdmissionsMessage(String(value||''))}catch{return''}}
const normalizedDraftLength=value=>Array.from(String(value||'').replaceAll(String.fromCharCode(0),'').replace(/\r\n?/g,'\n').trim()).length
const clipDraft=value=>Array.from(String(value||'')).slice(0,12000).join('')
const clipPartial=value=>Array.from(String(value||'')).slice(0,40000).join('')
const receiptUi=(pending,draft)=>{const receiptState=['commit-deferred','indeterminate'].includes(pending?.receiptState)?pending.receiptState:'',same=Boolean(pending&&canonicalDraft(draft)===pending.message);return{receiptState,sendBlocked:receiptState==='indeterminate',canRetry:Boolean(pending&&receiptState!=='indeterminate'&&(same||receiptState==='commit-deferred'))}}
const receiptError=ui=>ui.receiptState==='indeterminate'?'生成结果尚未确认；为避免重复调用 AI，请刷新记录确认，或清空后重新开始。':ui.receiptState==='commit-deferred'?'回答仍待写入对话；请点击“重试保存”，新草稿会继续保留。':''
const STARTERS=Object.freeze([
 {title:'申请规划',text:'请像申请老师一样帮我做国际本科申请规划。先了解我的课程体系、目标地区和专业，再给我准备顺序。'},
 {title:'背景分析',text:'我想分析目前的申请竞争力。请帮我梳理成绩、语言和课外经历的优势与缺口，不要编造录取概率。'},
 {title:'文书修改',text:'我想修改一段申请文书。请先问我申请用途、字数要求和真实经历，再帮我梳理结构、润色表达并说明修改理由。'},
 {title:'申请邮件',text:'请帮我拟一封发给大学招生办公室的英文邮件，并用中文解释。先确认收件对象、目的和需要表达的真实信息。'},
])
Page({
 ...keyboardMethods,
 data:deviceState({...keyboardData,presetChosen:true,selectorOpen:false,starters:STARTERS,message:'',turns:[],partialAnswer:'',loading:false,historyLoading:false,historyBrowsing:false,hasOlderHistory:false,authRequired:false,canRetry:false,receiptState:'',sendBlocked:false,clearPending:false,error:'',warning:'',status:''}),
 onShareAppMessage(){return{...require('../../utils/share').onShareAppMessage.call(this),title:'STEMist · 留学申请顾问',path:'/bundles/coach/index'}},
 onLoad(){this.__disposed=false;this.__generation=0;this.__conversationGeneration=0;this.__owner=owner();this.__epoch=epoch();this.__started=false;this.__clearing=false;this.restoreLocal();this.initComposerViewport()},
 onShow(){
   syncDevice(this);this.resumeComposerViewport()
   const sameOwnerAuthReturn=this.data.authRequired&&this.__owner===owner()&&this.__epoch===epoch()
   if(this.__owner!==owner()||this.__epoch!==epoch())this.resetIdentity()
   if(!wx.getStorageSync('stemistSessionToken')){this.setData({authRequired:true});return}
   if(sameOwnerAuthReturn){this.stopWaiting();this.__started=false;this.restoreLocal()}
   if(!this.__started||this.data.authRequired){this.__started=true;this.setData({authRequired:false,error:''});if(!this.data.clearPending)this.resumeLatest()}
  },
 onResize(){syncDevice(this);this.refreshComposerViewport()},
 onHide(){if(this.current())this.save();this.stopWaiting();this.__started=false;this.suspendComposerViewport()},
 onUnload(){if(this.current())this.save();this.stopWaiting();this.suspendComposerViewport();this.__disposed=true},
 current(generation=this.__generation){return!this.__disposed&&generation===this.__generation&&this.__owner===owner()&&this.__epoch===epoch()},
 key(){return'stemistAdmissions:'+this.__owner+':'+this.__epoch},
 clearFenceKey(){return this.key()+':clear-fence'},
 readClearFence(){
  const key=this.clearFenceKey();let entry=LOCAL_CLEAR_FENCES.get(key)||null
  try{const stored=wx.getStorageSync(key);if(stored?.cleared===true){entry={conversationId:String(stored.conversationId||'local-only'),durable:true};LOCAL_CLEAR_FENCES.set(key,entry)}}catch{}
  return entry
 },
 persistClearFence(conversationId){
  const key=this.clearFenceKey(),entry={conversationId:String(conversationId||'local-only'),durable:false};LOCAL_CLEAR_FENCES.set(key,entry)
  try{wx.setStorageSync(key,{schemaVersion:1,cleared:true,conversationId:entry.conversationId});entry.durable=true;return true}catch{return false}
 },
 secureLocalClearFence(conversationId){
  const id=String(conversationId||'local-only'),fenceStored=this.persistClearFence(id);let markerStored=false,oldRemoved=false
  try{wx.setStorageSync(this.key(),{schemaVersion:1,owner:this.__owner,epoch:this.__epoch,clearFence:true,conversationId:id});markerStored=true}catch{try{wx.removeStorageSync(this.key());oldRemoved=true}catch{}}
  const durable=fenceStored||markerStored||oldRemoved;LOCAL_CLEAR_FENCES.set(this.clearFenceKey(),{conversationId:id,durable});this.__clearFenceDurable=durable
  return durable
 },
 releaseClearFence(){
  try{wx.removeStorageSync(this.clearFenceKey())}catch{return false}
  LOCAL_CLEAR_FENCES.delete(this.clearFenceKey());this.__localClearFence=false;this.__deletedConversationId='';this.__clearFenceDurable=false;return true
 },
 restoreLocal(){
  let raw;try{raw=wx.getStorageSync(this.key())}catch{}
  const valid=raw&&raw.owner===this.__owner&&raw.epoch===this.__epoch,fence=this.readClearFence()||(valid&&raw.clearFence===true?{conversationId:String(raw.conversationId||'local-only'),durable:true}:null)
  this.__localClearFence=Boolean(fence);this.__deletedConversationId=String(fence?.conversationId||'');this.__clearFenceDurable=Boolean(fence?.durable)
  const record=!fence&&valid&&raw.conversation
  this.__conversation=record&&record.persona==='admissions-advisor'&&typeof record.id==='string'&&Number.isSafeInteger(record.revision)&&record.revision>=0&&Number.isSafeInteger(record.turnCount)&&record.turnCount>=0?record:null
  const pending=valid&&raw.pending
  const pendingMessage=pending&&canonicalDraft(pending.message)
  const receiptState=['commit-deferred','indeterminate'].includes(pending?.receiptState)?pending.receiptState:''
  this.__pending=!fence&&this.__conversation&&pending&&/^[A-Za-z0-9._:-]{8,180}$/.test(String(pending.clientTurnId||''))&&pendingMessage&&Number.isSafeInteger(pending.expectedRevision)&&pending.expectedRevision>=0?{clientTurnId:String(pending.clientTurnId),message:pendingMessage,expectedRevision:pending.expectedRevision,...(pending.needsRebase===true?{needsRebase:true}:{}),...(receiptState?{receiptState}:{})}:null
  this.__nextBefore=''
  const draft=!fence&&valid?clipDraft(raw.draft):''
  const ui=receiptUi(this.__pending,draft)
  this.setData({message:draft,turns:[],partialAnswer:!fence&&valid?clipPartial(raw.partialAnswer):'',loading:false,historyLoading:false,historyBrowsing:false,hasOlderHistory:false,...ui,clearPending:Boolean(fence&&!fence.durable||!fence&&valid&&raw.clearPending===true),error:receiptError(ui),warning:fence&&!fence.durable?'云端对话已清除，但本机隐私隔离尚未持久保存；请勿退出并重试清空。':'',status:'',authRequired:!wx.getStorageSync('stemistSessionToken')})
 },
 save(){
  if(!this.current())return false
  const payload=this.__localClearFence?{schemaVersion:1,owner:this.__owner,epoch:this.__epoch,clearFence:true,conversationId:this.__deletedConversationId||'local-only'}:{schemaVersion:1,owner:this.__owner,epoch:this.__epoch,draft:this.data.message,partialAnswer:clipPartial(this.data.partialAnswer),conversation:this.__conversation,pending:this.__pending,clearPending:this.data.clearPending}
  try{wx.setStorageSync(this.key(),payload);if(this.__localClearFence){this.__clearFenceDurable=true;LOCAL_CLEAR_FENCES.set(this.clearFenceKey(),{conversationId:this.__deletedConversationId||'local-only',durable:true})}return true}catch{this.setData({warning:this.__localClearFence?'云端对话已清除，但本机隐私隔离尚未持久保存；请勿退出并重试清空。':'草稿未能保存在本机，请勿退出；已完成对话仍可从云端恢复。'});return false}
 },
 stopWaiting(){this.__generation++;this.__conversationGeneration++;this.__cancel?.();this.__cancel=null;this.__resumePromise=null;this.__submitting=false;this.setData({loading:false,historyLoading:false,...receiptUi(this.__localClearFence?null:this.__pending,this.data.message)})},
 resetIdentity(){this.stopWaiting();this.__owner=owner();this.__epoch=epoch();this.__started=false;this.restoreLocal()},
 fail(error,generation){
  if(this.__disposed||generation!==this.__generation)return
  if(!this.current()||isAuthError(error)){
   this.setData({message:'',turns:[],partialAnswer:'',loading:false,historyLoading:false,canRetry:false,receiptState:'',sendBlocked:false,authRequired:isAuthError(error)||!wx.getStorageSync('stemistSessionToken'),error:'账号状态已变化，请登录后重新打开申请顾问。'});this.__started=false;return
  }
  const code=String(error?.code||''),partialAnswer=clipPartial(error?.partialAnswer||this.data.partialAnswer||'')
  if(this.__pending&&code==='admissions_commit_deferred'&&error?.retryable===true&&error?.providerRetryRequired===false&&error?.exactlyOnceGuaranteed!==false){
   this.__pending.receiptState='commit-deferred';this.setData({...receiptUi(this.__pending,this.data.message),loading:false,historyLoading:false,partialAnswer,error:'回答已生成并安全保留，但尚未写入对话；请点击“重试保存”，不会再次调用 AI。',status:''});this.save();return
  }
  if(this.__pending&&(code==='admissions_generation_indeterminate'||code==='admissions_commit_deferred')){
   this.__pending.receiptState='indeterminate';this.setData({...receiptUi(this.__pending,this.data.message),loading:false,historyLoading:false,partialAnswer,error:'生成结果尚无法确认。为避免重复调用 AI，已停止发送；请刷新记录确认，或清空后重新开始。',status:''});this.save();return
  }
  if(revisionConflict(error)&&this.__pending&&!this.__pending.receiptState){this.__pending.needsRebase=true}
  const text=String(error?.message||'')
  const ui=receiptUi(this.__pending,this.data.message);if(error?.retryable===false)ui.canRetry=false
  this.setData({loading:false,historyLoading:false,error:/[\u4e00-\u9fff]/.test(text)&&!/(https?:|bearer|secret|api.key)/i.test(text)?text.slice(0,240):'暂时未能完成，请稍后重试。',...ui,partialAnswer,status:''})
  if(this.__pending)this.save()
 },
 validateEnvelope(result,expected=this.__conversation){
  const conversation=result?.conversation
  if(!conversation||typeof conversation.id!=='string'||!Number.isSafeInteger(conversation.revision))throw Object.assign(Error('云端对话记录无效，请重新进入。'),{code:'admissions_conversation_invalid'})
  if(this.__localClearFence&&this.__deletedConversationId&&conversation.id===this.__deletedConversationId)throw Object.assign(Error('已清除的云端对话不能恢复。'),{code:'admissions_conversation_tombstoned'})
  if(expected&&conversation.id!==expected.id)throw Object.assign(Error('云端对话标识已变化，请重新进入。'),{code:'admissions_conversation_changed'})
  if(expected&&conversation.revision<expected.revision)throw Object.assign(Error('云端历史响应已过期，请刷新记录。'),{code:'admissions_conversation_revision_stale'})
  return result
 },
 async resumeLatest(){
  if(!this.current()||this.data.clearPending)return false
  if(this.__resumePromise)return this.__resumePromise
  const generation=this.__generation,expected=this.__conversation
  this.setData({historyLoading:true,error:''})
  let work
  work=(async()=>{try{
   const result=this.validateEnvelope(await resumeAdmissions({conversationId:expected?.id||''}),expected)
   if(!this.current(generation))return false
   this.__conversation=result.conversation;this.__nextBefore=result.nextBefore
   const pending=this.__pending,committed=pending&&result.messages.some(item=>item.id===pending.clientTurnId+':assistant'&&item.role==='assistant')&&result.messages.some(item=>item.id===pending.clientTurnId+':user'&&item.content===pending.message)
   const patch={turns:result.messages,historyBrowsing:false,hasOlderHistory:Boolean(result.nextBefore),historyLoading:false,error:''}
   if(committed){if(canonicalDraft(this.data.message)===pending.message)patch.message='';this.__pending=null;patch.canRetry=false;patch.partialAnswer=''}
   else if(pending?.needsRebase){pending.expectedRevision=result.conversation.revision;delete pending.needsRebase;patch.canRetry=canonicalDraft(this.data.message)===pending.message}
   const draft=Object.prototype.hasOwnProperty.call(patch,'message')?patch.message:this.data.message;Object.assign(patch,receiptUi(this.__pending,draft))
   if(patch.receiptState)patch.error=receiptError(patch)
   if(this.__localClearFence){
    const partialAnswer=Object.prototype.hasOwnProperty.call(patch,'partialAnswer')?patch.partialAnswer:this.data.partialAnswer
    try{wx.setStorageSync(this.key(),{schemaVersion:1,owner:this.__owner,epoch:this.__epoch,draft,partialAnswer:clipPartial(partialAnswer),conversation:this.__conversation,pending:this.__pending,clearPending:false})}catch{this.__conversation=null;this.__nextBefore='';this.setData({message:'',turns:[],partialAnswer:'',historyLoading:false,historyBrowsing:false,hasOlderHistory:false,canRetry:false,receiptState:'',sendBlocked:false,clearPending:true,warning:'本机清除隔离尚未安全解除，请释放空间后重试。'});throw Object.assign(Error('本机清除隔离尚未安全解除。'),{code:'admissions_local_clear_fence_active'})}
    if(!this.releaseClearFence()){this.__conversation=null;this.__nextBefore='';this.setData({message:'',turns:[],partialAnswer:'',historyLoading:false,historyBrowsing:false,hasOlderHistory:false,clearPending:true,warning:'本机清除隔离尚未安全解除，请释放空间后重试。'});throw Object.assign(Error('本机清除隔离尚未安全解除。'),{code:'admissions_local_clear_fence_active'})}
   }
   this.setData(patch);this.save();this.scrollChatToLatest();return true
  }catch(error){this.fail(error,generation);return false}finally{if(this.__resumePromise===work)this.__resumePromise=null}})()
  this.__resumePromise=work;return work
 },
 onMessage(event){if(!this.current()||this.data.loading||this.data.clearPending)return;const message=String(event?.detail?.value||'');if(normalizedDraftLength(message)>12000){this.setData({error:'内容超过 12000 字符，请分段发送。'});return}const ui=receiptUi(this.__pending,message);this.setData({message,error:receiptError(ui),...ui});this.save()},
 useStarter(event){const starter=STARTERS[Number(event?.currentTarget?.dataset?.index)];if(starter&&!this.data.loading&&!this.data.authRequired)this.onMessage({detail:{value:starter.text}})},
 async submit(){
  if(!this.current()||this.__submitting||this.data.loading||this.data.historyLoading||this.data.clearPending||this.data.sendBlocked)return
  const receipt=receiptUi(this.__pending,this.data.message);if(receipt.sendBlocked){this.setData({...receipt,error:receiptError(receipt)});return}
  let draftMessage='';if(this.__pending?.receiptState!=='commit-deferred')try{draftMessage=cleanAdmissionsMessage(this.data.message)}catch(error){this.setData({error:String(error?.message||'请输入有效内容。'),canRetry:false});return}
  const message=this.__pending?.receiptState==='commit-deferred'?this.__pending.message:draftMessage
  if(!wx.getStorageSync('stemistSessionToken')){this.setData({authRequired:true,error:'请先登录，再开始申请咨询。'});return}
  const generation=this.__generation;this.__submitting=true
  try{
   if(!this.__conversation||this.data.historyBrowsing||this.__localClearFence){if(!await this.resumeLatest()||!this.current(generation))return}
   if(this.__pending?.needsRebase){if(!await this.resumeLatest()||!this.current(generation)||!this.__pending)return}
   if(!this.__pending&&canonicalDraft(this.data.message)!==message)return
   if(!this.__pending||this.__pending.message!==message)this.__pending={clientTurnId:newClientTurnId(),message,expectedRevision:this.__conversation.revision}
   const pending=this.__pending
   if(!this.save()){this.setData({loading:false,error:'本机暂时无法保存重试标识，本次未发送；请释放空间后重试。',canRetry:true,status:''});return}
   this.setData({loading:true,error:'',partialAnswer:'',canRetry:false,receiptState:'',sendBlocked:false,status:'正在连接申请顾问…'});this.scrollChatToLatest()
   const result=await sendAdmissions({...pending,conversationId:this.__conversation.id,onStage:stage=>{if(this.current(generation))this.setData({status:stage==='analysis'?'正在分析申请…':'正在连接申请顾问…'})},onPartial:text=>{if(this.current(generation)){this.setData({partialAnswer:text,status:'正在整理建议…'});this.scrollChatToLatest()}},onCancelReady:cancel=>{if(this.current(generation))this.__cancel=cancel;else cancel()}})
   if(!this.current(generation))return
   if(result?.mode!=='ai'||result.providerStatus!=='connected'||result.partial===true||!result.answer||!Array.isArray(result.turns))throw Error('本次回复未完成，请重试。')
   this.__conversation=result.conversation;this.__pending=null
   this.__nextBefore=''
   const remainingDraft=canonicalDraft(this.data.message)===pending.message?'':this.data.message
   this.setData({turns:mergeTavernMessages(this.data.turns,result.turns),message:remainingDraft,partialAnswer:'',loading:false,canRetry:false,receiptState:'',sendBlocked:false,error:'',status:'',hasOlderHistory:this.data.hasOlderHistory||this.__conversation.turnCount>20});this.save();this.scrollChatToLatest()
  }catch(error){this.fail(error,generation)}finally{if(this.current(generation)){this.__submitting=false;this.__cancel=null}}
 },
 async loadOlderHistory(){
  if(!this.current()||this.data.loading||this.data.historyLoading||!this.__conversation)return
  const generation=this.__generation
  this.setData({historyLoading:true,error:''})
  try{
   if(!this.__nextBefore){const expected=this.__conversation,latest=this.validateEnvelope(await resumeAdmissions({conversationId:expected.id}),expected);if(!this.current(generation))return;this.__conversation=latest.conversation;this.__nextBefore=latest.nextBefore;if(!this.__nextBefore){this.setData({turns:latest.messages,historyLoading:false,historyBrowsing:false,hasOlderHistory:false});this.save();return}}
   const expected=this.__conversation,result=this.validateEnvelope(await fetchAdmissionsMessages({conversationId:expected.id,before:this.__nextBefore}),expected);if(!this.current(generation))return;this.__conversation=result.conversation;this.__nextBefore=result.nextBefore;this.setData({turns:result.messages,historyBrowsing:true,historyLoading:false,hasOlderHistory:Boolean(result.nextBefore),chatScrollTop:0});this.save()
  }catch(error){this.fail(error,generation)}
 },
 returnLatestHistory(){return this.resumeLatest()},
 requestClear(){if(!this.current()||this.data.loading||this.data.historyLoading)return;wx.showModal({title:'清空申请咨询？',content:'将清除这位顾问的云端对话和本机草稿，不影响做题记录或休闲酒馆。',confirmText:'清空',confirmColor:'#a52f52',success:result=>{if(result.confirm)this.clearConversation()}})},
 async clearConversation(){
  if(!this.current()||this.data.loading||this.data.historyLoading||this.__clearing)return
  if(this.__localClearFence){const secured=this.secureLocalClearFence(this.__deletedConversationId);this.setData({message:'',turns:[],partialAnswer:'',clearPending:!secured,canRetry:false,receiptState:'',sendBlocked:false,hasOlderHistory:false,historyBrowsing:false,error:secured?'':'本机清除隔离尚未安全保存，请释放空间后重试。',status:'',warning:secured?'':'云端对话已清除，但本机隐私隔离尚未持久保存；请勿退出。'});return secured}
  const generation=this.__generation;this.__clearing=true;this.setData({clearPending:true,error:'',status:'正在清除云端对话…'});this.save()
  try{
   let conversation=this.__conversation
   if(!conversation){const latest=this.validateEnvelope(await resumeAdmissions());if(!this.current(generation))return false;conversation=latest.conversation}
   try{const result=await deleteAdmissions({conversationId:conversation.id});if(result?.deleted!==true||result.conversationId!==conversation.id)throw Error('清空尚未确认，请重试。')}catch(error){if(!confirmedDeleted(error))throw error}
   if(!this.current(generation))return
   this.__conversation=null;this.__pending=null;this.__nextBefore='';this.__conversationGeneration++;this.__localClearFence=true;this.__deletedConversationId=conversation.id
   const secured=this.secureLocalClearFence(conversation.id)
   this.setData({message:'',turns:[],partialAnswer:'',clearPending:!secured,canRetry:false,receiptState:'',sendBlocked:false,hasOlderHistory:false,historyBrowsing:false,error:secured?'':'本机清除隔离尚未安全保存，请释放空间后重试。',status:secured?'已清空申请咨询':'云端对话已清除',warning:secured?'':'云端对话已清除，但本机隐私隔离尚未持久保存；请勿退出。'});return secured
  }catch(error){this.fail(error,generation);return false}finally{this.__clearing=false}
 },
 copyReply(event){if(!this.current())return;const turn=this.data.turns.find(item=>item.id===String(event?.currentTarget?.dataset?.id||'')&&item.role==='assistant');if(turn)wx.setClipboardData({data:turn.content})},
 openAccount(){wx.navigateTo({url:'/pages/account/auth'})},
})
