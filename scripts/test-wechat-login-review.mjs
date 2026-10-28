import assert from 'node:assert/strict'
import fs from 'node:fs'
import {deferred,miniRuntime,settle} from './helpers/mini-runtime.mjs'

const identity=(id='ielts:42')=>({accessToken:'wechat-token-'+id.split(':')[1],expiresAt:new Date(Date.now()+300000).toISOString(),identity:{id,username:'wechat_user',displayName:'',avatarDataUrl:'',roles:['student']}})
const authModules=requestJson=>({
 'utils/api':{requestJson},
 'utils/nativeSession':{rememberNativeSession(){},refreshNativeSession:async()=>{}},
 'utils/session':{adoptOwner(){}},
})

// A background/silent check may refresh an existing session, but a guest must
// stay a guest without creating a new wx.login code or server identity.
let silentLogins=0,silentRequests=0
const silent=miniRuntime({wx:{login(options){silentLogins++;options.success({code:'must-not-run'})}},modules:authModules(async()=>{silentRequests++;return identity()})})
const silentResult=await silent.load('utils/wechatAuth').ensureWeChatSession({silent:true})
assert.equal(silentResult.status,'guest')
assert.equal(silentLogins,0)
assert.equal(silentRequests,0)
assert.equal(silent.storage.has('stemistSessionToken'),false)

// Explicit login exposes one shared cancellable handle. Cancelling an older
// flight frees a retry immediately; the older finally/callback cannot clear or
// write over the newer flight.
const loginCallbacks=[],requests=[],aborts=[]
const retryRuntime=miniRuntime({wx:{login(options){loginCallbacks.push(options)}},modules:authModules((path,body,options)=>{
 const gate=deferred(),task={abort(){aborts.push(body.code)}}
 requests.push({path,body,options,gate,task});options.onTask?.(task);return gate.promise
})})
const retryService=retryRuntime.load('utils/wechatAuth')
retryRuntime.storage.set('stemistPrivacyEpoch',7)
retryRuntime.storage.set('stemistDraft:writing',{text:'unrelated private draft'})
const first=retryService.beginWeChatLogin(),shared=retryService.beginWeChatLogin()
assert.equal(shared,first,'Concurrent explicit login callers share one handle')
const firstOutcome=first.promise.catch(error=>error)
assert.equal(first.cancel(),true)
assert.equal(first.cancel(),false,'Cancellation is idempotent')
assert.equal(retryRuntime.storage.get('stemistPrivacyEpoch'),7,'Navigation cancellation never changes the privacy epoch')
assert.equal(retryRuntime.storage.get('stemistDraft:writing').text,'unrelated private draft','Navigation cancellation never clears unrelated drafts')
const second=retryService.beginWeChatLogin()
assert.notEqual(second,first,'A cancelled flight is immediately retryable')
loginCallbacks[0].success({code:'stale-code'})
loginCallbacks[1].success({code:'fresh-code'})
await settle();await settle()
assert.equal((await firstOutcome).code,'wechat_login_cancelled')
assert.equal(loginCallbacks[0].timeout,10000,'wx.login uses a bounded timeout')
assert.equal(requests.length,1,'A late code from the cancelled flight never reaches the server')
assert.equal(requests[0].body.code,'fresh-code')
assert.equal(retryService.beginWeChatLogin(),second,'An older finally cannot clear the newer active retry')
requests[0].gate.resolve(identity('ielts:77'))
const secondResult=await second.promise
assert.equal(secondResult.status,'authenticated')
assert.equal(retryRuntime.storage.get('stemistUser').id,'ielts:77')

// Cancelling after the HTTP request has started aborts where possible and a
// late synthetic success cannot store a token, user, cookie metadata or toast.
const networkGate=deferred();let networkAbort=0,networkOptions
const network=miniRuntime({wx:{login(options){options.success({code:'cancel-after-dispatch'})}},modules:authModules((path,body,options)=>{
 networkOptions=options;options.onTask?.({abort(){networkAbort++}});return networkGate.promise
})})
const networkHandle=network.load('utils/wechatAuth').beginWeChatLogin(),networkOutcome=networkHandle.promise.catch(error=>error)
await settle();await settle()
assert.equal(typeof networkOptions.isCancelled,'function')
assert.equal(networkHandle.cancel(),true)
assert.equal(networkAbort,1)
networkGate.resolve(identity('ielts:88'))
assert.equal((await networkOutcome).code,'wechat_login_cancelled')
await settle()
assert.equal(network.storage.has('stemistSessionToken'),false)
assert.equal(network.storage.has('stemistUser'),false)

