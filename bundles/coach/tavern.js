const {deviceState,syncDevice}=require('../../utils/page')
const {isAuthError}=require('../../utils/api')
const {coachHelpPolicy}=require('../../utils/coach')
const {loadProductConfig,readProductConfigSnapshot}=require('../../utils/productConfig')
const {DEFAULT_TAVERN_CATALOG,TAVERN_CATEGORIES,TAVERN_PRESETS,catalogPreset,configuredTavernCatalog}=require('./tavernPresets')
const {
 TAVERN_PAGE_LIMIT,displayTavernMessages,legacyDisplayTavernMessages,legacyImportIdFor,legacyTavernMessages,mergeTavernMessages,
 newClientTurnId,resumeTavernConversation,fetchTavernMessages,deleteTavernConversation,sendTavernTurn,
}=require('./tavernConversation')
const {newDrawNonce,normalizeTavernDraw,requestTavernDraw,interpretTavernDraw,redrawRequired}=require('./tavernDivination')

const owner=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
const clip=(value,max)=>Array.from(String(value||'')).slice(0,max).join('')
const viewPreset=value=>({...value,starters:Array.from(value.starters||[]),...(value.supportedSpreads?{supportedSpreads:Array.from(value.supportedSpreads)}:{})})
const hasSession=()=>Boolean(wx.getStorageSync('stemistSessionToken'))
const LOCAL_CLEAR_FENCES=new Map()
const sessionStamp=()=>{const token=String(wx.getStorageSync('stemistSessionToken')||'');if(!token)return'';let first=2166136261,second=2246822519;for(let index=0;index<token.length;index++){const code=token.charCodeAt(index);first=Math.imul(first^code,16777619)>>>0;second=Math.imul(second+code+index,3266489917)>>>0}return`${token.length}:${first.toString(36)}:${second.toString(36)}`}
const revisionConflict=error=>Number(error?.statusCode)===409&&String(error?.code||'')==='coach_tavern_revision_conflict'
const safeConversation=value=>value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.id==='string'&&value.id&&typeof value.persona==='string'&&typeof value.revision==='number'&&Number.isSafeInteger(value.revision)&&value.revision>=0&&typeof value.turnCount==='number'&&Number.isSafeInteger(value.turnCount)&&value.turnCount>=0?{id:String(value.id),persona:String(value.persona),revision:value.revision,turnCount:value.turnCount}:null
const safePending=value=>value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.id==='string'&&value.id&&typeof value.message==='string'&&value.message?{id:String(value.id),message:String(value.message),drawId:String(value.drawId||'')}:null
function emptyState(ownerId,privacyEpoch,persona){return{schemaVersion:2,owner:ownerId,epoch:privacyEpoch,persona,draft:'',question:'',spread:'single',draw:null,turns:[],nextBefore:'',historySource:'cloud',conversation:null,legacyBackup:[],legacyImportId:'',legacyImported:false,pendingTurn:null,clearPending:false,localClearFence:false,deletedConversationId:''}}
function storedState(raw,ownerId,privacyEpoch,persona){
 const state=emptyState(ownerId,privacyEpoch,persona)
 if(!raw||typeof raw!=='object'||raw.owner!==ownerId||raw.epoch!==privacyEpoch||raw.persona!==persona)return state
 if(raw.clearFence===true){state.localClearFence=true;state.deletedConversationId=String(raw.conversationId||'');return state}
 state.draft=String(raw.draft||'');state.question=String(raw.question||'');state.spread=String(raw.spread||'single');state.draw=raw.draw||null
 const legacySource=Array.isArray(raw.legacyBackup)?raw.legacyBackup:raw.schemaVersion===2?[]:raw.turns
 state.legacyBackup=legacyTavernMessages(legacySource)
 state.legacyImportId=String(raw.legacyImportId||'');state.legacyImported=raw.legacyImported===true
 const conversation=safeConversation(raw.conversation),invalidBinding=Boolean(conversation&&conversation.persona!==persona)
 state.conversation=invalidBinding?null:conversation;state.nextBefore=invalidBinding?'':String(raw.nextBefore||'').slice(0,240);state.pendingTurn=safePending(raw.pendingTurn);state.clearPending=raw.clearPending===true
 try{state.turns=invalidBinding||raw.schemaVersion===2&&!state.conversation?[]:raw.schemaVersion===2?displayTavernMessages(raw.turns):legacyDisplayTavernMessages(state.legacyBackup)}catch{state.turns=legacyDisplayTavernMessages(state.legacyBackup)}
 state.historySource=raw.schemaVersion===2&&raw.historySource==='cloud'?'cloud':state.legacyBackup.length&&!state.legacyImported?'legacy':'cloud'
 return state
}
function confirmedLegacyImport(backup,envelope,importId){
 const expected=legacyTavernMessages(backup),actual=envelope.messages
 if(!expected.length)return true
 const ack=envelope.legacyImport
 if(ack)return ack.confirmed===true&&ack.importId===importId&&ack.importedMessageCount===expected.length
 if(envelope.conversation.turnCount<expected.length/2||actual.length<Math.min(expected.length,TAVERN_PAGE_LIMIT))return false
 const tail=actual.slice(-expected.length)
 if(tail.length!==expected.length)return false
 for(let index=0;index<expected.length;index++)if(tail[index].role!==expected[index].role||tail[index].content!==expected[index].content)return false
 return true
}

