import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'

function identity(runtime,{expired=true,kind='wechat'}={}){
 runtime.storage.set('stemistUser',{id:'ielts:42',displayName:'小雨'})
 runtime.storage.set('stemistSessionToken','old-token')
 runtime.storage.set('stemistSessionMeta',{owner:'ielts:42',kind,expiresAt:new Date(Date.now()+(expired?-1000:300000)).toISOString()})
 if(kind==='password')runtime.storage.set('stemistNativeSessionCookie','synthetic-cookie')
 runtime.load('utils/entryAccess').acceptConsent()
}
const renewed=()=>({authenticated:true,id:'ielts:42',accessToken:'renewed-token',expiresAt:new Date(Date.now()+300000).toISOString(),identity:{id:'ielts:42',displayName:'小雨'}})
test('logged-in account and login form use independent explicit predicates',()=>{
 const markup=fs.readFileSync(new URL('../bundles/account/auth.wxml',import.meta.url),'utf8')
 assert.match(markup,/<block wx:if="\{\{!user\}\}">\s*<view class="card-title">微信登录/)
})
function protectedPage(runtime,counts){
 const definition=runtime.load('utils/entryAccess').wrapEntryPage({data:{},onLoad(){counts.loads++},onShow(){counts.shows++},onHide(){counts.hides++}})
 return{...definition,route:'pages/coach/index',data:{...definition.data},setData(value){Object.assign(this.data,value)}}
}
function fixture(extra={}){
 const navigations=[],counts={loads:0,shows:0,hides:0},requests=[]
 const runtime=miniRuntime({wx:{getPrivacySetting:o=>o.success({needAuthorization:false}),reLaunch:o=>{navigations.push(o.url);o.success?.()},login:o=>o.success({code:'synthetic-code'}),request:o=>{requests.push(o);o.success({statusCode:200,data:renewed()});return{abort(){}}},...extra}})
 return{runtime,navigations,counts,requests}
}

