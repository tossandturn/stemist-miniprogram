import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const protocol='stemist-membership-v1'
const plan={id:'all-access-month',title:'全功能月卡',priceFen:2880,currency:'CNY',durationDays:30,autoRenew:false}
const orderId='M'+'a'.repeat(30)
const order={id:orderId,status:'pending',platform:'android',planId:plan.id,priceFen:2880,currency:'CNY',durationDays:30,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()}
const enforcement={enabled:false,appliesToExistingUsers:true}
const expiresAt=new Date(Date.now()+60*60*1000).toISOString()
const provider={id:'wechat_virtual',enabled:true,reason:'testbuyer_canary',platforms:['android']}
const canary=(recovery=null)=>({mode:'single-testbuyer',expiresAt,remainingNewOrders:recovery?0:1,recovery})
const catalog=(commerce={checkoutEnabled:false,reason:'setup_required',providers:[{...provider,enabled:false}],canary:null})=>({protocol,userId:'ielts:42',plan,commerce,enforcement})
let reply=catalog(),calls=[],virtualCalls=0,virtualResult='success'
const runtime=miniRuntime({modules:{
 'utils/api':{requestIeltsJson:async(path)=>{calls.push({path,kind:'public'});return reply}},
 'utils/ieltsLearning':{requestIeltsLearning:async(path,data,options)=>{calls.push({path,data,options,kind:'private'});return reply}},
},wx:{getSystemInfoSync:()=>({platform:'android'}),requestVirtualPayment(options){virtualCalls++;virtualResult==='success'?options.success({errMsg:'requestVirtualPayment:ok'}):options.fail({errMsg:virtualResult})}}})
runtime.storage.set('stemistUser',{id:'ielts:42',username:'opaque-user'})
runtime.storage.set('stemistSessionToken','fixture-token')
const service=runtime.load('bundles/account/membershipData')

reply=catalog()
let loaded=await service.fetchCatalog()
assert.equal(loaded.plan.priceLabel,'28.80')
assert.equal(loaded.plan.durationDays,30)
assert.equal(loaded.plan.autoRenew,false)
assert.equal(loaded.commerce.checkoutEnabled,false)
assert.equal(calls.at(-1).path,'/api/membership/catalog/private')
reply={...catalog(),plan:{...plan,priceFen:3000}}
await assert.rejects(service.fetchCatalog(),/方案|会员/,'The reviewed trial offer remains exactly CNY 28.80')

reply={protocol,userId:'ielts:42',entitlement:{active:false,planId:'',startsAt:null,expiresAt:null,version:0},enforcement}
assert.equal((await service.fetchStatus()).userId,'ielts:42','Canonical copy identity comes from owner-checked status')
reply={...reply,userId:'42'}
await assert.rejects(service.fetchStatus(),/账号/,'Non-canonical numeric status ID is never accepted for test-buyer copy')

// Exact owner/key/order cancellation recovery may resume the same order only.
const recovery={idempotencyKey:'canary-same-order-key',orderId}
service.rememberPending({...recovery,paymentAttemptState:'canceled'})
reply=catalog({checkoutEnabled:true,reason:'testbuyer_canary_recovery_required',providers:[provider],canary:canary(recovery)})
loaded=await service.fetchCatalog()
assert.equal(loaded.commerce.checkoutEnabled,true)
assert.equal(loaded.commerce.resumeCanceled,true)
assert.equal(service.readPending().paymentAttemptState,'canceled')
assert.equal(runtime.storage.get('stemistMembershipPending:ielts%3A42').epoch,0,'Recovery pointer is privacy-epoch bound')
runtime.storage.set('stemistPrivacyEpoch',1)
assert.equal(service.readPending(),null,'Same owner with a newer privacy epoch cannot reuse a canceled pointer')
loaded=await service.fetchCatalog()
assert.equal(loaded.commerce.checkoutEnabled,false,'Stale-epoch cancellation never reopens native payment')
assert.equal(service.readPending().paymentAttemptState,'unknown')
runtime.storage.set('stemistPrivacyEpoch',0)
service.rememberPending({...recovery,paymentAttemptState:'canceled'})

service.rememberPending({idempotencyKey:'different-local-key',orderId,paymentAttemptState:'canceled'})
loaded=await service.fetchCatalog()
assert.equal(loaded.commerce.checkoutEnabled,false,'Mismatched local key never resumes a server order')
assert.equal(loaded.commerce.reason,'testbuyer_canary_recovery_required','API-present Android recovery preserves the authoritative server reason')
assert.equal(service.readPending().idempotencyKey,recovery.idempotencyKey)
assert.equal(service.readPending().paymentAttemptState,'unknown')
service.rememberPending({...recovery,paymentAttemptState:'unknown'})
loaded=await service.fetchCatalog()
assert.equal(loaded.commerce.checkoutEnabled,false,'Unknown recovery remains query-only')
for(const state of ['launched','submitted']){
 service.rememberPending({...recovery,paymentAttemptState:state})
 loaded=await service.fetchCatalog()
 assert.equal(loaded.commerce.checkoutEnabled,false,`${state} recovery never reopens payment`)
}
reply=catalog({checkoutEnabled:true,reason:'testbuyer_canary_consumed',providers:[provider],canary:{mode:'single-testbuyer',expiresAt,remainingNewOrders:0,recovery:null}})
loaded=await service.fetchCatalog();assert.equal(loaded.commerce.checkoutEnabled,false);assert.equal(loaded.commerce.reason,'testbuyer_canary_consumed')
reply=catalog({checkoutEnabled:true,reason:'testbuyer_canary_expired',providers:[provider],canary:{mode:'single-testbuyer',expiresAt:new Date(Date.now()-1000).toISOString(),remainingNewOrders:1,recovery:null}})
loaded=await service.fetchCatalog();assert.equal(loaded.commerce.checkoutEnabled,false);assert.equal(loaded.commerce.reason,'testbuyer_canary_expired')

