import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const owner='ielts:42',protocol='stemist-membership-v1',plan={id:'all-access-month',priceFen:2880,currency:'CNY',durationDays:30,autoRenew:false}
const oldId='M'+'a'.repeat(30),newId='M'+'b'.repeat(30)
let native,queryFailed=false,verifiedClosed=false,hasOrder=false,remoteStatus='pending',posts=[],nativeCalls=0,currentKey=''
const envelope=body=>({protocol,userId:owner,...body})
const order=(id=oldId)=>({id,platform:'android',status:remoteStatus,planId:plan.id,priceFen:2880,currency:'CNY',durationDays:30})
const inactive={active:false,expiresAt:null}
const runtime=miniRuntime({modules:{
 'utils/ieltsLearning':{requestIeltsLearning:async(path,data,options)=>{
  if(path.endsWith('/catalog/private'))return envelope({plan,enforcement:{enabled:false,appliesToExistingUsers:true},commerce:{checkoutEnabled:true,reason:hasOrder?'testbuyer_canary_recovery_required':'testbuyer_canary',providers:[{id:'wechat_virtual',enabled:true,platforms:['android']}],canary:{mode:'single-testbuyer',expiresAt:new Date(Date.now()+3600000).toISOString(),remainingNewOrders:hasOrder?0:1,recovery:hasOrder?{idempotencyKey:verifiedClosed?'replacement-key':currentKey,orderId:verifiedClosed?null:oldId}:null}}})
  if(path.endsWith('/status'))return envelope({entitlement:inactive})
  if(path.endsWith('/orders')&&options.method==='GET')return envelope({orders:hasOrder?[order()]:[],hasMore:false})
  if(path.endsWith('/orders')&&options.method==='POST'){
   posts.push(data);hasOrder=true;currentKey=data.idempotencyKey;const id=verifiedClosed?newId:oldId;remoteStatus='pending'
   return envelope({order:order(id),payment:{provider:'wechat_virtual',parameters:{mode:'short_series_goods',signData:JSON.stringify({offerId:'fixture-offer',buyQuantity:1,env:0,currencyType:'CNY',productId:'membership',goodsPrice:2880,outTradeNo:id}),paySig:'a'.repeat(64),signature:'b'.repeat(64)}}})
  }
  if(path.includes('/orders/')){if(queryFailed)throw Object.assign(Error('Synthetic query outage'),{code:'membership_provider_query_failed'});if(remoteStatus==='closed')verifiedClosed=true;return envelope({order:order(path.split('/').at(-1)),entitlement:inactive})}
  throw Error('Unexpected test route')
 }},
},wx:{getSystemInfoSync:()=>({platform:'android',windowWidth:390,windowHeight:844}),getAccountInfoSync:()=>({miniProgram:{envVersion:'trial'}}),login:o=>o.success({code:'synthetic'}),requestVirtualPayment:o=>{native=o;nativeCalls++}}})
runtime.storage.set('stemistUser',{id:owner});runtime.storage.set('stemistSessionToken','synthetic')
const service=runtime.load('bundles/account/membershipData'),page=runtime.page('bundles/account/membership')
page.onLoad();await page.onShow();page.setData({consent:true});const pending=page.purchase()
for(let i=0;i<8&&!native;i++)await settle()
assert.equal(nativeCalls,1)
page.onHide();queryFailed=true;await page.onShow()
native.fail({errCode:-2,errMsg:'requestVirtualPayment:fail'})
await pending;for(let i=0;i<8;i++)await settle()
assert.equal(service.readPending().paymentAttemptState,'canceled','Official numeric cancellation works without cancel text')
assert.equal(page.data.phase,'canceled','A late cancel after foregrounding cannot stay in confirming')
assert.equal(page.data.busy,false);assert.match(page.data.notice,/取消/)
assert.equal(page.data.checkoutEnabled,false,'The consumed trade number cannot be repaid')
assert.equal(posts.length,1);assert.equal(nativeCalls,1)
await page.purchase();assert.equal(posts.length,1)
queryFailed=false;remoteStatus='closed'
await page.checkOrder({currentTarget:{dataset:{id:oldId}}});for(let i=0;i<8;i++)await settle()
assert.equal(page.data.pendingOrderId,'');assert.equal(page.data.checkoutEnabled,true,'Verified closure refreshes the replacement eligibility')
assert.equal(page.data.consent,false,'Replacement requires renewed explicit confirmation')
assert.equal(service.readPending().idempotencyKey,'replacement-key')
assert.equal(posts.length,1,'Closing an order never initiates the next payment')
page.setData({consent:true});const replacement=page.purchase();for(let i=0;i<8&&nativeCalls<2;i++)await settle()
assert.equal(nativeCalls,2);assert.equal(posts.at(-1).idempotencyKey,'replacement-key');assert.equal(JSON.parse(native.signData).outTradeNo,newId)
native.fail({errCode:-2,errMsg:'requestVirtualPayment:fail cancel'});await replacement
page.onUnload()
console.log('Membership cancel lifecycle: numeric -2, foreground-before-callback, query outage, verified-close replacement and no duplicate payment PASS')
