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
