import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,deferred} from './helpers/mini-runtime.mjs'

const avatar='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='
const initial={ownerId:'ielts:42',displayName:'微信昵称',avatarDataUrl:avatar,updatedAt:'2026-01-01T00:00:00Z'}
const calls=[]
let gate=null
const r=miniRuntime({modules:{'utils/api':{requestJson:async(path,data,options)=>{
  calls.push({path,data,options})
  if(gate)await gate.promise
  return {protocol:'stem-user-profile-v1',profile:{...initial,...data}}
}}},wx:{showToast(){}}})
r.storage.set('stemistSessionToken','fixture-token')
r.storage.set('stemistUser',{id:'ielts:42',username:'wx_immutable',roles:['student']})
const service=r.load('bundles/account/profileData')
assert.equal(service.normalizeName('  小明🌱  '),'小明🌱')
assert.equal(service.normalizeName('e\u0301'),'é')
assert.throws(()=>service.normalizeName(' '))
assert.throws(()=>service.normalizeName('x'.repeat(33)))
assert.throws(()=>service.normalizeName('a\u0000b'))
assert.throws(()=>service.normalizeName('\u200b\u200d'))
assert.equal(service.normalizeName('家庭👨‍👩‍👧'),'家庭👨‍👩‍👧')
const page=r.page('bundles/account/profile')
await page.onLoad()
assert.equal(page.data.displayName,'微信昵称')
assert.equal(page.data.avatarDataUrl,avatar)
assert.equal(page.data.loaded,true)
assert.equal(calls[0].path,'/api/stem/profile')
assert.equal(calls[0].options.method,'GET')
page.data.displayName='must not use stale bindinput'
await page.submit({detail:{value:{nickname:'  学生昵称  '}}})
assert.equal(calls.at(-1).data.displayName,'学生昵称','submit must read form values after native content checks')
assert.equal(calls.at(-1).data.avatarDataUrl,avatar)
assert.equal(r.storage.get('stemistUser').username,'wx_immutable')
assert.equal(r.storage.get('stemistUser').displayName,'学生昵称')
assert.deepEqual(r.storage.get('stemistUser').roles,['student'])
assert.equal(r.storage.get('stemistSessionToken'),'fixture-token')

// Never fall back to cached input if the native nickname safety check cleared it.
const before=calls.length
await page.submit({detail:{value:{nickname:''}}})
assert.equal(calls.length,before)
assert.ok(page.data.error)

// A late response must not overwrite a new account or restore a logged-out one.
gate=deferred()
const save=page.submit({detail:{value:{nickname:'旧账号昵称'}}})
await Promise.resolve()
r.storage.set('stemistUser',{id:'ielts:99',username:'other'})
r.storage.set('stemistPrivacyEpoch',1)
gate.resolve();await save
assert.equal(r.storage.get('stemistUser').displayName,undefined)
assert.equal(r.storage.get('stemistUser').id,'ielts:99')
page.onShow()
assert.equal(page.data.displayName,'')
assert.equal(page.data.avatarDataUrl,'')
assert.equal(page.data.loaded,false)

let failSave=true
const retry=miniRuntime({modules:{'utils/api':{requestJson:async(path,data)=>{
 if(data&&failSave)throw new Error('网络超时，填写内容保留。')
 return {protocol:'stem-user-profile-v1',profile:{...initial,...data}}
}}},wx:{showToast(){}}})
retry.storage.set('stemistSessionToken','fixture');retry.storage.set('stemistUser',{id:'ielts:42'})
const retryPage=retry.page('bundles/account/profile');await retryPage.onLoad()
await retryPage.submit({detail:{value:{nickname:'重试时应保留'}}})
assert.equal(retryPage.data.displayName,'重试时应保留')
assert.equal(retryPage.data.avatarDataUrl,avatar)
assert.equal(retryPage.data.saving,false)
failSave=false;await retryPage.submit({detail:{value:{nickname:retryPage.data.displayName}}})
assert.equal(retryPage.data.saved,true)

const loginReply=deferred()
const leaving=miniRuntime({modules:{'utils/wechatAuth':{ensureWeChatSession:()=>loginReply.promise}},wx:{showToast(){}}})
const accountPage=leaving.page('bundles/account/auth');accountPage.onShow()
const login=accountPage.loginWechat();accountPage.onHide();accountPage.goBack()
loginReply.resolve({user:{id:'ielts:42'}});await login
assert.equal(leaving.calls.some(call=>call.url==='/bundles/account/profile'),false,'leaving during login must not navigate back to profile')
const redirect=leaving.page('pages/account/auth');redirect.onLoad()
assert.equal(leaving.calls.at(-1).url,'/bundles/account/auth','old shared account links stay valid')

