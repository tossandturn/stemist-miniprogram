import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const protocol='stemist-membership-v1',owner='ielts:42',orderId='M'+'c'.repeat(30)
const plan={id:'all-access-month',title:'全功能月卡',priceFen:2880,currency:'CNY',durationDays:30,autoRenew:false}
const expiresAt=new Date(Date.now()+3600000).toISOString()
const descriptor=(platform,extra={})=>({platform,checkoutEnabled:true,reason:'testbuyer_canary',mode:'single-testbuyer',expiresAt,remainingNewOrders:1,recovery:null,...extra})
function fixture({platform='ios',version='8.0.68'}={}){
 let reply,device={platform,version},nativeCalls=0,requests=[]
 const runtime=miniRuntime({modules:{
  'utils/ieltsLearning':{requestIeltsLearning:async(path,data)=>{requests.push({path,data});return reply}},
  'utils/api':{requestIeltsJson:async()=>reply},
 },wx:{getSystemInfoSync:()=>device,requestVirtualPayment:options=>{nativeCalls++;options.success({})}}})
 runtime.storage.set('stemistUser',{id:owner});runtime.storage.set('stemistSessionToken','synthetic-session')
 const service=runtime.load('bundles/account/membershipData')
 const catalog=(extra={})=>({protocol,userId:owner,plan,enforcement:{enabled:false,appliesToExistingUsers:true},commerce:{checkoutEnabled:false,reason:'setup_required',providers:[{id:'wechat_virtual',enabled:true,platforms:['android','ios']}],canary:null,platformCanaries:{ios:descriptor('ios')},...extra}})
 reply=catalog()
 return{runtime,service,catalog,reply:value=>{reply=value},device:value=>{device=value},requests,invocations:()=>nativeCalls}
}

const ios=fixture()
let view=await ios.service.fetchCatalog()
assert.equal(view.commerce.checkoutEnabled,true,'Authenticated iOS descriptor authorizes iPhone independently of Android canary')
assert.equal(view.commerce.platform,'ios')
assert.equal(view.commerce.canary.mode,'single-testbuyer')

for(const version of ['8.0.67','8.0.9','7.0.99','','unknown']){
 const f=fixture({version});const data=await f.service.fetchCatalog()
 assert.equal(data.commerce.checkoutEnabled,false,`iOS ${version||'missing version'} must not invoke payments`)
 assert.equal(data.commerce.reason,'ios_version_unsupported')
 await assert.rejects(f.service.createOrder({idempotencyKey:'iphone-test-key',wxCode:'synthetic',platform:'ios'}),/微信|版本/)
 assert.equal(f.requests.filter(item=>item.data?.wxCode).length,0,'Unsupported iOS must not even create an order')
}
for(const version of ['8.0.68','8.0.100','9.0.0'])assert.equal((await fixture({version}).service.fetchCatalog()).commerce.checkoutEnabled,true)
for(const platform of ['devtools','windows','mac'])assert.equal((await fixture({platform}).service.fetchCatalog()).commerce.checkoutEnabled,false)
for(const platformCanaries of [undefined,{}]){
 const f=fixture();f.reply(f.catalog({checkoutEnabled:true,reason:'ready',platformCanaries}))
 assert.equal((await f.service.fetchCatalog()).commerce.checkoutEnabled,true,'Accepted production catalog explicitly authorizes this platform')
 assert.equal(f.invocations(),0);assert.equal(f.requests.filter(item=>item.data?.wxCode).length,0)
}
for(const platform of ['android','ios']){
 const f=fixture({platform});f.reply(f.catalog({checkoutEnabled:true,reason:'ready',platformCanaries:{}}))
 f.service.rememberPending({idempotencyKey:'production-resume-key',orderId,paymentAttemptState:'canceled'})
 assert.equal((await f.service.fetchCatalog()).commerce.resumeCanceled,true,'Production cancellation must resume the same order too')
 f.service.rememberPending({idempotencyKey:'production-resume-key',orderId,paymentAttemptState:'unknown'})
 const uncertain=await f.service.fetchCatalog();assert.equal(uncertain.commerce.checkoutEnabled,false);assert.equal(uncertain.commerce.resumeCanceled,false)
 f.runtime.storage.delete('stemistSessionToken')
 assert.equal((await f.service.fetchCatalog()).commerce.checkoutEnabled,false,'Public catalog alone cannot authorize a purchase')
}

const wrong=fixture()
wrong.reply(wrong.catalog({platformCanaries:{ios:descriptor('android')}}))
await assert.rejects(wrong.service.fetchCatalog(),/授权|通道|平台/,'Descriptor cannot authorize a different platform')
wrong.reply(wrong.catalog({platformCanaries:{ios:descriptor('ios',{remainingNewOrders:2})}}))
await assert.rejects(wrong.service.fetchCatalog(),/授权/)
wrong.reply(wrong.catalog({platformCanaries:{ios:descriptor('ios',{expiresAt:new Date(Date.now()-1000).toISOString()})}}))
assert.equal((await wrong.service.fetchCatalog()).commerce.checkoutEnabled,false)

