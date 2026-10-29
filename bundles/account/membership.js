const membership=require('./membershipData')
const {deviceState,syncDevice}=require('../../utils/page')
const {leaveAccount}=require('./accountNavigation')

function dateLabel(value){const date=new Date(value);if(!value||!Number.isFinite(date.getTime()))return'';const pad=n=>String(n).padStart(2,'0');return`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`}
function message(error){return({membership_checkout_unavailable:'微信支付尚未开放，当前不会创建订单或扣款。',membership_platform_unavailable:'当前设备的支付通道尚未就绪，请刷新订单。',ios_version_unsupported:'苹果支付需要微信 8.0.68 或更新版本。',auth_required:'请先登录后查看会员。',account_changed:'账号已变化，请重新打开会员中心。',payment_canceled:'已取消支付，可继续支付原订单。',payment_unconfirmed:'支付结果待确认，请勿重复付款。',payment_unsupported:'当前微信版本暂不能使用此支付通道，请更新微信后重试。',payment_unavailable:'支付参数尚未就绪，请刷新原订单。'})[error?.code]||'暂时未能完成，请重试；支付结果以订单确认为准。'}
function catalogCopy(reason){if(reason==='platform_unavailable')return{label:'当前设备不可开通',note:'当前设备的支付通道尚未开放，已有会员权益不受影响。'};if(reason==='ios_version_unsupported')return{label:'请先更新微信',note:'苹果支付需要微信 8.0.68 或更新版本；已有会员仍可使用。'};if(reason==='payment_unsupported')return{label:'当前微信不可支付',note:'当前微信版本缺少支付能力，请更新后重试。'};if(reason==='testbuyer_canary_recovery_required')return{label:'订单确认中',note:'已有测试订单，正在确认结果，请勿重复付款。'};if(reason==='testbuyer_canary_consumed')return{label:'测试资格已使用',note:'测试资格已使用，当前不会创建新订单。'};if(reason==='testbuyer_canary_expired')return{label:'测试资格已过期',note:'测试资格已过期，当前不会创建新订单。'};if(reason==='testbuyer_canary')return{label:'等待测试资格',note:'当前测试资格暂不可用，不会创建订单或扣款。'};return{label:'等待固定测试买家配置',note:'固定测试买家尚未配置，当前不会创建订单或扣款。'}}
function terminalCopy(status){return status==='refunded'?{label:'订单已退款',note:'测试订单已退款，不会再次发起支付。'}:status==='closed'?{label:'订单已关闭',note:'测试订单已关闭，不会再次发起支付。'}:{label:'订单未完成',note:'测试订单未完成，不会再次发起支付。'}}
function loginCode(){return new Promise((resolve,reject)=>wx.login({timeout:10000,success:result=>typeof result?.code==='string'&&result.code?resolve(result.code):reject(new Error('微信凭证暂未返回')),fail:()=>reject(new Error('微信凭证暂未返回'))}))}