// A first WeChat login with no user-confirmed avatar or nickname opens the
// native onboarding route. It is owner-scoped so another account cannot
// inherit a previous user's skipped prompt.
let firstWechatRuntime
firstWechatRuntime=miniRuntime({modules:{'utils/wechatAuth':{ensureWeChatSession:async()=>{
 firstWechatRuntime.storage.set('stemistSessionToken','wechat-session')
 firstWechatRuntime.storage.set('stemistUser',{id:'ielts:700',username:'wechat_700',displayName:'',avatarDataUrl:''})
 return {user:firstWechatRuntime.storage.get('stemistUser')}
}}},wx:{showToast(){}}})
const firstWechatPage=firstWechatRuntime.page('bundles/account/auth');firstWechatPage.onShow()
await firstWechatPage.loginWechat()
assert.equal(firstWechatRuntime.calls.at(-1).url,'/bundles/account/profile?onboarding=1','first incomplete WeChat profile must use the clear native onboarding route')
assert.equal(firstWechatRuntime.storage.get('stemistProfileOnboarding:ielts%3A700'),'shown','dismissal marker must be scoped to the authenticated owner')

let secondWechatRuntime
secondWechatRuntime=miniRuntime({modules:{'utils/wechatAuth':{ensureWeChatSession:async()=>{
 secondWechatRuntime.storage.set('stemistSessionToken','wechat-session')
 secondWechatRuntime.storage.set('stemistUser',{id:'ielts:701',username:'wechat_701',displayName:'',avatarDataUrl:''})
 return {user:secondWechatRuntime.storage.get('stemistUser')}
}}},wx:{showToast(){}}})
secondWechatRuntime.storage.set('stemistProfileOnboarding:ielts%3A700','shown')
const secondWechatPage=secondWechatRuntime.page('bundles/account/auth');secondWechatPage.onShow()
await secondWechatPage.loginWechat()
assert.equal(secondWechatRuntime.calls.at(-1).url,'/bundles/account/profile?onboarding=1','a different account must still receive its own onboarding prompt')

const silentWechat=miniRuntime({wx:{showToast(){}}})
silentWechat.storage.set('stemistSessionToken','silent-wechat-token')
silentWechat.storage.set('stemistUser',{id:'ielts:702',username:'wechat_702',displayName:'',avatarDataUrl:''})
silentWechat.storage.set('stemistSessionMeta',{kind:'wechat',owner:'ielts:702',expiresAt:new Date(Date.now()+300000).toISOString()})
const silentWechatPage=silentWechat.page('bundles/account/auth');silentWechatPage.onShow()
assert.equal(silentWechat.calls.at(-1).url,'/bundles/account/profile?onboarding=1','a silently restored WeChat account must receive the same profile onboarding when opening Account')

const passwordProfile=miniRuntime({wx:{showToast(){}}})
passwordProfile.storage.set('stemistSessionToken','password-token')
passwordProfile.storage.set('stemistUser',{id:'ielts:703',username:'password_703',displayName:'',avatarDataUrl:''})
passwordProfile.storage.set('stemistSessionMeta',{kind:'password',owner:'ielts:703',expiresAt:new Date(Date.now()+300000).toISOString()})
const passwordProfilePage=passwordProfile.page('bundles/account/auth');passwordProfilePage.onShow()
assert.equal(passwordProfile.calls.length,0,'password accounts must not be redirected into the WeChat-specific profile onboarding')

const onboarding=miniRuntime({modules:{'utils/api':{requestJson:async()=>({protocol:'stem-user-profile-v1',profile:initial})}},wx:{showToast(){}}})
onboarding.storage.set('stemistSessionToken','fixture');onboarding.storage.set('stemistUser',{id:'ielts:42'})
const onboardingPage=onboarding.page('bundles/account/profile');await onboardingPage.onLoad({onboarding:'1'})
assert.equal(onboardingPage.data.onboarding,true,'onboarding route must render a distinct profile-completion state')

for(const mode of ['wechat','password']){
 const late=deferred()
 const race=miniRuntime({modules:{'utils/api':{requestJson:()=>late.promise}},wx:{login:({success})=>success({code:'fixture-code'})}})
 const task=mode==='wechat'?race.load('utils/wechatAuth').ensureWeChatSession({silent:false}):race.load('utils/auth').signIn('student','fixture-pass')
 await Promise.resolve();await Promise.resolve()
 race.storage.set('stemistPrivacyEpoch',1)
 race.storage.set('stemistUser',{id:'ielts:99',displayName:'新账号'})
 race.storage.set('stemistSessionToken','new-token')
 late.resolve({accessToken:'old-token',identity:{id:'ielts:42',displayName:'旧账号'}})
 await assert.rejects(()=>task)
 assert.equal(race.storage.get('stemistUser').displayName,'新账号')
 assert.equal(race.storage.get('stemistSessionToken'),'new-token')
}