Page({
 onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
 data:deviceState({personas:TAVERN_PRESETS,visiblePersonas:TAVERN_PRESETS,categories:TAVERN_CATEGORIES,category:'all',selected:TAVERN_PRESETS[0],persona:'keeper',starters:TAVERN_PRESETS[0].starters,greeting:TAVERN_PRESETS[0].greeting,placeholder:TAVERN_PRESETS[0].placeholder,selectorOpen:true,presetChosen:false,message:'',question:'',spread:'single',draw:null,drawLoading:false,interpretLoading:false,drawNeedsRedraw:false,turns:[],historyAnchor:'',historySource:'cloud',hasOlderHistory:false,historyBrowsing:false,historyLoading:false,answer:'',loading:false,error:'',warning:'',canRetry:false,authRequired:false,clearPending:false,status:'',examBlocked:false}),
 onLoad(options){
  this.__owner=owner();this.__epoch=epoch();this.__disposed=false;this.__states={};this.__attemptId='';this.__fortuneRevision=0;this.__historyRevision=0;this.__conversationGeneration=0;this.__browseNextBefore='';this.__pendingDrawNonce='';this.__productConfigRequest=0;this.__tavernCatalog=DEFAULT_TAVERN_CATALOG
  const productSnapshot=readProductConfigSnapshot();if(productSnapshot.source!=='bundled')this.applyProductConfig(productSnapshot,false)
  let blocked=false;const key=String(options?.entry||''),entry=wx.getStorageSync('stemistCoachEntry'),age=Date.now()-Number(entry?.at)
  if(key&&entry?.key===key&&entry.owner===this.__owner&&entry.epoch===this.__epoch&&age>=0&&age<120000){const source=entry.context||{},attempt=source.attempt||{};this.__attemptId=String(source.attemptId||source.paperAttemptId||attempt.id||attempt.attemptId||'');blocked=coachHelpPolicy(source).solutionDisabled}
  const initial=this.initialPersona();this.loadPersona(initial.persona,{chosen:initial.chosen,open:!initial.chosen})
  if(blocked)this.setData({examBlocked:true,error:'计时考试进行中，休闲酒馆暂不可用；请先完成或退出本次考试。'})
 },
 onShow(){
  syncDevice(this)
  this.refreshProductConfig()
  if(this.__authResumeRequested&&wx.getStorageSync('stemistSessionToken')&&owner()===this.__owner&&epoch()===this.__epoch){this.__authResumeRequested=false;this.loadPersona(this.data.persona,{chosen:true,open:false});return}
  if(!this.current()){this.__fortuneRevision++;this.__conversationGeneration++;this.setData({message:'',question:'',draw:null,turns:[],historyAnchor:'',hasOlderHistory:false,historyBrowsing:false,answer:'',loading:false,drawLoading:false,interpretLoading:false,drawNeedsRedraw:false,canRetry:false,authRequired:false,status:'',error:'账号状态已变化，请返回后重新进入酒馆。'})}
 },
 onResize(){syncDevice(this)},
 onUnload(){this.__fortuneRevision++;this.__conversationGeneration++;this.__productConfigRequest++;if(this.current())this.save(false);this.__disposed=true},
 current(){return!this.__disposed&&this.__owner===owner()&&this.__epoch===epoch()},
 applyProductConfig(result,refreshSelection=true){
  const config=result&&result.config;if(!config||!config.tavern)return false
  const catalog=configuredTavernCatalog(config.tavern);this.__tavernCatalog=catalog
  const category=catalog.categories.some(item=>item.id===this.data.category)?this.data.category:'all',personas=Array.from(catalog.presets,viewPreset),categories=Array.from(catalog.categories,item=>({id:item.id,label:item.label})),visiblePersonas=category==='all'?Array.from(personas):Array.from(personas.filter(item=>item.category===category)),sourceSelected=catalogPreset(catalog,this.data.persona),selected=sourceSelected&&viewPreset(sourceSelected)
  const patch={personas,categories,category,visiblePersonas}
  if(refreshSelection&&selected)Object.assign(patch,{selected,starters:Array.from(selected.starters),greeting:selected.greeting,placeholder:selected.placeholder})
  this.setData(patch);return true
 },
 async refreshProductConfig(){const request=++this.__productConfigRequest,result=await loadProductConfig();if(this.__disposed||request!==this.__productConfigRequest||!this.current())return false;return this.applyProductConfig(result,true)},
 catalog(){return this.__tavernCatalog||DEFAULT_TAVERN_CATALOG},
 quiesceIdentityFailure(error,{status='对话未完成',clearPending=this.data.clearPending===true}={}){
  const auth=isAuthError(error),changed=!this.current()
  if(!auth&&!changed)return false
  if(this.__disposed)return true
  const sameEpoch=epoch()===this.__epoch,currentOwner=owner(),authRecovery=auth&&sameEpoch&&(currentOwner==='guest'||currentOwner===this.__owner)
  this.setData({message:'',question:'',draw:null,turns:[],historyAnchor:'',historySource:'cloud',hasOlderHistory:false,historyBrowsing:false,historyLoading:false,answer:'',loading:false,drawLoading:false,interpretLoading:false,drawNeedsRedraw:false,canRetry:false,authRequired:authRecovery,clearPending:Boolean(clearPending),warning:'',error:authRecovery?(clearPending?'登录已过期，云端对话尚未清除；请登录后重试。':'登录已过期，请登录后继续。'):(clearPending?'账号状态已变化，旧账号的云端对话尚未清除。':'账号状态已变化，请重新进入酒馆。'),status})
  return true
 },
 staleSessionFailure(error,requestStamp,{status='对话未完成',clearPending=this.data.clearPending===true}={}){
  if(!isAuthError(error)||!this.current())return false
  const activeStamp=sessionStamp();if(!requestStamp||!activeStamp||requestStamp===activeStamp)return false
  this.setData({loading:false,historyLoading:false,drawLoading:false,interpretLoading:false,canRetry:true,authRequired:false,clearPending:Boolean(clearPending),error:'会话已更新，请重试。',status})
  return true
 },
 key(persona=this.data.persona){return`stemistTavern:${this.__owner}:${this.__epoch}:${persona}`},
 clearFenceKey(persona=this.data.persona){return`${this.key(persona)}:clear-fence`},
 selectionKey(){return`stemistTavern:${this.__owner}:${this.__epoch}:selected`},
 read(persona){let state=this.__states[persona];if(!state){let fenceId=LOCAL_CLEAR_FENCES.get(this.clearFenceKey(persona))||'';try{const storedFence=wx.getStorageSync(this.clearFenceKey(persona));if(storedFence?.cleared===true)fenceId=String(storedFence.conversationId||fenceId)}catch{}if(fenceId){state=emptyState(this.__owner,this.__epoch,persona);state.localClearFence=true;state.deletedConversationId=fenceId}else try{state=storedState(wx.getStorageSync(this.key(persona)),this.__owner,this.__epoch,persona)}catch{state=emptyState(this.__owner,this.__epoch,persona)}}this.__states[persona]=state;return state},
 initialPersona(){const catalog=this.catalog();let selected='';try{selected=String(wx.getStorageSync(this.selectionKey())||'')}catch{}if(catalogPreset(catalog,selected))return{persona:selected,chosen:true};for(const preset of catalog.presets){const state=this.read(preset.id);if(String(state.draft||state.question||'')||state.turns.length||state.draw||state.conversation)return{persona:preset.id,chosen:true}}return{persona:'keeper',chosen:false}},
 save(warn=true){
  if(!this.current())return false
  const state=this.read(this.data.persona),fortune=Boolean(this.data.selected.divinationKind)
  state.draft=fortune?'':this.data.message;state.question=fortune?this.data.question:'';state.spread=fortune?this.data.spread:'single';state.draw=fortune?this.data.draw:null;state.clearPending=this.data.clearPending===true
  try{wx.setStorageSync(this.key(),state);if(warn&&this.data.warning)this.setData({warning:''});return true}catch{if(warn)this.setData({warning:'当前对话未能保存在本机；本页内内容仍保留，请暂时不要退出。'});return false}
 },
 persistClearFence(persona=this.data.persona,conversationId=''){const key=this.clearFenceKey(persona),id=String(conversationId||'local-only');LOCAL_CLEAR_FENCES.set(key,id);try{wx.setStorageSync(key,{schemaVersion:1,cleared:true,conversationId:id});return true}catch{return false}},
 releaseClearFence(persona=this.data.persona){const key=this.clearFenceKey(persona);try{wx.removeStorageSync(key)}catch{return false}LOCAL_CLEAR_FENCES.delete(key);return true},
 rememberPersona(persona){try{wx.setStorageSync(this.selectionKey(),persona);return true}catch{this.setData({warning:'当前预设未能保存在本机；本页内选择仍然有效。'});return false}},
 nextHistoryAnchor(turns){return turns.length?`tavern-tail-${++this.__historyRevision}`:''},
 renderLatest(state,extra={}){const turns=state.turns;this.__browseNextBefore='';this.setData({turns,historyAnchor:this.nextHistoryAnchor(turns),historySource:state.historySource,hasOlderHistory:Boolean(state.nextBefore),historyBrowsing:false,historyLoading:false,clearPending:state.clearPending,...extra})},
 loadPersona(persona,{chosen=this.data.presetChosen,open=this.data.selectorOpen}={}){
  this.__fortuneRevision++;const generation=++this.__conversationGeneration;this.__pendingDrawNonce='';this.__browseNextBefore=''
  const catalog=this.catalog(),selected=viewPreset(catalogPreset(catalog,persona)||catalog.presets[0]),state=this.read(selected.id),fortune=Boolean(selected.divinationKind),spread=fortune&&selected.supportedSpreads.includes(state.spread)?state.spread:selected.supportedSpreads?.[0]||'single'
  let draw=null,drawNeedsRedraw=false,drawError=''
  if(fortune&&state.draw)try{draw=normalizeTavernDraw({draw:state.draw},{persona:selected.id,spread,now:0});if(draw.expiresAt<=Date.now()){drawNeedsRedraw=true;drawError='本次娱乐抽取已过期，请重新抽取。'}}catch{drawNeedsRedraw=true;drawError='本机抽取记录无效，请重新抽取。'}
  const turns=state.turns
  this.setData({selected,persona:selected.id,starters:selected.starters,greeting:selected.greeting,placeholder:selected.placeholder,selectorOpen:open,presetChosen:chosen,message:fortune?'':String(state.draft||''),question:fortune?clip(state.question,600):'',spread,draw,drawLoading:false,interpretLoading:false,drawNeedsRedraw,turns,historyAnchor:this.nextHistoryAnchor(turns),historySource:state.historySource,hasOlderHistory:Boolean(state.nextBefore),historyBrowsing:false,historyLoading:false,answer:'',loading:false,error:this.data.examBlocked?this.data.error:drawError,warning:'',canRetry:false,authRequired:false,clearPending:state.clearPending,status:''})
  if(chosen&&hasSession()&&!state.clearPending){const requestStamp=sessionStamp();Promise.resolve().then(()=>this.resumeConversation(false,generation)).catch(error=>{if(generation!==this.__conversationGeneration)return;if(this.staleSessionFailure(error,requestStamp,{status:'对话未完成'}))return;if(this.quiesceIdentityFailure(error,{status:'对话未完成'}))return;if(this.current())this.setData({warning:'云端历史暂未同步；本机草稿仍保留。'})})}
 },
 applyEnvelope(state,envelope,{legacyConfirmed=false,render=true}={}){
  const fenced=state.localClearFence===true,deletedConversationId=String(state.deletedConversationId||'')
  if(fenced&&deletedConversationId&&envelope.conversation.id===deletedConversationId)throw Object.assign(Error('已清除的云端对话不能从本机缓存恢复。'),{code:'tavern_conversation_tombstoned'})
  if(state.conversation&&state.conversation.id!==envelope.conversation.id)throw Object.assign(Error('云端对话标识已变化，请重新进入。'),{code:'tavern_conversation_changed'})
  if(state.conversation&&envelope.conversation.revision<state.conversation.revision)throw Object.assign(Error('云端历史响应已过期。'),{code:'tavern_conversation_revision_stale'})
  state.conversation=envelope.conversation;state.nextBefore=envelope.nextBefore
  if(envelope.messages.length||!state.legacyBackup.length||state.legacyImported){state.turns=envelope.messages;state.historySource='cloud'}
  if(legacyConfirmed){state.legacyImported=true;state.historySource='cloud'}
  if(fenced){state.localClearFence=false;if(!this.save(false)||!this.releaseClearFence(state.persona)){const blank=emptyState(this.__owner,this.__epoch,state.persona);blank.localClearFence=true;blank.deletedConversationId=deletedConversationId;Object.assign(state,blank);if(render)this.renderLatest(state);throw Object.assign(Error('本机清除隔离尚未安全解除。'),{code:'tavern_local_clear_fence_active'})}state.deletedConversationId=''}
  else this.save(false)
  if(render&&!this.data.historyBrowsing)this.renderLatest(state)
  return state
 },
 async resumeConversation(includeLegacy=false,generation=this.__conversationGeneration){
  if(!this.current())throw Error('账号状态已变化')
  const state=this.read(this.data.persona)
  if(state.clearPending)throw Object.assign(Error('云端清除尚未确认，请先重试清空。'),{code:'tavern_conversation_clear_pending'})
  let legacyImport=null
  if(includeLegacy&&state.legacyBackup.length&&!state.legacyImported){if(!state.legacyImportId)state.legacyImportId=legacyImportIdFor(this.data.persona,state.legacyBackup);legacyImport={importId:state.legacyImportId,messages:state.legacyBackup};this.save(false)}
  const envelope=await resumeTavernConversation({persona:this.data.persona,attemptId:this.__attemptId,conversationId:state.conversation?.id||'',legacyImport})
  if(!this.current()||generation!==this.__conversationGeneration||state!==this.read(this.data.persona))throw Object.assign(Error('对话页面已变化'),{code:'tavern_conversation_stale_page'})
  if(legacyImport&&!confirmedLegacyImport(state.legacyBackup,envelope,state.legacyImportId))throw Object.assign(Error('本机旧对话尚未完整同步，请重试。'),{code:'tavern_legacy_import_unconfirmed'})
  return this.applyEnvelope(state,envelope,{legacyConfirmed:Boolean(legacyImport),render:true})
 },
 async ensureConversation(includeLegacy,generation){const state=this.read(this.data.persona);if(!state.conversation||(includeLegacy&&state.legacyBackup.length&&!state.legacyImported))return this.resumeConversation(includeLegacy,generation);return state},
 chooseCategory(event){if(this.data.loading||this.data.examBlocked)return;const catalog=this.catalog(),category=String(event.currentTarget?.dataset?.category||'');if(!catalog.categories.some(item=>item.id===category))return;this.setData({category,visiblePersonas:Array.from(category==='all'?catalog.presets:catalog.presets.filter(item=>item.category===category),viewPreset)})},
 openSelector(){if(this.current()&&!this.data.loading&&!this.data.examBlocked)this.setData({selectorOpen:true})},
 choosePersona(event){if(!this.current()||this.data.loading||this.data.examBlocked)return;const persona=String(event.currentTarget?.dataset?.persona||'');if(!catalogPreset(this.catalog(),persona))return;if(this.data.presetChosen)this.save();this.loadPersona(persona,{chosen:true,open:false});this.rememberPersona(persona)},
 onMessage(event){
  if(!this.current()||this.data.loading||this.data.examBlocked||!this.data.presetChosen||this.data.selected.divinationKind)return
  const message=String(event.detail?.value||''),state=this.read(this.data.persona);if(state.pendingTurn&&state.pendingTurn.message!==message.trim())state.pendingTurn=null
  this.setData({message,error:'',authRequired:false});this.save()
 },
 onFortuneQuestion(event){
  if(!this.current()||this.data.loading||this.data.examBlocked||!this.data.selected.divinationKind)return
  const question=clip(event.detail?.value,600),state=this.read(this.data.persona);if(state.pendingTurn&&state.pendingTurn.message!==question.trim())state.pendingTurn=null
  this.setData({question,error:'',authRequired:false});this.save()
 },
 chooseSpread(event){if(!this.current()||this.data.loading||this.data.examBlocked||!this.data.selected.divinationKind)return;const spread=String(event.currentTarget?.dataset?.spread||'');if(!this.data.selected.supportedSpreads.includes(spread)||spread===this.data.spread)return;this.__fortuneRevision++;this.__pendingDrawNonce='';this.read(this.data.persona).pendingTurn=null;this.setData({spread,draw:null,drawNeedsRedraw:false,answer:'',error:'',canRetry:false,status:'已切换抽取方式，请重新抽取。'});this.save()},
 useStarter(event){if(!this.current()||this.data.loading||this.data.examBlocked||!this.data.presetChosen)return;const value=String(event.currentTarget?.dataset?.text||'');if(!this.data.starters.includes(value))return;if(this.data.selected.divinationKind)this.onFortuneQuestion({detail:{value}});else this.onMessage({detail:{value}})},
 preparePending(message,drawId=''){
  const state=this.read(this.data.persona),text=String(message||'').trim(),draw=String(drawId||'')
  if(!state.pendingTurn||state.pendingTurn.message!==text||state.pendingTurn.drawId!==draw)state.pendingTurn={id:newClientTurnId(),message:text,drawId:draw}
  this.save(false);return state.pendingTurn
 },
 applyCompletion(result,pending,{answer=result.answer,status='AI 已回应'}={}){
  const state=this.read(this.data.persona),currentRevision=state.conversation?.revision??-1
  if(result.clientTurnId!==pending.id||result.conversation.revision<currentRevision)return false
  if(result.conversation.revision===currentRevision){const known=new Set(state.turns.map(item=>item.id));if(result.turns.every(item=>known.has(item.id))){state.pendingTurn=null;this.renderLatest(state,{message:this.data.selected.divinationKind?this.data.message:'',answer,loading:false,interpretLoading:false,error:'',canRetry:false,authRequired:false,status});this.save(false);return true}return false}
  state.conversation=result.conversation;state.turns=mergeTavernMessages(state.turns,result.turns);state.historySource='cloud';state.pendingTurn=null
  this.renderLatest(state,{message:this.data.selected.divinationKind?this.data.message:'',answer,loading:false,interpretLoading:false,error:'',canRetry:false,authRequired:false,status})
  this.save();return true
 },
 async submit(){
  if(this.data.selected.divinationKind)return this.data.draw?this.retryInterpretation():this.drawFortune()
  const message=this.data.message.trim();if(!message||this.data.loading||!this.current()||this.data.examBlocked||!this.data.presetChosen)return;if(message.length>1200)return this.setData({error:'一次最多输入 1200 个字。'})
  const generation=this.__conversationGeneration,pending=this.preparePending(message),requestStamp=sessionStamp()
  this.setData({loading:true,error:'',answer:'',canRetry:false,authRequired:false,status:'AI 正在回应…'})
  try{
   const state=await this.ensureConversation(true,generation);if(generation!==this.__conversationGeneration)return;if(!this.current()){this.quiesceIdentityFailure(null,{status:'对话未完成'});return}
   const result=await sendTavernTurn({persona:this.data.persona,message,conversationId:state.conversation.id,clientTurnId:pending.id,expectedRevision:state.conversation.revision,attemptId:this.__attemptId})
   if(generation!==this.__conversationGeneration)return;if(!this.current()){this.quiesceIdentityFailure(null,{status:'对话未完成'});return}
   const answer=String(result?.answer||result?.message||'').trim(),completed=result?.mode==='ai'&&result?.providerStatus==='connected'&&Boolean(answer)
   if(!completed)throw Error(result?.failureMessage||'AI 本次没有完成回应，文字已保留，请重试。')
   if(!this.applyCompletion(result,pending,{answer,status:'AI 已回应'}))this.setData({error:'云端已有更新；旧回应未覆盖当前历史。',canRetry:true,status:'对话未完成'})
  }catch(error){
   if(generation!==this.__conversationGeneration)return
   const auth=isAuthError(error)
   if(this.staleSessionFailure(error,requestStamp,{status:'对话未完成'}))return
   if(revisionConflict(error)&&this.current())try{await this.resumeConversation(false,generation);this.setData({error:'云端对话已更新，请重试发送。',canRetry:true,status:'对话未完成'})}catch(refreshError){if(generation!==this.__conversationGeneration)return;if(this.quiesceIdentityFailure(refreshError,{status:'对话未完成'}))return;if(this.current())this.setData({error:refreshError.message||'云端历史刷新失败，请稍后重试。',canRetry:true,status:'对话未完成'})}
   else if(this.quiesceIdentityFailure(error,{status:'对话未完成'}))return
   else if(this.current()){this.setData({answer:'',error:error.message||'AI 暂时不可用，文字已保留。',canRetry:!auth,authRequired:auth,status:'对话未完成'});this.save()}
  }finally{if(this.current()||this.data.authRequired)this.setData({loading:false})}
 },
 async loadOlderHistory(){
  if(!this.current()||this.data.loading||this.data.historyLoading||this.data.examBlocked)return
  const generation=this.__conversationGeneration,state=this.read(this.data.persona),before=this.__browseNextBefore||state.nextBefore,requestStamp=sessionStamp()
  if(!state.conversation||!before)return
  this.setData({historyLoading:true,error:''})
  try{const envelope=await fetchTavernMessages({conversationId:state.conversation.id,persona:this.data.persona,before,attemptId:this.__attemptId});if(generation!==this.__conversationGeneration)return;if(!this.current()){this.quiesceIdentityFailure(null,{status:'对话未完成'});return}if(envelope.conversation.id!==state.conversation.id||envelope.conversation.revision<state.conversation.revision)throw Error('历史分页已过期，请回到最新对话。');state.conversation=envelope.conversation;this.__browseNextBefore=envelope.nextBefore;this.setData({turns:envelope.messages,historyAnchor:'',historySource:'cloud',historyBrowsing:true,hasOlderHistory:Boolean(envelope.nextBefore),historyLoading:false,status:'正在查看较早对话'});this.save(false)}catch(error){if(generation!==this.__conversationGeneration)return;if(this.staleSessionFailure(error,requestStamp,{status:'对话未完成'}))return;if(this.quiesceIdentityFailure(error,{status:'对话未完成'}))return;if(this.current())this.setData({historyLoading:false,error:error.message||'较早对话读取失败，请重试。'})}
 },
 returnLatestHistory(){if(!this.current())return;const state=this.read(this.data.persona);this.renderLatest(state,{status:''})},
 async drawFortune(){return this.startFortuneDraw(false)},
 async redrawFortune(){this.__pendingDrawNonce='';this.read(this.data.persona).pendingTurn=null;return this.startFortuneDraw(true)},
 async startFortuneDraw(fresh){
  if(!this.current()||this.data.loading||this.data.examBlocked||!this.data.selected.divinationKind)return
  const revision=++this.__fortuneRevision,requestStamp=sessionStamp();if(fresh||!this.__pendingDrawNonce)this.__pendingDrawNonce=newDrawNonce();const nonce=this.__pendingDrawNonce;this.read(this.data.persona).pendingTurn=null
  this.setData({loading:true,drawLoading:true,interpretLoading:false,answer:'',error:'',canRetry:false,authRequired:false,drawNeedsRedraw:false,status:'正在随机抽取…'});let draw
  try{draw=await requestTavernDraw({persona:this.data.persona,spread:this.data.spread,drawNonce:nonce,attemptId:this.__attemptId})}catch(error){if(revision!==this.__fortuneRevision)return;if(this.staleSessionFailure(error,requestStamp,{status:'抽取未完成'}))return;if(this.quiesceIdentityFailure(error,{status:'抽取未完成'})){this.__pendingDrawNonce='';return}if(this.current()){const auth=isAuthError(error),needs=redrawRequired(error);if(needs)this.__pendingDrawNonce='';this.setData({loading:false,drawLoading:false,interpretLoading:false,drawNeedsRedraw:needs,canRetry:false,authRequired:auth,error:auth?'登录已过期，请登录后继续。':needs?'抽取记录无效，请点击重新抽取。':error.message||'抽取未完成，请重试。',status:'抽取未完成'})}return}
  if(revision!==this.__fortuneRevision)return;if(!this.current()){this.quiesceIdentityFailure(null,{status:'抽取未完成'});return}this.__pendingDrawNonce='';this.setData({draw,drawLoading:false,interpretLoading:true,drawNeedsRedraw:false,error:'',status:'已抽取 · AI 正在解读…'});this.save();return this.interpretCurrent(revision)
 },
 async retryInterpretation(){if(!this.current()||this.data.loading||this.data.examBlocked||!this.data.draw||this.data.drawNeedsRedraw)return;const revision=++this.__fortuneRevision;this.setData({loading:true,drawLoading:false,interpretLoading:true,error:'',canRetry:false,authRequired:false,status:'正在重新解读…'});return this.interpretCurrent(revision)},
 async interpretCurrent(revision){
  const draw=this.data.draw,persona=this.data.persona,question=this.data.question;if(!draw)return
  const generation=this.__conversationGeneration,requestText=question.trim()||(persona==='eastern-oracle'?'请根据这次实际抽到的卦签做一段简洁的娱乐解读。':'请根据这次实际抽到的牌面做一段简洁的娱乐解读。'),pending=this.preparePending(requestText,draw.id),requestStamp=sessionStamp()
  try{
   const state=await this.ensureConversation(true,generation);if(generation!==this.__conversationGeneration||revision!==this.__fortuneRevision)return;if(!this.current()){this.quiesceIdentityFailure(null,{status:'解读未完成'});return}
   const result=await interpretTavernDraw({persona,drawId:draw.id,question,attemptId:this.__attemptId,conversationId:state.conversation.id,clientTurnId:pending.id,expectedRevision:state.conversation.revision})
   if(generation!==this.__conversationGeneration||revision!==this.__fortuneRevision||this.data.draw?.id!==draw.id)return;if(!this.current()){this.quiesceIdentityFailure(null,{status:'解读未完成'});return}
   const answer=String(result?.answer||result?.message||'').trim(),completed=result?.mode==='ai'&&result?.providerStatus==='connected'&&Boolean(answer);if(!completed)throw Error(result?.failureMessage||'AI 解读未完成，牌面和问题已保留，请重试解读。')
   if(!this.applyCompletion(result,pending,{answer,status:'娱乐解读已完成'}))this.setData({error:'云端已有更新；旧解读未覆盖当前历史。',canRetry:true,status:'解读未完成'})
  }catch(error){
   if(generation!==this.__conversationGeneration||revision!==this.__fortuneRevision)return
   if(this.staleSessionFailure(error,requestStamp,{status:'解读未完成'}))return
   if(this.quiesceIdentityFailure(error,{status:'解读未完成'}))return
   if(!this.current())return
   const auth=isAuthError(error),needs=redrawRequired(error)
   if(needs){this.__pendingDrawNonce='';this.read(this.data.persona).pendingTurn=null}this.setData({loading:false,interpretLoading:false,drawNeedsRedraw:needs,error:needs?'本次抽取已失效，请点击重新抽取。':'AI 解读未完成，牌面和问题已保留，请重试解读。',canRetry:!needs&&!auth,authRequired:auth,status:'解读未完成'});this.save()
  }
 },
 retry(){if(this.data.loading)return;if(this.data.selected.divinationKind){if(this.data.drawNeedsRedraw)return;if(this.data.draw)return this.retryInterpretation();return this.drawFortune()}return this.submit()},
 openAccount(){this.__authResumeRequested=true;wx.navigateTo({url:'/pages/account/auth'})},
 async clear(){
  if(this.data.loading||this.data.historyLoading||!this.current()||!this.data.presetChosen)return
  const generation=++this.__conversationGeneration,requestStamp=sessionStamp();this.__fortuneRevision++;this.__pendingDrawNonce='';let state=this.read(this.data.persona)
  if(this.__owner!=='guest'&&!hasSession()){state.clearPending=true;this.setData({clearPending:true,authRequired:true,error:'请先重新登录，再清空云端对话。',status:'清除未完成'});this.save(false);return}
  this.setData({loading:true,clearPending:true,error:'',warning:'',status:'正在清除云端对话…'});state.clearPending=true;this.save(false)
  try{
   if(!state.conversation&&hasSession()){
    state.clearPending=false;this.setData({clearPending:false});const envelope=await resumeTavernConversation({persona:this.data.persona,attemptId:this.__attemptId});if(generation!==this.__conversationGeneration)return;if(!this.current()){this.quiesceIdentityFailure(null,{status:'清除未完成',clearPending:true});return}state=this.applyEnvelope(state,envelope,{render:false});state.clearPending=true;this.setData({clearPending:true});this.save(false)
   }
   if(state.conversation)await deleteTavernConversation({conversationId:state.conversation.id,persona:this.data.persona,attemptId:this.__attemptId})
   if(generation!==this.__conversationGeneration)return;if(!this.current()){this.quiesceIdentityFailure(null,{status:'清除未完成',clearPending:true});return}
   const persona=this.data.persona,deletedConversationId=String(state.conversation?.id||''),fresh=emptyState(this.__owner,this.__epoch,persona),fortune=Boolean(this.data.selected.divinationKind);fresh.spread=fortune?this.data.selected.supportedSpreads[0]:'single';fresh.localClearFence=true;fresh.deletedConversationId=deletedConversationId;this.__states[persona]=fresh
   const fencePersisted=this.persistClearFence(persona,deletedConversationId);let persisted=true,removed=false;try{wx.setStorageSync(this.key(),fresh)}catch{persisted=false}if(!persisted)try{wx.removeStorageSync(this.key());removed=true}catch{}
   const localSecured=fencePersisted||persisted||removed
   this.setData({message:'',question:'',spread:fresh.spread,draw:null,drawLoading:false,interpretLoading:false,drawNeedsRedraw:false,turns:[],historyAnchor:'',hasOlderHistory:false,historyBrowsing:false,answer:'',loading:false,error:'',warning:localSecured?'':'云端对话已清除，但本机缓存隔离未能持久保存；请保持当前页面并释放本机空间。',canRetry:false,authRequired:false,clearPending:false,status:localSecured?'已清空当前角色对话':'云端对话已清除'})
  }catch(error){if(generation!==this.__conversationGeneration)return;if(this.staleSessionFailure(error,requestStamp,{status:'清除未完成',clearPending:true}))return;if(this.quiesceIdentityFailure(error,{status:'清除未完成',clearPending:true}))return;if(!this.current())return;state.clearPending=true;this.setData({loading:false,clearPending:true,error:'云端对话尚未清除，请重试。',warning:error.message||'',status:'清除未完成'});this.save(false)}
 },
})
