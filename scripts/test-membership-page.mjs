import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'

const manifest=JSON.parse(fs.readFileSync(new URL('../app.json',import.meta.url),'utf8'))
assert.ok(manifest.subPackages.find(item=>item.root==='bundles/account')?.pages.includes('membership'),'Membership must be a registered account subpackage page')

const plan={id:'all-access-month',title:'全功能月卡',priceFen:2880,priceLabel:'28.80',currency:'CNY',durationDays:30,autoRenew:false}
const orderId='M'+'a'.repeat(30)
const order={id:orderId,status:'pending',statusLabel:'待支付',planId:plan.id,priceFen:2880,priceLabel:'28.80',currency:'CNY',durationDays:30,createdAt:new Date().toISOString()}
const inactive={active:false,planId:'',startsAt:null,expiresAt:null,version:0}

function pageRuntime({enabled=false,resumeCanceled=false,pendingState='',orderState='pending',catalogReason='',invokeGate=null,envVersion='trial',payment=true,createOrderId=orderId,createStatus='pending',createEntitlement=null}={}){
 let pending=pendingState?{idempotencyKey:'server-recovery-key',orderId,paymentAttemptState:pendingState}:resumeCanceled?{idempotencyKey:'server-recovery-key',orderId,paymentAttemptState:'canceled'}:null,creates=0,invokes=0,reads=0,sequence=[],currentOrderState=orderState
 const runtime=miniRuntime({modules:{'bundles/account/membershipData':{
  context:()=>({owner:String(runtime.storage.get('stemistUser')?.id||'guest'),epoch:Number(runtime.storage.get('stemistPrivacyEpoch'))||0}),
  assertContext:expected=>{if(expected.owner!==String(runtime.storage.get('stemistUser')?.id||'guest')||expected.epoch!==(Number(runtime.storage.get('stemistPrivacyEpoch'))||0))throw Error('账号已变化')},
  fetchCatalog:async()=>({plan,commerce:{checkoutEnabled:enabled,reason:catalogReason||(enabled?'ready':'setup_required'),resumeCanceled},enforcement:{enabled:false}}),
  fetchStatus:async()=>({userId:String(runtime.storage.get('stemistUser')?.id||'guest'),entitlement:inactive}),fetchOrders:async()=>({orders:[],hasMore:false}),
  fetchOrder:async id=>{reads++;sequence.push('GET '+id);return{order:{...order,status:currentOrderState,statusLabel:currentOrderState},entitlement:currentOrderState==='fulfilled'?{...inactive,active:true,expiresAt:new Date(Date.now()+86400000).toISOString()}:inactive}},
  createOrder:async input=>{creates++;sequence.push('POST '+input.idempotencyKey);return{userId:'ielts:42',order:{...order,id:createOrderId,status:createStatus},entitlement:createEntitlement,...(payment?{payment:{provider:'wechat_virtual',parameters:{fixture:true}}}:{})}},
  invokePayment:async()=>{invokes++;sequence.push('INVOKE');if(invokeGate)await invokeGate.promise;return{submitted:true}},
  readPending:()=>pending,rememberPending:value=>{pending={...value}},forgetPending:()=>{pending=null},newIdempotencyKey:()=> 'new-key-must-not-be-used',
 }},wx:{getAccountInfoSync:()=>({miniProgram:{envVersion}}),getSystemInfoSync:()=>({platform:'android',windowWidth:390,windowHeight:844,deviceType:'phone'}),login:options=>options.success({code:'fresh-wx-code'}),setClipboardData:options=>{runtime.copied=options.data;options.success?.({})}}})
 runtime.storage.set('stemistUser',{id:'ielts:42',username:'opaque'})
 runtime.storage.set('stemistSessionToken','fixture-token')
 return{runtime,pending:()=>pending,counts:()=>({creates,invokes,reads}),sequence,setOrderState:value=>{currentOrderState=value}}
}

const safe=pageRuntime(),safePage=safe.runtime.page('bundles/account/membership')
safePage.onLoad();await safePage.onShow()
assert.equal(safePage.data.plan.priceLabel,'28.80')
assert.equal(safePage.data.checkoutEnabled,false)
assert.equal(safePage.data.canonicalUserId,'ielts:42')
safePage.copyTestUserId();assert.equal(safe.runtime.copied,'ielts:42')
safePage.data.consent=true;await safePage.purchase();assert.equal(safe.counts().creates,0,'Safe-off catalog never creates an order')
safePage.goBack();assert.equal(safe.runtime.calls.at(-1).url,'/pages/index/index','Root membership Back falls home safely')

const release=pageRuntime({envVersion:'release'}),releasePage=release.runtime.page('bundles/account/membership')
releasePage.onLoad();await releasePage.onShow();assert.equal(releasePage.data.trialMode,false);assert.equal(releasePage.data.canonicalUserId,'','Release mode never displays the test account ID')