// The account/epoch/token guard is captured when the user taps login, not
// after wx.login returns. A different account established while the code is
// pending makes that old code stale and prevents even a server dispatch.
let switchedLogin,switchedRequests=0
const switched=miniRuntime({wx:{login(options){switchedLogin=options}},modules:authModules(async()=>{switchedRequests++;return identity('ielts:123')})})
const switchedHandle=switched.load('utils/wechatAuth').beginWeChatLogin(),switchedOutcome=switchedHandle.promise.catch(error=>error)
switched.storage.set('stemistUser',{id:'ielts:999',username:'new_owner'})
switched.storage.set('stemistSessionToken','new-owner-token')
switchedLogin.success({code:'stale-before-switch'})
const switchedError=await switchedOutcome
assert.match(String(switchedError?.message||''),/账号已变化|重试登录/)
assert.equal(switchedRequests,0,'A pre-code account switch blocks the stale WeChat exchange before dispatch')
assert.equal(switched.storage.get('stemistUser').id,'ielts:999')
assert.equal(switched.storage.get('stemistSessionToken'),'new-owner-token')

// Account page: login never forces profile onboarding; cancel/back is visible,
// cancels the active exchange, and root/failing back navigation reaches Home.
const accountMarkup=fs.readFileSync(new URL('../bundles/account/auth.wxml',import.meta.url),'utf8')
const accountSource=fs.readFileSync(new URL('../bundles/account/auth.js',import.meta.url),'utf8')
assert.match(accountMarkup,/暂不登录，返回浏览/)
assert.match(accountMarkup,/同步学习记录|会员/)
assert.match(accountMarkup,/使用 IELTSist 账号/)
assert.doesNotMatch(accountMarkup,/创建账号|注册/,'Native account page no longer promotes new username registration')
assert.doesNotMatch(accountSource,/openWeChatProfileOnboarding|shouldShowOnboarding|markOnboardingShown/)

const loginGate=deferred();let cancelCalls=0,toasts=0
const rootAccount=miniRuntime({modules:{'utils/wechatAuth':{beginWeChatLogin:()=>({promise:loginGate.promise,cancel(){cancelCalls++;return true}})}},wx:{showToast(){toasts++}}})
const rootPage=rootAccount.page('bundles/account/auth');rootPage.onShow();const pageLogin=rootPage.loginWechat();await settle();rootPage.goBack()
assert.equal(cancelCalls,1)
assert.equal(rootAccount.calls.at(-1).url,'/pages/index/index','Root account cancel returns to safe Home')
loginGate.resolve({status:'authenticated',user:{id:'ielts:42',username:'wechat_user'}});await pageLogin
assert.equal(toasts,0,'Cancelled login never shows a late success toast')
assert.equal(rootAccount.calls.some(call=>String(call.url||'').includes('/bundles/account/profile')),false)

let nestedBack
const nested=miniRuntime({globals:{getCurrentPages:()=>[{},{}]},modules:{'utils/wechatAuth':{beginWeChatLogin(){throw Error('unused')}}},wx:{navigateBack(options){nestedBack=options;options.fail?.({errMsg:'navigateBack:fail'})}}})
const nestedPage=nested.page('bundles/account/auth');nestedPage.onShow();nestedPage.goBack()
assert.ok(nestedBack)
assert.equal(nested.calls.at(-1).url,'/pages/index/index','Failed nested back also falls back to Home')

let success
success=miniRuntime({modules:{'utils/wechatAuth':{beginWeChatLogin:()=>({promise:Promise.resolve().then(()=>{const user={id:'ielts:99',username:'wechat_user',displayName:'',avatarDataUrl:''};success.storage.set('stemistSessionToken','stored-token');success.storage.set('stemistUser',user);return{status:'authenticated',user}}),cancel(){return false}})}},wx:{showToast(){}}})
const successPage=success.page('bundles/account/auth');successPage.onShow();await successPage.loginWechat();successPage.onShow()
assert.equal(success.calls.some(call=>String(call.url||'').includes('/bundles/account/profile')),false,'Login and later onShow never auto-open optional profile')
assert.equal(successPage.data.user.id,'ielts:99')