// requestJson captures Set-Cookie before signIn's authGuard sees the response;
// a stale password response must not replace the newer account's cookie.
let passwordRequest
const cookieRace=miniRuntime({wx:{request(options){passwordRequest=options}}})
const oldLogin=cookieRace.load('utils/auth').signIn('old_user','password','login').then(()=>null,error=>error)
await Promise.resolve()
cookieRace.storage.set('stemistUser',{id:'ielts:202',username:'new_user'})
cookieRace.storage.set('stemistSessionToken','new-token')
cookieRace.storage.set('stemistPrivacyEpoch',1)
cookieRace.storage.set('stemistNativeSessionCookie','B'.repeat(32))
passwordRequest.success({statusCode:200,data:{accessToken:'old-token',identity:{id:'ielts:101',username:'old_user',roles:['student']}},header:{'Set-Cookie':'stem_session='+'A'.repeat(32)+'; Path=/; HttpOnly'}})
assert.match((await oldLogin).message,/账号已变化/)
assert.equal(cookieRace.storage.get('stemistNativeSessionCookie'),'B'.repeat(32),'late old-account login must not replace the current native cookie')
assert.equal(cookieRace.storage.get('stemistSessionToken'),'new-token')
assert.equal(cookieRace.storage.get('stemistUser').id,'ielts:202')

const overlappingRequests=[]
const overlapping=miniRuntime({wx:{request(options){overlappingRequests.push(options)}}})
const firstLogin=overlapping.load('utils/auth').signIn('old_user','password','login').then(()=>null,error=>error)
await Promise.resolve()
overlapping.storage.set('stemistUser',{id:'ielts:202',username:'new_user'});overlapping.storage.set('stemistSessionToken','new-token');overlapping.storage.set('stemistPrivacyEpoch',1);overlapping.storage.set('stemistNativeSessionCookie','B'.repeat(32))
const currentLogin=overlapping.load('utils/auth').signIn('new_user','password','login').then(()=>null,error=>error)
await Promise.resolve()
overlappingRequests[0].success({statusCode:200,data:{accessToken:'old-token',identity:{id:'ielts:101'}},header:{'Set-Cookie':'stem_session='+'A'.repeat(32)+'; Path=/'}})
overlappingRequests[1].fail({errMsg:'request:fail offline'})
await firstLogin;await currentLogin
assert.equal(overlapping.storage.get('stemistNativeSessionCookie'),'B'.repeat(32),'an older auth response cannot capture through a newer auth attempt')

const cookieHappy=miniRuntime({wx:{request(options){options.success({statusCode:200,data:{accessToken:'fresh-token',identity:{id:'ielts:303',username:'fresh_user',roles:['student']}},header:{'Set-Cookie':'stem_session='+'C'.repeat(32)+'; Path=/; HttpOnly'}})}}})
await cookieHappy.load('utils/auth').signIn('fresh_user','password','login')
assert.equal(cookieHappy.storage.get('stemistNativeSessionCookie'),'C'.repeat(32),'current login still captures its native session cookie')
assert.equal(cookieHappy.storage.get('stemistUser').id,'ielts:303')

for(const invalidPayload of [
 {accessToken:'invalid-owner-token',identity:{username:'missing_id'}},
 {accessToken:'conflicting-owner-token',id:'ielts:707',identity:{id:'ielts:808'}},
 {accessToken:'first-token',token:'different-token',identity:{id:'ielts:707'}},
]){
 const invalid=miniRuntime({wx:{request(options){options.success({statusCode:200,data:invalidPayload,header:{'Set-Cookie':'stem_session='+'X'.repeat(32)+'; Path=/'}})}}})
 invalid.storage.set('stemistUser',{id:'ielts:404'});invalid.storage.set('stemistSessionToken','owner-a-token');invalid.storage.set('stemistNativeSessionCookie','W'.repeat(32));invalid.storage.set('stemistDraft:coach',{text:'owner A private'})
 await assert.rejects(()=>invalid.load('utils/auth').signIn('owner_b','password','login'),/登录响应/)
 assert.equal(invalid.storage.get('stemistUser').id,'ielts:404');assert.equal(invalid.storage.get('stemistSessionToken'),'owner-a-token')
 assert.equal(invalid.storage.get('stemistNativeSessionCookie'),'W'.repeat(32),'invalid auth envelopes cannot replace the current cookie')
 assert.equal(invalid.storage.get('stemistDraft:coach').text,'owner A private')
}