const payment=platform=>({protocol,userId:owner,order:{id:orderId,status:'pending',platform,planId:plan.id,priceFen:2880,currency:'CNY',durationDays:30},payment:{provider:'wechat_virtual',parameters:{mode:'short_series_goods',signData:JSON.stringify({offerId:'fixture-offer',buyQuantity:1,env:0,currencyType:'CNY',productId:'membership',goodsPrice:2880,outTradeNo:orderId}),paySig:'a'.repeat(64),signature:'b'.repeat(64)}}})
ios.reply(payment('ios'))
const checkout=await ios.service.createOrder({idempotencyKey:'iphone-test-key',wxCode:'synthetic',platform:'ios'})
assert.equal(ios.requests.at(-1).data.platform,'ios','iPhone POST must not hardcode Android')
assert.equal(checkout.order.platform,'ios')
ios.service.rememberPending({idempotencyKey:'iphone-test-key',orderId,paymentAttemptState:'not_started'})
await ios.service.invokePayment(checkout,plan)
assert.equal(ios.invocations(),1)
assert.equal(ios.service.readPending().paymentAttemptState,'submitted')
await assert.rejects(ios.service.invokePayment(checkout,plan),/确认/)
assert.equal(ios.invocations(),1,'Native success cannot cause another payment')
assert.equal(ios.runtime.storage.get('stemistUser').membership,undefined,'Only authoritative backend status grants membership')
assert.doesNotMatch(JSON.stringify([...ios.runtime.storage.values()]),/a{64}|b{64}/)

for(const platform of ['android',null,undefined]){
 const f=fixture();f.reply(payment(platform))
 await assert.rejects(f.service.createOrder({idempotencyKey:'iphone-test-key',wxCode:'synthetic',platform:'ios'}),/平台|通道|订单/)
 f.service.rememberPending({idempotencyKey:'iphone-test-key',orderId,paymentAttemptState:'canceled'})
 await assert.rejects(f.service.invokePayment({...payment(platform),userId:owner},plan),/平台|通道|订单/)
 assert.equal(f.invocations(),0)
}
await assert.rejects(ios.service.createOrder({idempotencyKey:'iphone-test-key',wxCode:'synthetic',platform:'android'}),/平台|通道|设备/,'Caller cannot spoof device platform')

const legacyAndroidKey='stemistMembershipPending:ielts%3A42',iosKey=legacyAndroidKey+':ios'
const isolate=fixture()
const androidPointer={owner,epoch:0,idempotencyKey:'old-android-key',orderId:'M'+'a'.repeat(30),paymentAttemptState:'canceled'}
isolate.runtime.storage.set(legacyAndroidKey,androidPointer)
assert.equal(isolate.service.readPending(),null,'An iPhone must not adopt the old Android storage slot')
isolate.service.rememberPending({idempotencyKey:'new-ios-key',orderId,paymentAttemptState:'canceled'})
assert.equal(isolate.runtime.storage.get(iosKey).platform,'ios')
assert.deepEqual(isolate.runtime.storage.get(legacyAndroidKey),androidPointer)
isolate.device({platform:'android'})
assert.equal(isolate.service.readPending().idempotencyKey,'old-android-key','Legacy Android pointer remains readable')
isolate.service.forgetPending();assert.equal(isolate.runtime.storage.has(iosKey),true,'Forgetting Android does not destroy the iOS pointer')
isolate.device({platform:'ios',version:'8.0.68'})
isolate.runtime.storage.set('stemistPrivacyEpoch',1)
assert.equal(isolate.service.readPending(),null,'iOS pending payment is privacy-epoch bound')
assert.equal(isolate.runtime.storage.has(iosKey),false)

const recovery=fixture()
recovery.reply(recovery.catalog({platformCanaries:{ios:descriptor('ios',{reason:'testbuyer_canary_recovery_required',remainingNewOrders:0,recovery:{idempotencyKey:'ios-recovered-key',orderId}})}}))
const restored=await recovery.service.fetchCatalog()
assert.equal(restored.commerce.checkoutEnabled,false,'A recovered order without explicit local cancellation is query-only')
assert.equal(recovery.service.readPending().paymentAttemptState,'unknown')
assert.equal(recovery.invocations(),0)
recovery.service.rememberPending({idempotencyKey:'ios-recovered-key',orderId,paymentAttemptState:'canceled'})
assert.equal((await recovery.service.fetchCatalog()).commerce.resumeCanceled,true)
recovery.runtime.storage.delete('stemistUser');recovery.runtime.storage.delete('stemistSessionToken')
assert.equal((await recovery.service.fetchCatalog()).commerce.checkoutEnabled,false,'A public response cannot grant test eligibility')

console.log('Membership dual platform: iOS version, private eligibility, platform/order binding, separate recovery and no client grant PASS')