// Public catalog cannot authorize checkout for a guest even if malformed as ready.
runtime.storage.delete('stemistUser');runtime.storage.delete('stemistSessionToken')
reply={...catalog({checkoutEnabled:true,reason:'ready',providers:[provider],canary:null}),userId:undefined}
assert.equal((await service.fetchCatalog()).commerce.checkoutEnabled,false)
runtime.storage.set('stemistUser',{id:'ielts:42'});runtime.storage.set('stemistSessionToken','fixture-token')

// Checkout payload is exact; native success is never a client entitlement.
reply={protocol,userId:'ielts:42',order,payment:{provider:'wechat_virtual',parameters:{mode:'short_series_goods',signData:JSON.stringify({offerId:'fixture-offer',buyQuantity:1,env:0,currencyType:'CNY',productId:plan.id,goodsPrice:2880,outTradeNo:orderId}),paySig:'a'.repeat(64),signature:'b'.repeat(64)}}}
const checkout=await service.createOrder({idempotencyKey:recovery.idempotencyKey,wxCode:'fresh-code',platform:'android'})
assert.deepEqual(Object.keys(calls.at(-1).data).sort(),['clientCapability','idempotencyKey','planId','platform','wxCode'])
assert.equal(calls.at(-1).data.idempotencyKey,recovery.idempotencyKey)
assert.equal(checkout.order.id,orderId)
reply={protocol,userId:'ielts:42',order:{...order,status:'fulfilled'},entitlement:{active:true,planId:plan.id,startsAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),version:1}}
const fulfilledCheckout=await service.createOrder({idempotencyKey:recovery.idempotencyKey,wxCode:'fresh-code-fulfilled',platform:'android'})
assert.equal(fulfilledCheckout.entitlement.active,true,'Idempotent fulfilled POST preserves authoritative entitlement without native payment')
reply={protocol,userId:'ielts:42',order:{...order,status:'fulfilled'}}
const unconfirmedFulfilled=await service.createOrder({idempotencyKey:recovery.idempotencyKey,wxCode:'fresh-code-unconfirmed',platform:'android'})
assert.equal(unconfirmedFulfilled.entitlement,null,'Missing fulfilled entitlement remains explicitly unconfirmed for page reconciliation')
reply={protocol,userId:'ielts:42',order,payment:{provider:'wechat_virtual',parameters:{mode:'short_series_goods',signData:JSON.stringify({offerId:'fixture-offer',buyQuantity:1,env:0,currencyType:'CNY',productId:plan.id,goodsPrice:2880,outTradeNo:orderId}),paySig:'a'.repeat(64),signature:'b'.repeat(64)}}}
service.rememberPending({...recovery,paymentAttemptState:'canceled'})
await service.invokePayment(checkout,plan)
assert.equal(virtualCalls,1)
assert.equal(service.readPending().paymentAttemptState,'submitted')
assert.equal(runtime.storage.get('stemistUser').membership,undefined)
assert.doesNotMatch(JSON.stringify([...runtime.storage.values()]),/a{64}|b{64}/,'Payment signatures never enter storage')
await assert.rejects(service.invokePayment(checkout,plan),/确认/)
assert.equal(virtualCalls,1)

virtualResult='requestVirtualPayment:fail cancel'
service.rememberPending({...recovery,paymentAttemptState:'not_started'})
await assert.rejects(service.invokePayment(checkout,plan),/取消/)
assert.equal(service.readPending().paymentAttemptState,'canceled')
virtualResult='success'
await service.invokePayment(checkout,plan)
assert.equal(virtualCalls,3,'Explicit cancellation retries only the same checkout once')

virtualResult='requestVirtualPayment:fail network'
service.rememberPending({...recovery,paymentAttemptState:'not_started'})
await assert.rejects(service.invokePayment(checkout,plan),/确认/)
assert.equal(service.readPending().paymentAttemptState,'unknown')
await assert.rejects(service.invokePayment(checkout,plan),/确认/)
assert.equal(virtualCalls,4,'Unknown native outcome never opens another payment sheet')

console.log('Membership client: canonical owner, trusted plan, exact canceled recovery, payload, native callback and storage boundaries PASS')