// A 401 preserves drafts for same-owner recovery, but a different account
// must not inherit those private drafts after authenticating.
const switchRuntime=miniRuntime({wx:{request(options){options.success({statusCode:200,data:{accessToken:'owner-b-token',expiresAt:new Date(Date.now()+300000).toISOString(),identity:{id:'ielts:505',username:'owner_b',roles:['student']}},header:{'Set-Cookie':'stem_session='+'D'.repeat(32)+'; Path=/; HttpOnly'}})}}})
switchRuntime.storage.set('stemistUser',{id:'ielts:404',username:'owner_a'})
switchRuntime.storage.set('stemistSessionToken','expired-a')
switchRuntime.storage.set('stemistSessionMeta',{kind:'password',owner:'ielts:404',expiresAt:new Date(0).toISOString()})
switchRuntime.storage.set('stemistDraft:coach',{text:'A private draft'})
switchRuntime.load('utils/session').clearLocalSession({preserveDrafts:true})
assert.equal(switchRuntime.storage.get('stemistDraft:coach').text,'A private draft','same owner must be able to recover after a 401')
const epochBeforeSwitch=Number(switchRuntime.storage.get('stemistPrivacyEpoch'))||0
await switchRuntime.load('utils/auth').signIn('owner_b','password','login')
assert.equal(switchRuntime.storage.get('stemistUser').id,'ielts:505')
assert.equal(switchRuntime.storage.get('stemistDraft:coach'),undefined,'a different owner must not inherit preserved private drafts')
assert.ok((Number(switchRuntime.storage.get('stemistPrivacyEpoch'))||0)>epochBeforeSwitch)
assert.equal(switchRuntime.storage.get('stemistNativeSessionCookie'),'D'.repeat(32),'the new password account keeps its own fresh native cookie')

const missingMeta=miniRuntime({wx:{request(options){options.success({statusCode:200,data:{accessToken:'owner-b-token',expiresAt:new Date(Date.now()+300000).toISOString(),identity:{id:'ielts:505',username:'owner_b',roles:['student']}},header:{'Set-Cookie':'stem_session='+'G'.repeat(32)+'; Path=/'}})}}})
missingMeta.storage.set('stemistUser',{id:'ielts:404'});missingMeta.storage.set('stemistSessionToken','expired-a');missingMeta.storage.set('stemistDraft:coach',{text:'legacy owner A private'})
missingMeta.load('utils/session').clearLocalSession({preserveDrafts:true})
assert.equal(missingMeta.storage.get('stemistSessionMeta').owner,'ielts:404','401 preservation retains a missing legacy owner boundary')
await missingMeta.load('utils/auth').signIn('owner_b','password','login')
assert.equal(missingMeta.storage.get('stemistUser').id,'ielts:505');assert.equal(missingMeta.storage.get('stemistDraft:coach'),undefined,'a legacy owner draft cannot cross into another account')

const sameOwner=miniRuntime({wx:{request(options){options.success({statusCode:200,data:{accessToken:'owner-a-fresh',expiresAt:new Date(Date.now()+300000).toISOString(),identity:{id:'ielts:404',username:'owner_a',roles:['student']}},header:{'Set-Cookie':'stem_session='+'E'.repeat(32)+'; Path=/'}})}}})
sameOwner.storage.set('stemistUser',{id:'ielts:404'});sameOwner.storage.set('stemistSessionToken','expired-a');sameOwner.storage.set('stemistSessionMeta',{kind:'password',owner:'ielts:404',expiresAt:new Date(0).toISOString()});sameOwner.storage.set('stemistDraft:coach',{text:'recover me'})
sameOwner.load('utils/session').clearLocalSession({preserveDrafts:true})
await sameOwner.load('utils/auth').signIn('owner_a','password','login')
assert.equal(sameOwner.storage.get('stemistDraft:coach').text,'recover me','same-owner recovery keeps the preserved draft')

const failedSwitch=miniRuntime({wx:{request(options){options.fail({errMsg:'request:fail offline'})}}})
failedSwitch.storage.set('stemistSessionMeta',{kind:'password',owner:'ielts:404',expiresAt:new Date(0).toISOString()});failedSwitch.storage.set('stemistDraft:coach',{text:'keep on failed login'})
await assert.rejects(()=>failedSwitch.load('utils/auth').signIn('owner_b','password','login'))
assert.equal(failedSwitch.storage.get('stemistDraft:coach').text,'keep on failed login','failed authentication cannot clear old private data')