test('expired existing session renews before a protected page redirects',async()=>{
 const f=fixture();identity(f.runtime)
 const page=protectedPage(f.runtime,f.counts),work=page.onLoad({source:'alevel'});page.onShow();await work;await settle()
 assert.equal(f.navigations.length,0,'switching pages must not become a new login')
 assert.equal(f.requests.length,1);assert.equal(f.counts.loads,1);assert.equal(f.counts.shows,1)
 assert.equal(page.data.__entryGateBlocked,false)
})
test('foreground expiry preserves initialized page and renews only once',async()=>{
 const f=fixture();identity(f.runtime,{expired:false});const page=protectedPage(f.runtime,f.counts)
 await page.onLoad({});await page.onShow();page.onHide()
 f.runtime.storage.set('stemistSessionMeta',{...f.runtime.storage.get('stemistSessionMeta'),expiresAt:new Date(0).toISOString()})
 await page.onShow();await settle()
 assert.equal(f.navigations.length,0);assert.equal(f.requests.length,1);assert.equal(f.counts.loads,1);assert.equal(f.counts.shows,2)
})
test('privacy lookup failure never erases previously explicit consent',async()=>{
 const f=fixture({getPrivacySetting:o=>o.fail({errMsg:'temporary network failure'})});identity(f.runtime,{expired:false})
 const gate=f.runtime.load('utils/entryAccess');await gate.prepareEntry()
 assert.equal(gate.consentAccepted(),true);assert.equal(gate.canEnter(),true)
})
test('unknown privacy never creates agreement for a new guest',async()=>{
 const f=fixture({getPrivacySetting:o=>o.fail({})}),gate=f.runtime.load('utils/entryAccess');await gate.prepareEntry()
 assert.equal(gate.consentAccepted(),false);assert.equal(gate.canEnter(),false)
})
test('known privacy revocation still blocks and clears saved agreement',async()=>{
 const f=fixture({getPrivacySetting:o=>o.success({needAuthorization:true})});identity(f.runtime,{expired:false})
 const gate=f.runtime.load('utils/entryAccess');await gate.prepareEntry()
 assert.equal(gate.consentAccepted(),false);assert.equal(gate.canEnter(),false)
})
test('offline renewal preserves identity and retries on page resume without login loop',async()=>{
 let offline=true;const f=fixture({request:o=>{offline?o.fail({errMsg:'request:fail'}):o.success({statusCode:200,data:renewed()});return{abort(){}}}});identity(f.runtime)
 const page=protectedPage(f.runtime,f.counts);await page.onLoad({});await settle()
 assert.equal(f.runtime.storage.get('stemistUser').id,'ielts:42');assert.equal(f.navigations.length,0);assert.equal(f.counts.loads,0)
 offline=false;await page.onShow();await settle()
 assert.equal(f.navigations.length,0);assert.equal(f.counts.loads,1);assert.equal(page.data.__entryGateBlocked,false)
})
test('leaving during renewal cannot initialize or navigate a discarded page',async()=>{
 const delayed=deferred();const f=fixture({request:o=>{delayed.promise.then(()=>o.success({statusCode:200,data:renewed()}));return{abort(){}}}});identity(f.runtime)
 const page=protectedPage(f.runtime,f.counts),work=page.onLoad({});page.onUnload();delayed.resolve();await work;await settle()
 assert.equal(f.counts.loads,0);assert.equal(f.navigations.length,0)
})
test('a 401 renews a still-dated token once and replays only the rejected request',async()=>{
 let calls=0,refresh=0;const f=fixture({request:o=>{
  if(o.url.endsWith('/api/auth/wechat')){refresh++;o.success({statusCode:200,data:renewed()})}
  else {calls++;o.success({statusCode:calls===1?401:200,data:calls===1?{}:{ok:true}})}
  return{abort(){}}
 }});identity(f.runtime,{expired:false})
 const result=await f.runtime.load('utils/api').requestJson('/api/stem/profile',undefined,{method:'GET'})
 assert.equal(result.ok,true);assert.equal(refresh,1);assert.equal(calls,2);assert.equal(f.runtime.storage.get('stemistUser').id,'ielts:42')
})
test('concurrent delayed 401 responses share the new token rather than clearing it',async()=>{
 const pending=[];let refresh=0
 const f=fixture({request:o=>{
  if(o.url.endsWith('/api/auth/wechat')){refresh++;o.success({statusCode:200,data:renewed()})}
  else if(o.header.Authorization==='Bearer old-token')pending.push(o)
  else o.success({statusCode:200,data:{ok:true}})
  return{abort(){}}
 }});identity(f.runtime,{expired:false});const api=f.runtime.load('utils/api')
 const first=api.requestJson('/api/stem/profile',undefined,{method:'GET'}),second=api.requestJson('/api/stem/membership',undefined,{method:'GET'})
 await settle();pending[0].success({statusCode:401,data:{}});await settle();pending[1].success({statusCode:401,data:{}})
 assert.equal((await first).ok,true);assert.equal((await second).ok,true);assert.equal(refresh,1);assert.equal(f.runtime.storage.get('stemistSessionToken'),'renewed-token')
})
test('renewal network failure does not turn a recoverable 401 into logout',async()=>{
 const f=fixture({request:o=>{if(o.url.endsWith('/api/auth/wechat'))o.fail({errMsg:'timeout'});else o.success({statusCode:401,data:{}});return{abort(){}}}});identity(f.runtime,{expired:false})
 await assert.rejects(f.runtime.load('utils/api').requestJson('/api/stem/profile',undefined,{method:'GET'}))
 assert.equal(f.runtime.storage.get('stemistUser').id,'ielts:42');assert.equal(f.runtime.storage.get('stemistSessionToken'),'old-token')
})
test('a second 401 remains terminal and preserves owned drafts',async()=>{
 let calls=0;const f=fixture({request:o=>{calls++;o.success({statusCode:o.url.endsWith('/api/auth/wechat')?200:401,data:o.url.endsWith('/api/auth/wechat')?renewed():{}});return{abort(){}}}});identity(f.runtime,{expired:false});f.runtime.storage.set('stemistDraft:writing',{text:'owned draft'})
 await assert.rejects(f.runtime.load('utils/api').requestJson('/api/stem/profile',undefined,{method:'GET'}),e=>e.statusCode===401)
 assert.equal(calls,3);assert.equal(f.runtime.storage.get('stemistSessionToken'),undefined);assert.equal(f.runtime.storage.get('stemistDraft:writing').text,'owned draft')
})
test('the account page renews an existing session without asking to sign in again',async()=>{
 const f=fixture();identity(f.runtime)
 const page=f.runtime.page('bundles/account/auth');page.onLoad({});await page.onShow();await settle()
 assert.equal(f.runtime.storage.get('stemistSessionToken'),'renewed-token');assert.equal(page.data.user.id,'ielts:42')
 assert.equal(page.data.sessionRecovering,false);assert.equal(f.navigations.length,0)
})
test('account privacy lookup failure does not re-display agreement for an existing account',async()=>{
 const f=fixture({getPrivacySetting:o=>o.fail({})});identity(f.runtime,{expired:false})
 const page=f.runtime.page('bundles/account/auth');page.onLoad({});await page.onShow();await settle()
 assert.equal(page.data.privacy,false);assert.equal(f.runtime.load('utils/entryAccess').consentAccepted(),true)
})
test('profile returns from background during load by retrying, not staying blank',async()=>{
 const old=deferred();let calls=0;const profile={ownerId:'ielts:42',displayName:'小雨',avatarDataUrl:''}
 const r=miniRuntime({modules:{'utils/api':{requestJson:()=>{calls++;return calls===1?old.promise:Promise.resolve({protocol:'stem-user-profile-v1',profile})}}}});identity(r,{expired:false})
 const page=r.page('bundles/account/profile'),first=page.onLoad();page.onHide();await page.onShow();old.resolve({protocol:'stem-user-profile-v1',profile:{...profile,displayName:'stale'}});await first;await settle()
 assert.equal(calls,2);assert.equal(page.data.loaded,true);assert.equal(page.data.displayName,'小雨')
})
test('nickname editing survives a background cycle but empty verified form stays rejected',async()=>{
 let saves=0;const r=miniRuntime({modules:{'utils/api':{requestJson:async(path,data)=>{if(data)saves++;return{protocol:'stem-user-profile-v1',profile:{ownerId:'ielts:42',displayName:'',avatarDataUrl:'',...data}}}}},wx:{showToast(){}}});identity(r,{expired:false})
 const page=r.page('bundles/account/profile');await page.onLoad();page.onNicknameInput({detail:{value:'新昵称'}});page.onHide();await page.onShow()
 assert.equal(page.data.displayName,'新昵称');await page.submit({detail:{value:{nickname:''}}});assert.equal(saves,0)
 await page.submit({detail:{value:{nickname:'新昵称'}}});assert.equal(saves,1);assert.equal(r.storage.get('stemistUser').displayName,'新昵称')
})
test('iOS transport timeout is retryable with a fresh one-time WeChat code and original destination',async()=>{
 let code=0,requests=[];const app={globalData:{entryReturn:{url:'/pages/coach/index',owner:''}}}
 const r=miniRuntime({globals:{getApp:()=>app},wx:{login:o=>o.success({code:'synthetic-code-'+(++code)}),request:o=>{requests.push(o);if(requests.length===1)o.fail({errMsg:'request:fail timeout',errno:5});else o.success({statusCode:200,data:renewed()});return{abort(){}}},getPrivacySetting:o=>o.success({needAuthorization:false}),showToast(){},reLaunch:o=>{r.calls.push(o);o.success?.()}}})
 r.load('utils/entryAccess').acceptConsent();const page=r.page('bundles/account/auth');page.onLoad({required:'1'});page.onShow()
 await page.loginWechat();assert.match(page.data.error,/超时/);assert.equal(page.data.wechatLoading,false);assert.equal(r.load('utils/entryAccess').consentAccepted(),true);assert.equal(app.globalData.entryReturn.url,'/pages/coach/index')
 await page.loginWechat();assert.equal(code,2);assert.notEqual(requests[0].data.code,requests[1].data.code);assert.equal(requests.length,2,'never automatically replay an exchange code after timeout')
 assert.equal(page.data.user.id,'ielts:42');assert.equal(r.calls.at(-1).url,'/pages/coach/index')
})
test('payment creation is never replayed automatically even after a successful session refresh',async()=>{
 let payments=0,refreshes=0;const f=fixture({request:o=>{if(o.url.endsWith('/api/auth/wechat')){refreshes++;o.success({statusCode:200,data:renewed()})}else{payments++;o.success({statusCode:401,data:{}})}return{abort(){}}}});identity(f.runtime,{expired:false})
 await assert.rejects(f.runtime.load('utils/api').requestJson('/api/membership/orders',{plan:'synthetic'}),e=>e.code==='session_refreshed')
 assert.equal(payments,1);assert.equal(refreshes,1);assert.equal(f.runtime.storage.get('stemistSessionToken'),'renewed-token')
})
test('session rejection metadata cannot expose a credential through JSON serialization',async()=>{
 const f=fixture({request:o=>{o.success({statusCode:401,data:{}});return{abort(){}}}});identity(f.runtime,{expired:false})
 const error=await f.runtime.load('utils/api').requestJson('/api/auth/status').catch(e=>e)
 assert.doesNotMatch(JSON.stringify(error),/old-token|rejectedToken/)
})
test('actual iOS proxy-tunnel failure is distinguished from server latency without discarding identity',async()=>{
 const proxy={errMsg:'request:fail errcode:-111 cronet_error_code:-111 error_msg:net::ERR_TUNNEL_CONNECTION_FAILED',errno:600001}
 const r=miniRuntime({wx:{login:o=>o.success({code:'synthetic-fresh-code'}),request:o=>{o.fail(proxy);return{abort(){}}}}});identity(r)
 await assert.rejects(r.load('utils/nativeSession').refreshNativeSession(),e=>e.code==='network_proxy_tunnel'&&/代理.*切换网络/.test(e.message))
 assert.equal(r.storage.get('stemistSessionToken'),'old-token');assert.equal(r.load('utils/entryAccess').consentAccepted(),true)
 r.storage.set('stemistSessionMeta',{...r.storage.get('stemistSessionMeta'),expiresAt:new Date(Date.now()+300000).toISOString()})
 await assert.rejects(r.load('utils/api').requestJson('/api/stem/profile',undefined,{method:'GET'}),e=>e.code==='network_proxy_tunnel')
})
test('wx.login platform transport errors preserve the specific network recovery advice',async()=>{
 const r=miniRuntime({wx:{login:o=>o.fail({errMsg:'login:fail net::ERR_TUNNEL_CONNECTION_FAILED'})}})
 await assert.rejects(r.load('utils/wechatAuth').beginWeChatLogin().promise,e=>e.code==='network_proxy_tunnel'&&/代理/.test(e.message))
 assert.equal(r.storage.get('stemistSessionToken'),undefined)
})
test('intentional request abort is cancellation, with no automatic retry or logout',async()=>{
 let requests=0;const r=miniRuntime({wx:{request:o=>{requests++;o.fail({errMsg:'request:fail abort',errno:600004});return{abort(){}}}}});identity(r,{expired:false})
 await assert.rejects(r.load('utils/api').requestJson('/api/stem/profile',undefined,{method:'GET'}),e=>e.code==='request_cancelled')
 assert.equal(requests,1);assert.equal(r.storage.get('stemistSessionToken'),'old-token')
})
for(const replay of [false,true])for(const change of ['account','privacy','cancel'])test(`${replay?'renewed replay':'initial GET'} discards success arriving across ${change} boundary`,async()=>{
 let pending,privateCalls=0,cancelled=false
 const f=fixture({request:o=>{
  if(o.url.endsWith('/api/auth/wechat'))o.success({statusCode:200,data:renewed()})
  else if(++privateCalls===1&&replay)o.success({statusCode:401,data:{}})
  else pending=o
  return{abort(){}}
 }});identity(f.runtime,{expired:false})
 const result=f.runtime.load('utils/api').requestJson('/api/stem/profile',undefined,{method:'GET',isCancelled:()=>cancelled})
 await settle();assert.ok(pending)
 // Resolve the transport before changing cancellation to exercise the narrow
 // gap between a native callback and the awaiting promise continuation.
 pending.success({statusCode:200,data:{owner:'ielts:42',privateValue:'synthetic-old-owner'}})
 if(change==='account'){f.runtime.storage.set('stemistUser',{id:'ielts:99'});f.runtime.storage.set('stemistSessionToken','new-owner-token')}
 if(change==='privacy')f.runtime.storage.set('stemistPrivacyEpoch',1)
 if(change==='cancel')cancelled=true
 await assert.rejects(result,e=>e.code===(change==='cancel'?'request_cancelled':'account_changed'))
 assert.equal(privateCalls,replay?2:1,'a rejected late result never starts an extra replay')
 assert.equal(f.runtime.storage.get('stemistSessionToken'),change==='account'?'new-owner-token':replay?'renewed-token':'old-token')
})
test('binary response also checks identity after native success',async()=>{
 let pending;const f=fixture({request:o=>{pending=o;return{abort(){}}}});identity(f.runtime,{expired:false})
 const result=f.runtime.load('utils/api').requestBinary('/api/tavern/image',{})
 await settle();pending.success({statusCode:200,header:{'content-type':'image/png'},data:new Uint8Array([1,2,3]).buffer})
 f.runtime.storage.set('stemistUser',{id:'ielts:99'});f.runtime.storage.set('stemistSessionToken','new-owner-token')
 await assert.rejects(result,e=>e.code==='account_changed');assert.equal(f.runtime.storage.get('stemistSessionToken'),'new-owner-token')
})
test('a missing iOS exchange callback has the existing 10s deadline, ignores late success, and retries a fresh code',async()=>{
 let requests=[],codes=0,aborts=0
 const r=miniRuntime({globals:{setTimeout:(callback,ms)=>setTimeout(callback,ms===10000?15:ms)},wx:{login:o=>o.success({code:'synthetic-fresh-code-'+(++codes)}),request:o=>{requests.push(o);return{abort(){aborts++}}}}})
 const service=r.load('utils/wechatAuth'),first=service.beginWeChatLogin(),outcome=first.promise.then(()=> 'unexpected-success',e=>e.code)
 const result=await Promise.race([outcome,new Promise(resolve=>setTimeout(()=>resolve('unsettled'),70))])
 if(result==='unsettled')first.cancel()
 assert.equal(result,'wechat_login_timeout','the native SDK missing its callback must not leave login pending forever')
 assert.equal(aborts,1);requests[0].success({statusCode:200,data:renewed()});await settle();assert.equal(r.storage.get('stemistSessionToken'),undefined)
 const second=service.beginWeChatLogin();await settle();assert.equal(codes,2);assert.notEqual(requests[0].data.code,requests[1].data.code)
 requests[1].success({statusCode:200,data:renewed()});assert.equal((await second.promise).status,'authenticated')
})
