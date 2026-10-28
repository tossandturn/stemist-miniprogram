const {requestIeltsJson}=require('../../utils/api')
const {requestIeltsLearning}=require('../../utils/ieltsLearning')

const PROTOCOL='stemist-membership-v1',PLAN_ID='all-access-month',CAPABILITY='membership-checkout-v1',MAX_CANARY_MS=2*60*60*1000
const STATUS_LABELS={created:'创建中',pending:'待支付',paid:'开通确认中',processing:'确认中',fulfilled:'已开通',closed:'已关闭',failed:'未完成',refunded:'已退款',refund_pending:'退款处理中'}
const ORDER_ID=/^M[a-f0-9]{30}$/
const failure=(message,code='membership_invalid')=>Object.assign(new Error(message),{code})
const text=(value,max=120)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):''
const exact=(value,keys)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|'))
const context=()=>({owner:String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch:Number(wx.getStorageSync('stemistPrivacyEpoch'))||0})
function assertContext(expected){const current=context();if(current.owner!==expected.owner||current.epoch!==expected.epoch)throw failure('账号已变化，请重新打开会员中心。','account_changed')}
function protocol(value){if(!value||value.protocol!==PROTOCOL)throw failure('会员服务暂未就绪，请稍后重试。');return value}
function assertUser(value,expected){assertContext(expected);const id=String(value?.userId||'');if(!/^ielts:\d+$/.test(id)||id!==expected.owner)throw failure('会员账号校验未完成，请重新登录。','account_changed');return id}
function planData(plan){if(!plan||plan.id!==PLAN_ID||plan.priceFen!==2880||plan.currency!=='CNY'||plan.durationDays!==30||plan.autoRenew!==false)throw failure('会员方案暂不可用，请刷新后重试。');return{id:PLAN_ID,title:text(plan.title,50)||'全功能月卡',priceFen:2880,priceLabel:'28.80',currency:'CNY',durationDays:30,autoRenew:false}}
function entitlementData(value){if(!value||typeof value.active!=='boolean')throw failure('会员状态暂未确认，请重试。');if(value.active&&(!Number.isFinite(Date.parse(value.expiresAt))||Date.parse(value.expiresAt)<=Date.now()))throw failure('会员状态已变化，请刷新确认。');return{active:value.active,planId:text(value.planId),startsAt:value.startsAt||null,expiresAt:value.expiresAt||null,version:value.version}}
function orderData(order){if(!order||!ORDER_ID.test(order.id||'')||!Object.prototype.hasOwnProperty.call(STATUS_LABELS,order.status)||order.planId!==PLAN_ID||!Number.isSafeInteger(order.priceFen)||order.priceFen<=0||order.currency!=='CNY'||order.durationDays!==30)throw failure('订单信息暂未确认，请刷新订单。');return{id:order.id,status:order.status,statusLabel:STATUS_LABELS[order.status],planId:PLAN_ID,priceFen:order.priceFen,priceLabel:(order.priceFen/100).toFixed(2),currency:'CNY',durationDays:30,createdAt:order.createdAt||null,expiresAt:order.expiresAt||null,paidAt:order.paidAt||null}}
async function privateRequest(path,data,method='GET'){
 const expected=context();if(expected.owner==='guest'||!wx.getStorageSync('stemistSessionToken'))throw failure('请先登录后开通会员。','auth_required')
 const result=protocol(await requestIeltsLearning(path,data,{method,timeout:20000}));assertUser(result,expected);return result
}
async function fetchCatalog(){
 const expected=context(),authenticated=expected.owner!=='guest'&&Boolean(wx.getStorageSync('stemistSessionToken'))
 const value=authenticated?await privateRequest('/api/membership/catalog/private'):protocol(await requestIeltsJson('/api/membership/catalog',undefined,{method:'GET',timeout:10000}))
 assertContext(expected)
 if(typeof value.commerce?.checkoutEnabled!=='boolean'||typeof value.enforcement?.enabled!=='boolean'||value.enforcement.appliesToExistingUsers!==true)throw failure('会员服务暂未就绪，请稍后重试。')
 const validatedPlan=planData(value.plan)
 const providers=Array.isArray(value.commerce.providers)?value.commerce.providers.filter(item=>item?.id==='wechat_virtual').map(item=>({id:'wechat_virtual',enabled:item.enabled===true,reason:text(item.reason),platforms:Array.isArray(item.platforms)?item.platforms.filter(platform=>platform==='android'):[]})):[]
 let canary=null,canaryCanStart=false,resumeCanceled=false
 if(authenticated&&value.commerce.canary!==null){
  const source=value.commerce.canary
  if(!exact(source,['mode','expiresAt','remainingNewOrders','recovery'])||source.mode!=='single-testbuyer'||![0,1].includes(source.remainingNewOrders)||!Number.isFinite(Date.parse(source.expiresAt)))throw failure('测试支付授权无效，当前不会扣款。','membership_checkout_unavailable')
  let recovery=null
  if(source.recovery!==null){
   if(!exact(source.recovery,['idempotencyKey','orderId'])||!/^[A-Za-z0-9_-]{8,128}$/.test(source.recovery.idempotencyKey||'')||source.recovery.orderId!==null&&!ORDER_ID.test(source.recovery.orderId||''))throw failure('测试订单恢复信息无效，当前不会扣款。','membership_checkout_unavailable')
   recovery={idempotencyKey:source.recovery.idempotencyKey,orderId:source.recovery.orderId||''}
   const local=readPending()
   if(recovery.orderId){
    const same=local?.idempotencyKey===recovery.idempotencyKey&&local?.orderId===recovery.orderId,state=same&&['canceled','launched','submitted','unknown'].includes(local.paymentAttemptState)?local.paymentAttemptState:'unknown'
    rememberPending({...recovery,paymentAttemptState:state});resumeCanceled=state==='canceled';canaryCanStart=resumeCanceled
   }else{
    const unsafe=Boolean(local?.orderId)||['launched','submitted','unknown'].includes(local?.paymentAttemptState)
    if(!unsafe)rememberPending({...recovery,paymentAttemptState:'not_started'})
    canaryCanStart=!unsafe
   }
  }else canaryCanStart=source.remainingNewOrders===1
  canary={mode:'single-testbuyer',expiresAt:new Date(Date.parse(source.expiresAt)).toISOString(),remainingNewOrders:source.remainingNewOrders,recovery}
 }
 const platform=String(wx.getSystemInfoSync()?.platform||'').toLowerCase(),providerReady=providers.some(item=>item.enabled&&item.platforms.includes('android')),platformEligible=platform==='android'&&providerReady,apiAvailable=typeof wx.requestVirtualPayment==='function'
 const available=platformEligible&&apiAvailable,expires=Date.parse(canary?.expiresAt)
 const reasonAllows=value.commerce.reason==='testbuyer_canary'||value.commerce.reason==='testbuyer_canary_recovery_required'&&Boolean(canary?.recovery)
 const canaryReady=authenticated&&canaryCanStart&&Number.isFinite(expires)&&expires>Date.now()&&expires-Date.now()<=MAX_CANARY_MS&&reasonAllows
 const normalReady=authenticated&&value.commerce.canary===null&&value.commerce.reason==='ready'
 const checkoutEnabled=Boolean(value.commerce.checkoutEnabled&&(normalReady||canaryReady)&&available)
 const serverReason=text(value.commerce.reason)
 const reason=checkoutEnabled?'ready':value.commerce.checkoutEnabled&&!platformEligible?'platform_unavailable':value.commerce.checkoutEnabled&&!apiAvailable?'payment_unsupported':serverReason
 return{protocol:PROTOCOL,plan:validatedPlan,commerce:{checkoutEnabled,reason,providers,canary,resumeCanceled:checkoutEnabled&&resumeCanceled},enforcement:{enabled:value.enforcement.enabled,appliesToExistingUsers:true}}
}
async function fetchStatus(){const value=await privateRequest('/api/membership/status');return{...value,userId:String(value.userId),entitlement:entitlementData(value.entitlement)}}
async function fetchOrders(){const value=await privateRequest('/api/membership/orders');if(!Array.isArray(value.orders)||value.orders.length>50)throw failure('订单列表暂未加载完成。');return{orders:value.orders.map(orderData),hasMore:value.hasMore===true}}
async function fetchOrder(id){if(!ORDER_ID.test(id||''))throw failure('订单编号无效。');const value=await privateRequest('/api/membership/orders/'+encodeURIComponent(id)),order=orderData(value.order);if(order.id!==id)throw failure('订单编号不匹配。');return{order,entitlement:entitlementData(value.entitlement)}}
async function createOrder({idempotencyKey,wxCode,platform}){if(!/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey||''))throw failure('请重新发起开通。');if(platform!=='android')throw failure('当前体验仅支持 Android。','membership_platform_unavailable');const value=await privateRequest('/api/membership/orders',{planId:PLAN_ID,idempotencyKey,wxCode:text(wxCode,256),platform:'android',clientCapability:CAPABILITY},'POST'),order=orderData(value.order),entitlement=value.entitlement?entitlementData(value.entitlement):null;return{userId:String(value.userId),order,payment:value.payment,entitlement}}
async function invokePayment(checkout,plan){
 const expected=context();assertUser(checkout,expected)
 const order=orderData(checkout?.order),currentPlan=planData(plan)
 if(order.status!=='pending'||order.priceFen!==currentPlan.priceFen||order.currency!==currentPlan.currency||order.durationDays!==currentPlan.durationDays)throw failure('订单金额或会员方案已变化，请刷新订单。')
 const payment=checkout?.payment,input=payment?.parameters
 if(payment?.provider!=='wechat_virtual'||!input||typeof input.signData!=='string')throw failure('当前支付通道尚未开通。','payment_unavailable')
 let signed;try{signed=JSON.parse(input.signData)}catch{throw failure('支付参数无效，请刷新订单。')}
 if(input.mode!=='short_series_goods'||input.signData.length>4096||!/^[a-f0-9]{64}$/i.test(input.paySig||'')||!/^[a-f0-9]{64}$/i.test(input.signature||'')||signed.outTradeNo!==order.id||signed.goodsPrice!==order.priceFen||signed.buyQuantity!==1||signed.currencyType!=='CNY'||signed.env!==0||typeof signed.productId!=='string'||!signed.productId||!signed.offerId)throw failure('支付参数与订单不一致，请刷新订单。')
 if(typeof wx.requestVirtualPayment!=='function')throw failure('当前微信版本暂不能使用此支付通道，请更新微信后重试。','payment_unsupported')
 assertContext(expected)
 const pending=readPending();if(pending?.orderId!==order.id||pending.idempotencyKey===''||!['not_started','canceled'].includes(pending.paymentAttemptState))throw failure('该订单正在确认，请勿重复发起支付。','payment_confirmation_pending')
 rememberPending({...pending,paymentAttemptState:'launched'})
 const mark=state=>{assertContext(expected);const current=readPending();if(current?.orderId===order.id&&current.idempotencyKey===pending.idempotencyKey)rememberPending({...current,paymentAttemptState:state})}
 return new Promise((resolve,reject)=>wx.requestVirtualPayment({mode:input.mode,signData:input.signData,paySig:input.paySig,signature:input.signature,
  success(){try{mark('submitted');resolve({submitted:true})}catch(error){reject(error)}},
  fail(result){try{assertContext(expected)}catch(error){reject(error);return}const canceled=/cancel|取消/i.test(String(result?.errMsg||''));try{mark(canceled?'canceled':'unknown')}catch(error){reject(error);return}reject(failure(canceled?'已取消支付，可继续支付原订单。':'支付结果待确认，请查看订单，勿重复付款。',canceled?'payment_canceled':'payment_unconfirmed'))},
 }))
}
const pendingKey=()=> 'stemistMembershipPending:'+encodeURIComponent(context().owner)
function readPending(){const key=pendingKey(),value=wx.getStorageSync(key),current=context();if(current.owner==='guest'||value?.owner!==current.owner||!/^[A-Za-z0-9_-]{8,128}$/.test(value.idempotencyKey||''))return null;if(value.epoch!==current.epoch){wx.removeStorageSync(key);return null}return{idempotencyKey:value.idempotencyKey,orderId:ORDER_ID.test(value.orderId||'')?value.orderId:'',paymentAttemptState:['not_started','launched','submitted','unknown','canceled'].includes(value.paymentAttemptState)?value.paymentAttemptState:value.orderId?'unknown':'not_started'}}
function rememberPending(value){const current=context();if(current.owner==='guest'||!/^[A-Za-z0-9_-]{8,128}$/.test(value.idempotencyKey||''))throw failure('请先登录后开通会员。');wx.setStorageSync(pendingKey(),{owner:current.owner,epoch:current.epoch,idempotencyKey:value.idempotencyKey,orderId:ORDER_ID.test(value.orderId||'')?value.orderId:'',paymentAttemptState:['not_started','launched','submitted','unknown','canceled'].includes(value.paymentAttemptState)?value.paymentAttemptState:'not_started'})}
function forgetPending(){wx.removeStorageSync(pendingKey())}
const newIdempotencyKey=()=> 'member-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14)+Math.random().toString(36).slice(2,14)

module.exports={PROTOCOL,PLAN_ID,CAPABILITY,context,assertContext,planData,orderData,fetchCatalog,fetchStatus,fetchOrders,fetchOrder,createOrder,invokePayment,readPending,rememberPending,forgetPending,newIdempotencyKey}