Page({
 onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
 data:deviceState({loading:true,busy:false,loggedIn:false,trialMode:false,paymentPlatform:'',canonicalUserId:'',plan:null,entitlement:null,expiryLabel:'',checkoutEnabled:false,resumeCanceled:false,checkoutLabel:'当前不可开通',checkoutNote:'固定测试买家尚未配置，当前不会创建订单或扣款。',enforcementEnabled:false,consent:false,phase:'idle',notice:'',error:'',orderError:'',orders:[],hasMore:false,pendingOrderId:'',pendingOrderShort:''}),
 onLoad(){this._generation=0;this._visible=false;this._pollTimer=null;this._purchasing=false;this._lastContext=null;let envVersion='release';try{envVersion=String(wx.getAccountInfoSync?.().miniProgram?.envVersion||'release').toLowerCase()}catch{}const platform=typeof membership.devicePlatform==='function'?membership.devicePlatform():String(wx.getSystemInfoSync?.().platform||'').toLowerCase();this.setData({trialMode:['develop','trial'].includes(envVersion),paymentPlatform:platform})},
 onShow(){this._visible=true;if(this._purchaseAttempt){this._purchaseAttempt=null;this._purchasing=false}syncDevice(this);return this.refresh()},
 onResize(){syncDevice(this)},
 onHide(){this._visible=false;this._generation++;this.clearPoll()},
 onUnload(){this.onHide()},
 goBack(){leaveAccount()},
 login(){wx.navigateTo({url:'/bundles/account/auth'})},
 clearPoll(){if(this._pollTimer)clearTimeout(this._pollTimer);this._pollTimer=null},
 valid(generation,expected){if(!this._visible||this._generation!==generation)return false;try{membership.assertContext(expected);return true}catch{return false}},
 setEntitlement(value){this.setData({entitlement:value,expiryLabel:dateLabel(value?.expiresAt)})},
 async refresh(){
  this.clearPoll();const generation=++this._generation,expected=membership.context(),prior=this._lastContext,contextChanged=Boolean(prior&&(prior.owner!==expected.owner||prior.epoch!==expected.epoch));this._lastContext=expected;this._statusContext=null
  if(this._purchaseAttempt&&(this._purchaseAttempt.expected.owner!==expected.owner||this._purchaseAttempt.expected.epoch!==expected.epoch)){this._purchaseAttempt=null;this._purchasing=false}
  const loggedIn=expected.owner!=='guest'&&Boolean(wx.getStorageSync('stemistSessionToken'))
  this.setData({loading:true,busy:this._purchasing,loggedIn,canonicalUserId:'',checkoutEnabled:false,resumeCanceled:false,error:'',orderError:'',entitlement:null,expiryLabel:'',orders:[],pendingOrderId:'',pendingOrderShort:'',...(contextChanged?{consent:false,phase:'idle',notice:''}:{})})
  try{
   const catalog=await membership.fetchCatalog();if(!this.valid(generation,expected))return
   const changed=this.data.plan&&this.data.plan.priceFen!==catalog.plan.priceFen,copy=catalogCopy(catalog.commerce.reason)
   this.setData({plan:catalog.plan,checkoutEnabled:catalog.commerce.checkoutEnabled,resumeCanceled:catalog.commerce.resumeCanceled===true,checkoutLabel:copy.label,checkoutNote:copy.note,enforcementEnabled:catalog.enforcement.enabled,...(changed?{consent:false}:{})})
   if(!loggedIn)return
   const account=await membership.fetchStatus();if(!this.valid(generation,expected))return
   this._statusContext=expected;this.setEntitlement(account.entitlement);if(account.entitlement.active)this.setData({checkoutLabel:'测试订单已完成',checkoutNote:'会员状态已生效。'});if(this.data.trialMode)this.setData({canonicalUserId:account.userId})
   try{const result=await membership.fetchOrders();if(!this.valid(generation,expected))return;this.setData({orders:result.orders.map(order=>({...order,createdLabel:dateLabel(order.createdAt),shortId:order.id.slice(-10)})),hasMore:result.hasMore});if(!membership.readPending()){const unresolved=result.orders.find(order=>order.platform===this.data.paymentPlatform&&['created','pending','paid','processing'].includes(order.status));if(unresolved)membership.rememberPending({platform:unresolved.platform,idempotencyKey:'recover-'+unresolved.id,orderId:unresolved.id,paymentAttemptState:'unknown'})}}catch{if(this.valid(generation,expected))this.setData({orderError:'订单暂未加载，可点击刷新。'})}
   const pending=membership.readPending();if(pending?.orderId&&this.valid(generation,expected)){const canceled=pending.paymentAttemptState==='canceled';this.setData({pendingOrderId:pending.orderId,pendingOrderShort:pending.orderId.slice(-10),phase:canceled?'canceled':'confirming',...(canceled?{}:{checkoutLabel:'订单确认中',checkoutNote:'已有测试订单，正在确认结果，请勿重复付款。'})});await this.verifyOrder(pending.orderId,generation,expected,0)}
  }catch(error){if(this.valid(generation,expected))this.setData({error:message(error)})}
  finally{if(this.valid(generation,expected))this.setData({loading:false,busy:this._purchasing})}
 },
 copyTestUserId(){if(!this.data.trialMode||!/^ielts:\d+$/.test(this.data.canonicalUserId||'')||!this._statusContext)return;try{membership.assertContext(this._statusContext)}catch{return}if(this.data.canonicalUserId!==this._statusContext.owner)return;wx.setClipboardData({data:this.data.canonicalUserId,success:()=>{if(this._visible)wx.showToast?.({title:'测试账号标识已复制',icon:'success'})}})},
 consentChanged(event){this.setData({consent:Array.isArray(event.detail?.value)&&event.detail.value.includes('confirm'),error:''})},
 async purchase(){
  if(this._purchasing||this.data.busy||this.data.loading||!this.data.checkoutEnabled||!this.data.plan)return
  if(!this.data.loggedIn){this.login();return}
  if(!this.data.consent){this.setData({error:'请先确认价格、30 天有效期、非自动续费和体验版真实扣款提示。'});return}
  const generation=this._generation,expected=membership.context(),attemptToken={generation,expected};this._purchaseAttempt=attemptToken;this._purchasing=true;this.clearPoll();this.setData({busy:true,phase:'creating',error:'',notice:''})
  try{
   let pending=membership.readPending(),resumeOrderId=''
   if(pending?.orderId){
    const existing=await membership.fetchOrder(pending.orderId);if(!this.valid(generation,expected))return
    if(existing.order.status==='fulfilled'){this.applyConfirmed(existing);return}
    if(['refunded','closed','failed'].includes(existing.order.status)){const copy=terminalCopy(existing.order.status);this.setEntitlement(existing.entitlement);this.setData({phase:'idle',checkoutLabel:copy.label,checkoutNote:copy.note,notice:copy.note});return}
    if(existing.order.status!=='pending'||pending.paymentAttemptState!=='canceled'||!this.data.resumeCanceled){this.setData({phase:'confirming',checkoutLabel:'订单确认中',checkoutNote:'已有测试订单，正在确认结果，请勿重复付款。',notice:'支付结果确认中，请勿重复付款。'});await this.verifyOrder(existing.order.id,generation,expected,0);return}
    resumeOrderId=existing.order.id
   }
   if(!pending){pending={idempotencyKey:membership.newIdempotencyKey(),orderId:'',paymentAttemptState:'not_started'};membership.rememberPending(pending)}
   const wxCode=await loginCode();if(!this.valid(generation,expected))return
   const checkout=await membership.createOrder({idempotencyKey:pending.idempotencyKey,wxCode,platform:this.data.paymentPlatform});if(!this.valid(generation,expected))return
   if(resumeOrderId&&checkout.order.id!==resumeOrderId)throw Object.assign(new Error('恢复订单不匹配。'),{code:'payment_unconfirmed'})
   membership.rememberPending({idempotencyKey:pending.idempotencyKey,orderId:checkout.order.id,paymentAttemptState:pending.paymentAttemptState||'not_started'});this.setData({pendingOrderId:checkout.order.id,pendingOrderShort:checkout.order.id.slice(-10)})
   if(checkout.order.status==='fulfilled'){if(checkout.entitlement)this.applyConfirmed({order:checkout.order,entitlement:checkout.entitlement});else{this.setData({phase:'confirming',notice:'订单已完成，正在向服务端确认会员状态。'});await this.verifyOrder(checkout.order.id,generation,expected,0)}return}
   if(['paid','processing'].includes(checkout.order.status)||checkout.order.status!=='pending'||!checkout.payment){this.setData({phase:'confirming',checkoutLabel:'订单确认中',checkoutNote:'已有测试订单，正在确认结果，请勿重复付款。',notice:'订单已保留，正在等待服务端确认，请勿重复付款。'});await this.verifyOrder(checkout.order.id,generation,expected,0);return}
   this.setData({phase:'paying'});await membership.invokePayment(checkout,this.data.plan);if(!this.valid(generation,expected))return
   this.setData({phase:'confirming',notice:'支付已返回，正在确认开通结果，请勿重复付款。'});await this.verifyOrder(checkout.order.id,generation,expected,0)
  }catch(error){if(!this.valid(generation,expected))return;const known=membership.readPending();if(error?.code==='membership_checkout_unavailable'&&!known?.orderId)membership.forgetPending();this.setData({phase:error?.code==='payment_canceled'?'canceled':known?.orderId?'confirming':'idle',error:message(error)});if(known?.orderId&&error?.code!=='payment_canceled')await this.verifyOrder(known.orderId,generation,expected,5)}
  finally{if(this._purchaseAttempt===attemptToken){this._purchaseAttempt=null;this._purchasing=false;try{membership.assertContext(expected);if(this._visible)this.setData({busy:false})}catch{}}}
 },
 applyConfirmed(result){this.setEntitlement(result.entitlement);const owns=membership.readPending()?.orderId===result.order.id;if(owns){membership.forgetPending();this.clearPoll()}this.setData({...(owns?{phase:result.entitlement.active?'success':'idle',pendingOrderId:'',pendingOrderShort:''}:{}),checkoutLabel:'测试订单已完成',checkoutNote:result.entitlement.active?'会员状态已生效。':'订单已完成，会员状态已刷新。',notice:owns&&result.entitlement.active?'会员已开通，可以返回继续学习。':'该订单已完成，会员状态已刷新。',error:'',consent:false})},
 async verifyOrder(id,generation=this._generation,expected=membership.context(),attempt=0){
  try{const result=await membership.fetchOrder(id);if(!this.valid(generation,expected))return;if(result.order.status==='fulfilled'){this.applyConfirmed(result);return}if(['closed','failed','refunded'].includes(result.order.status)){const owns=membership.readPending()?.orderId===id,copy=terminalCopy(result.order.status);if(owns)membership.forgetPending();this.setEntitlement(result.entitlement);this.setData({...(owns?{phase:'idle',pendingOrderId:'',pendingOrderShort:''}:{}),checkoutLabel:copy.label,checkoutNote:copy.note,notice:copy.note});return}const canceled=membership.readPending()?.orderId===id&&membership.readPending()?.paymentAttemptState==='canceled';this.setData({phase:canceled?'canceled':'confirming',...(canceled?{}:{checkoutLabel:'订单确认中',checkoutNote:'已有测试订单，正在确认结果，请勿重复付款。'}),notice:canceled?'支付已取消，可继续支付同一原订单。':attempt>=5?'开通结果仍待确认，可稍后刷新订单，无需重复付款。':'正在确认订单，确认后自动更新会员状态。'});if(canceled)return;if(attempt<5){this.clearPoll();this._pollTimer=setTimeout(()=>{this._pollTimer=null;if(this.valid(generation,expected))this.verifyOrder(id,generation,expected,attempt+1)},Math.min(6000,1500+attempt*1000))}}
  catch(error){if(this.valid(generation,expected))this.setData({phase:'confirming',notice:'订单暂未确认，原订单已保留，请勿重复付款。',error:message(error)})}
 },
 checkOrder(event){if(this.data.busy)return;const id=event?.currentTarget?.dataset?.id||this.data.pendingOrderId;if(id){this.clearPoll();return this.verifyOrder(id)}},
})
