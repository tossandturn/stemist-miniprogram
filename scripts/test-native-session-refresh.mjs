import assert from 'node:assert/strict'
import {miniRuntime,deferred} from './helpers/mini-runtime.mjs'
const calls=[]
const r=miniRuntime({wx:{request(options){calls.push(options);options.success({statusCode:200,data:{authenticated:true,accessToken:'fresh-token',expiresAt:new Date(Date.now()+300000).toISOString(),id:'ielts:7',username:'student'}})}}})
r.storage.set('stemistUser',{id:'ielts:7'});r.storage.set('stemistSessionToken','old-token')
r.storage.set('stemistSessionMeta',{kind:'password',owner:'ielts:7',expiresAt:new Date(Date.now()-1000).toISOString()})
r.storage.set('stemistNativeSessionCookie','fixture-session-cookie')
const auth=r.load('utils/nativeSession')
await Promise.all([auth.refreshNativeSession(),auth.refreshNativeSession()])
assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/api/auth/status'));assert.equal(calls[0].header.Cookie,'stem_session=fixture-session-cookie')
assert.equal(r.storage.get('stemistSessionToken'),'fresh-token')
await auth.refreshNativeSession();assert.equal(calls.length,1)
const delayed=deferred()
const stale=miniRuntime({wx:{login({success}){success({code:'fixture-wechat-code'})},request(options){delayed.promise.then(()=>options.success({statusCode:200,data:{authenticated:true,accessToken:'must-not-restore',expiresAt:new Date(Date.now()+300000).toISOString(),id:'ielts:7'}}))}}})
stale.storage.set('stemistUser',{id:'ielts:7'});stale.storage.set('stemistSessionToken','expired-token');stale.storage.set('stemistSessionMeta',{kind:'wechat',owner:'ielts:7',expiresAt:new Date(0).toISOString()})
const pending=stale.load('utils/nativeSession').refreshNativeSession()
stale.storage.set('stemistPrivacyEpoch',1);stale.storage.delete('stemistSessionToken');stale.storage.delete('stemistUser');delayed.resolve()
await assert.rejects(()=>pending);assert.equal(stale.storage.get('stemistSessionToken'),undefined)
console.log('Native session refresh: coalesced expiry renewal, scoped app cookie, expiry reuse and logout race passed.')