// Other product entry buttons centralize explicit login on the cancellable
// account page; they never start an unmanaged wx.login exchange themselves.
let directExplicitCalls=0
const routeRuntime=miniRuntime({modules:{
 'utils/wechatAuth':{ensureWeChatSession:async()=>{directExplicitCalls++;return{status:'authenticated'}}},
 'utils/nativeRecords':{recentRecords:()=>[]},
 'utils/nativeLearning':{learningState:async()=>({records:[]}),learningReport:async()=>({})},
 'utils/ieltsLearning':{requestIeltsLearning:async()=>({})},
}})
const ieltsHome=routeRuntime.page('pages/ielts/home');await ieltsHome.signIn()
assert.equal(routeRuntime.calls.at(-1).url,'/bundles/account/auth')
const mainHome=routeRuntime.page('pages/index/index');await mainHome.loginWechat()
assert.equal(routeRuntime.calls.at(-1).url,'/bundles/account/auth')
assert.equal(directExplicitCalls,0,'Home login buttons never dispatch direct explicit WeChat exchange')

const labelRuntime=miniRuntime({modules:{'utils/wechatAuth':{beginWeChatLogin(){throw Error('unused')}}}})
labelRuntime.storage.set('stemistSessionToken','wechat-session')
labelRuntime.storage.set('stemistUser',{id:'ielts:123',username:'wechat_opaque_hash',displayName:'',avatarDataUrl:''})
labelRuntime.storage.set('stemistSessionMeta',{kind:'wechat',owner:'ielts:123',expiresAt:new Date(Date.now()+300000).toISOString()})
const labelPage=labelRuntime.page('bundles/account/auth');labelPage.onShow()
assert.equal(labelPage.data.userLabel,'微信用户','Optional missing nickname never exposes an opaque backend WeChat username')
assert.equal(labelRuntime.storage.get('stemistUser').username,'wechat_opaque_hash','UI label never rewrites stable backend identity')

// The retained IELTSist password recovery path obeys the same Back contract:
// abort immediately, ignore a late 200/Set-Cookie, and let a newer retry own
// its loading state and identity without clearing drafts or privacy scope.
const passwordRequests=[];let passwordAborts=0,passwordToasts=0
const passwordRuntime=miniRuntime({modules:{'utils/wechatAuth':{beginWeChatLogin(){throw Error('unused')}}},wx:{
 request(options){const entry={options};passwordRequests.push(entry);return{abort(){passwordAborts++}}},
 showToast(){passwordToasts++},
}})
passwordRuntime.storage.set('stemistPrivacyEpoch',5)
passwordRuntime.storage.set('stemistDraft:writing',{text:'keep password draft'})
const passwordPage=passwordRuntime.page('bundles/account/auth');passwordPage.onShow();passwordPage.setData({username:'existing_user',password:'fixture-pass'})
const oldPassword=passwordPage.submit();await settle();passwordPage.goBack();await settle()
assert.equal(passwordAborts,1,'Back aborts the active password request task')
passwordRequests[0].options.success({statusCode:200,data:identity('ielts:301'),header:{'Set-Cookie':'stem_session='+'A'.repeat(32)+'; Path=/; HttpOnly'}})
await oldPassword
assert.equal(passwordRuntime.storage.has('stemistSessionToken'),false)
assert.equal(passwordRuntime.storage.has('stemistUser'),false)
assert.equal(passwordRuntime.storage.has('stemistNativeSessionCookie'),false,'Cancelled password response cannot capture a native cookie')
assert.equal(passwordToasts,0)
assert.equal(passwordRuntime.storage.get('stemistPrivacyEpoch'),5)
assert.equal(passwordRuntime.storage.get('stemistDraft:writing').text,'keep password draft')

passwordPage.onShow();passwordPage.setData({username:'existing_user',password:'fixture-pass'})
const newPassword=passwordPage.submit();await settle();assert.equal(passwordRequests.length,2);assert.equal(passwordPage.data.loading,true)
passwordRequests[1].options.success({statusCode:200,data:identity('ielts:302'),header:{'Set-Cookie':'stem_session='+'B'.repeat(32)+'; Path=/; HttpOnly'}})
await newPassword
assert.equal(passwordRuntime.storage.get('stemistUser').id,'ielts:302')
assert.equal(passwordRuntime.storage.get('stemistSessionToken'),'wechat-token-302')
assert.equal(passwordRuntime.storage.get('stemistNativeSessionCookie'),'B'.repeat(32))
assert.equal(passwordToasts,1)