const switched=pageRuntime(),switchedPage=switched.runtime.page('bundles/account/membership')
switchedPage.onLoad();await switchedPage.onShow();switchedPage.setData({consent:true,phase:'canceled',notice:'旧账号状态'})
switched.runtime.storage.set('stemistPrivacyEpoch',1);await switchedPage.onShow()
assert.equal(switchedPage.data.consent,false);assert.equal(switchedPage.data.phase,'idle');assert.equal(switchedPage.data.notice,'','Owner/privacy switch clears stale consent and transient purchase UI')
switchedPage.onUnload()

const resume=pageRuntime({enabled:true,resumeCanceled:true}),resumePage=resume.runtime.page('bundles/account/membership')
resumePage.onLoad();await resumePage.onShow();resumePage.setData({consent:true});await resumePage.purchase()
const postIndex=resume.sequence.indexOf('POST server-recovery-key'),invokeIndex=resume.sequence.indexOf('INVOKE')
assert.ok(postIndex>0&&resume.sequence[postIndex-1]==='GET '+orderId&&invokeIndex===postIndex+1,'Canceled recovery reconciles, posts the same key/order, then invokes once')
assert.equal(resume.counts().creates,1);assert.equal(resume.counts().invokes,1)
assert.equal(resume.pending().orderId,orderId);assert.notEqual(resume.pending().idempotencyKey,'new-key-must-not-be-used')
assert.equal(resumePage.data.entitlement.active,false,'Native callback never grants membership')
resumePage.onUnload()

const terminal=pageRuntime({enabled:true,resumeCanceled:true}),terminalPage=terminal.runtime.page('bundles/account/membership')
terminalPage.onLoad();await terminalPage.onShow();terminal.setOrderState('fulfilled');terminalPage.setData({consent:true});await terminalPage.purchase()
assert.equal(terminal.counts().creates,0);assert.equal(terminal.counts().invokes,0,'Server terminal state never invokes native payment')

const fulfilledRecovery=pageRuntime({enabled:false,pendingState:'unknown',orderState:'fulfilled',catalogReason:'testbuyer_canary_recovery_required'}),fulfilledRecoveryPage=fulfilledRecovery.runtime.page('bundles/account/membership')
fulfilledRecoveryPage.onLoad();await fulfilledRecoveryPage.onShow()
assert.equal(fulfilledRecoveryPage.data.checkoutEnabled,false);assert.equal(fulfilledRecovery.counts().invokes,0)
assert.equal(fulfilledRecoveryPage.data.entitlement.active,true)
assert.match(fulfilledRecoveryPage.data.checkoutLabel,/完成|生效/)
assert.doesNotMatch(fulfilledRecoveryPage.data.checkoutNote,/更新微信|固定测试买家/)
fulfilledRecoveryPage.onUnload()

const unknownRecovery=pageRuntime({enabled:false,pendingState:'unknown',orderState:'pending',catalogReason:'testbuyer_canary_recovery_required'}),unknownRecoveryPage=unknownRecovery.runtime.page('bundles/account/membership')
unknownRecoveryPage.onLoad();await unknownRecoveryPage.onShow()
assert.equal(unknownRecoveryPage.data.phase,'confirming');assert.match(unknownRecoveryPage.data.checkoutLabel,/确认/);assert.equal(unknownRecovery.counts().invokes,0)
assert.doesNotMatch(unknownRecoveryPage.data.checkoutNote,/更新微信|固定测试买家/)
unknownRecoveryPage.onUnload()

const refundedRecovery=pageRuntime({enabled:false,pendingState:'unknown',orderState:'refunded',catalogReason:'testbuyer_canary_recovery_required'}),refundedRecoveryPage=refundedRecovery.runtime.page('bundles/account/membership')
refundedRecoveryPage.onLoad();await refundedRecoveryPage.onShow()
assert.match(refundedRecoveryPage.data.checkoutLabel,/退款/);assert.match(refundedRecoveryPage.data.checkoutNote+refundedRecoveryPage.data.notice,/退款/);assert.equal(refundedRecovery.counts().invokes,0)
refundedRecoveryPage.onUnload()

const noPayment=pageRuntime({enabled:true,resumeCanceled:true,payment:false}),noPaymentPage=noPayment.runtime.page('bundles/account/membership')
noPaymentPage.onLoad();await noPaymentPage.onShow();noPaymentPage.setData({consent:true});await noPaymentPage.purchase()
assert.equal(noPayment.counts().creates,1);assert.equal(noPayment.counts().invokes,0,'POST without payment parameters never invokes native payment')
noPaymentPage.onUnload()