const guestAdoption=miniRuntime({wx:{request(options){options.success({statusCode:200,data:{accessToken:'first-token',identity:{id:'ielts:606',username:'first',roles:['student']}}})}}})
guestAdoption.storage.set('stemistDraft:coach',{text:'guest draft'})
await guestAdoption.load('utils/auth').signIn('first','password','login')
assert.equal(guestAdoption.storage.get('stemistDraft:coach').text,'guest draft','first login adopts rather than deletes a guest draft')

const wechatSwitch=miniRuntime({wx:{login({success}){success({code:'new-owner-code'})},request(options){options.success({statusCode:200,data:{accessToken:'wechat-b-token',expiresAt:new Date(Date.now()+300000).toISOString(),identity:{id:'ielts:505',username:'wechat_b',roles:['student']}}})}}})
wechatSwitch.storage.set('stemistUser',{id:'ielts:404'});wechatSwitch.storage.set('stemistSessionToken','expired-a');wechatSwitch.storage.set('stemistSessionMeta',{kind:'wechat',owner:'ielts:404',expiresAt:new Date(0).toISOString()});wechatSwitch.storage.set('stemistNativeSessionCookie','F'.repeat(32));wechatSwitch.storage.set('stemistDraft:coach',{text:'A private draft'})
wechatSwitch.load('utils/session').clearLocalSession({preserveDrafts:true})
await wechatSwitch.load('utils/wechatAuth').ensureWeChatSession({silent:false})
assert.equal(wechatSwitch.storage.get('stemistUser').id,'ielts:505')
assert.equal(wechatSwitch.storage.get('stemistDraft:coach'),undefined)
assert.equal(wechatSwitch.storage.get('stemistNativeSessionCookie'),undefined,'WeChat account switch must not carry the old password cookie')

const invalidWeChat=miniRuntime({wx:{login({success}){success({code:'invalid-owner-code'})},request(options){options.success({statusCode:200,data:{accessToken:'bad-wechat-token',identity:{id:'wechat:9'}}})}}})
await assert.rejects(()=>invalidWeChat.load('utils/wechatAuth').ensureWeChatSession({silent:false}),/登录响应/)
assert.equal(invalidWeChat.storage.get('stemistSessionToken'),undefined);assert.equal(invalidWeChat.storage.get('stemistUser'),undefined)

const unloaded=deferred()
const u=miniRuntime({modules:{'utils/api':{requestJson:()=>unloaded.promise}}})
u.storage.set('stemistUser',{id:'ielts:42'});u.storage.set('stemistSessionToken','fixture-token')
const gone=u.page('bundles/account/profile')
const load=gone.onLoad();gone.onUnload()
unloaded.resolve({protocol:'stem-user-profile-v1',profile:initial});await load
assert.equal(gone.data.loaded,false)

// Reading an avatar copies bytes; never persist the native temporary file URL.
const fileCalls=[]
const a=miniRuntime({wx:{getFileSystemManager:()=>({
 stat({success}){success({stats:{size:100}})},
 readFile(options){fileCalls.push(options);options.success({data:avatar.split(',')[1]})},
})}})
assert.equal(await a.load('bundles/account/profileData').readAvatar('wxfile://tmp-avatar'),avatar)
assert.equal(fileCalls[0].encoding,'base64')
const big=miniRuntime({wx:{getFileSystemManager:()=>({stat({success}){success({stats:{size:3*1024*1024}})}})}})
await assert.rejects(()=>big.load('bundles/account/profileData').readAvatar('wxfile://huge-avatar'))

const root=new URL('../',import.meta.url)
const markup=fs.readFileSync(new URL('bundles/account/profile.wxml',root),'utf8')
assert.match(markup,/open-type="chooseAvatar"/)
assert.match(markup,/type="nickname"/)
assert.match(markup,/<form[^>]+bindsubmit="submit"/)
assert.match(markup,/form-type="submit"/)
assert.doesNotMatch(markup,/getUserProfile|getUserInfo/)
assert.match(markup,/暂不设置/)
const account=fs.readFileSync(new URL('bundles/account/auth.wxml',root),'utf8')
assert.match(account,/user\.displayName/)
assert.match(account,/user\.avatarDataUrl/)
console.log('Account profile: native controls, submitted nickname, persistent avatar, owner isolation and lifecycle passed.')