let switchedPasswordRequest
const passwordSwitch=miniRuntime({modules:{'utils/wechatAuth':{beginWeChatLogin(){throw Error('unused')}}},wx:{request(options){switchedPasswordRequest=options;return{abort(){}}},showToast(){}}})
const switchedPasswordPage=passwordSwitch.page('bundles/account/auth');switchedPasswordPage.onShow();switchedPasswordPage.setData({username:'existing_user',password:'fixture-pass'})
const stalePassword=switchedPasswordPage.submit();await settle()
passwordSwitch.storage.set('stemistPrivacyEpoch',6);passwordSwitch.storage.set('stemistUser',{id:'ielts:999'});passwordSwitch.storage.set('stemistSessionToken','newer-token');passwordSwitch.storage.set('stemistNativeSessionCookie','C'.repeat(32))
switchedPasswordRequest.success({statusCode:200,data:identity('ielts:303'),header:{'Set-Cookie':'stem_session='+'D'.repeat(32)+'; Path=/; HttpOnly'}})
await stalePassword
assert.equal(passwordSwitch.storage.get('stemistUser').id,'ielts:999')
assert.equal(passwordSwitch.storage.get('stemistSessionToken'),'newer-token')
assert.equal(passwordSwitch.storage.get('stemistNativeSessionCookie'),'C'.repeat(32),'An account switch fences stale password cookie capture')

// Profile exit is always enabled. Leaving immediately invalidates late load,
// save and avatar results even if the network/file operation itself completes.
const profileMarkup=fs.readFileSync(new URL('../bundles/account/profile.wxml',import.meta.url),'utf8')
assert.match(profileMarkup,/暂不设置/)
assert.doesNotMatch(profileMarkup,/profile-skip[^>]*disabled=/,'Profile skip/back stays available during pending work')

const profileRecord={ownerId:'ielts:42',displayName:'旧昵称',avatarDataUrl:'',updatedAt:'2026-10-28T00:00:00Z'}
const loadGate=deferred();let loadCache=0
const loadingProfile=miniRuntime({modules:{'bundles/account/profileData':{
 context:()=>({ownerId:'ielts:42',epoch:0}),isCurrent:()=>true,normalizeName:value=>String(value).trim(),profileRequest:()=>loadGate.promise,cacheProfile:()=>{loadCache++;return true},readAvatar:async()=>'',
}}})
const loadingPage=loadingProfile.page('bundles/account/profile'),loading=loadingPage.onLoad();loadingPage.goBack();loadGate.resolve(profileRecord);await loading
assert.equal(loadCache,0)
assert.equal(loadingPage.data.loaded,false)
assert.equal(loadingProfile.calls.at(-1).url,'/pages/index/index')

const saveGate=deferred();let profileCalls=0,saveCache=0,profileToasts=0
const savingProfile=miniRuntime({modules:{'bundles/account/profileData':{
 context:()=>({ownerId:'ielts:42',epoch:0}),isCurrent:()=>true,normalizeName:value=>String(value).trim(),profileRequest:async(started,data)=>{profileCalls++;return data?saveGate.promise:profileRecord},cacheProfile:()=>{saveCache++;return true},readAvatar:async()=>'',
}},wx:{showToast(){profileToasts++}}})
const savingPage=savingProfile.page('bundles/account/profile');await savingPage.onLoad();const saving=savingPage.submit({detail:{value:{nickname:'新昵称'}}});await settle();savingPage.goBack();saveGate.resolve({...profileRecord,displayName:'新昵称'});await saving
assert.equal(profileCalls,2)
assert.equal(saveCache,1,'Only the initial profile load may update cache after leaving during save')
assert.equal(profileToasts,0)
assert.equal(savingProfile.calls.at(-1).url,'/pages/index/index')

const avatarGate=deferred();let avatarCache=0
const avatarProfile=miniRuntime({modules:{'bundles/account/profileData':{
 context:()=>({ownerId:'ielts:42',epoch:0}),isCurrent:()=>true,normalizeName:value=>String(value).trim(),profileRequest:async()=>profileRecord,cacheProfile:()=>{avatarCache++;return true},readAvatar:()=>avatarGate.promise,
}}})
const avatarPage=avatarProfile.page('bundles/account/profile');await avatarPage.onLoad();const choosing=avatarPage.chooseAvatar({detail:{avatarUrl:'wxfile://late-avatar'}});await settle();avatarPage.goBack();avatarGate.resolve('data:image/png;base64,LATE');await choosing
assert.equal(avatarPage.data.avatarDataUrl,'','Late avatar processing cannot update a page after exit')

console.log('WeChat review login: explicit cancellation, guest browsing, safe back, optional profile and lifecycle fences PASS')