const fulfilledPost=pageRuntime({enabled:true,orderState:'fulfilled',createStatus:'fulfilled',payment:false}),fulfilledPostPage=fulfilledPost.runtime.page('bundles/account/membership')
fulfilledPostPage.onLoad();await fulfilledPostPage.onShow();fulfilledPostPage.setData({consent:true});await fulfilledPostPage.purchase()
assert.equal(fulfilledPost.counts().creates,1);assert.equal(fulfilledPost.counts().invokes,0);assert.ok(fulfilledPost.counts().reads>=1,'Fulfilled POST without entitlement fetches authoritative order status')
assert.equal(fulfilledPostPage.data.entitlement.active,true,'Missing POST entitlement never reuses stale inactive UI state')
fulfilledPostPage.onUnload()

const wrongOrder=pageRuntime({enabled:true,resumeCanceled:true,createOrderId:'M'+'b'.repeat(30)}),wrongOrderPage=wrongOrder.runtime.page('bundles/account/membership')
wrongOrderPage.onLoad();await wrongOrderPage.onShow();wrongOrderPage.setData({consent:true});await wrongOrderPage.purchase()
assert.equal(wrongOrder.counts().invokes,0,'Canceled recovery rejects a POST response for a different order')
wrongOrderPage.onUnload()

const gate=deferred(),hidden=pageRuntime({enabled:true,resumeCanceled:true,invokeGate:gate}),hiddenPage=hidden.runtime.page('bundles/account/membership')
hiddenPage.onLoad();await hiddenPage.onShow();hiddenPage.setData({consent:true});const purchasing=hiddenPage.purchase();
for(let i=0;i<5;i++)await settle()
assert.equal(hidden.counts().invokes,1)
hiddenPage.onHide();await hiddenPage.onShow();assert.equal(hiddenPage.data.busy,false,'Returning from native payment visibility cannot deadlock the page')
gate.resolve();await purchasing;assert.equal(hiddenPage.data.entitlement.active,false)
hiddenPage.onUnload()

const markup=fs.readFileSync(new URL('../bundles/account/membership.wxml',import.meta.url),'utf8')
const style=fs.readFileSync(new URL('../bundles/account/membership.wxss',import.meta.url),'utf8')
assert.match(markup,/¥{{plan\.priceLabel}}/);assert.match(markup,/30 天/);assert.match(markup,/非自动续费/)
assert.match(markup,/<stemist-header[^>]*compact="{{true}}"/,'Membership uses the compact native header to keep purchase controls in the first viewport')
assert.match(markup,/体验版使用真实支付，仅限已授权安卓账号/)
assert.match(markup,/测试账号标识/);assert.match(markup,/copyTestUserId/)
assert.match(markup,/不是 OpenID/,'Test identifier is explicitly distinguished from platform identity and secrets')
assert.match(markup,/wx:if="{{trialMode && loggedIn && canonicalUserId && !checkoutEnabled && checkoutLabel === '等待固定测试买家配置'}}"/,'Test-ID diagnostic card is shown only while waiting for buyer authorization, never after recovery or fulfillment')
const helperCopy=markup.match(/class="test-account-help">([^<]+)</)?.[1]||''
assert.ok(helperCopy.length>0&&helperCopy.length<=46&&!/Android|管理员|经会员服务核验/.test(helperCopy),'Test-ID helper stays one concise user-facing sentence with 安卓 wording')
assert.doesNotMatch(markup,/自动续费已开启|永久免费|免费试用/)
assert.match(markup,/checkoutLabel/,'Disabled checkout button uses server/order-state copy instead of a fixed setup label')
assert.match(style,/min-height:\s*4[48]px/);assert.match(style,/safe-area-inset-bottom/)

const authSource=fs.readFileSync(new URL('../bundles/account/auth.js',import.meta.url),'utf8'),authMarkup=fs.readFileSync(new URL('../bundles/account/auth.wxml',import.meta.url),'utf8')
assert.match(authSource,/openMembership/);assert.match(authMarkup,/会员中心/)
const homeSource=fs.readFileSync(new URL('../pages/ielts/home.js',import.meta.url),'utf8'),homeMarkup=fs.readFileSync(new URL('../pages/ielts/home.wxml',import.meta.url),'utf8')
assert.match(homeSource,/openMembership/);assert.match(homeMarkup,/打开会员中心/);assert.match(homeMarkup,/激活码/);assert.match(homeMarkup,/其他方式|已有/)

const logout=miniRuntime();logout.storage.set('stemistUser',{id:'ielts:42'});logout.storage.set('stemistMembershipPending:ielts%3A42',{owner:'ielts:42',idempotencyKey:'private-key',orderId});logout.load('utils/session').clearLocalSession({preserveDrafts:true});assert.ok(logout.storage.has('stemistMembershipPending:ielts%3A42'),'401 preserves same-owner recovery pointer');logout.storage.set('stemistUser',{id:'ielts:42'});logout.load('utils/session').clearLocalSession();assert.equal(logout.storage.has('stemistMembershipPending:ielts%3A42'),false,'Explicit logout removes private membership pointer')

console.log('Membership page: safe-off, trial ID, exact canceled resume, terminal/no-grant, visibility, routes and cleanup PASS')
