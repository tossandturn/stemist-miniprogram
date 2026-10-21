import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
let request,logins=0;const timers=new Map();let serial=0
const r=miniRuntime({wx:{login:o=>{logins++;o.success({code:'fixture-code'})},request:o=>{request=o;return{abort(){}}}},globals:{setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)}})
r.storage.set('stemistUser',{id:'owner'});r.storage.set('stemistSessionToken','old')
r.storage.set('stemistSessionMeta',{kind:'wechat',owner:'owner',expiresAt:new Date(Date.now()+80000).toISOString()})
const auth=r.load('utils/nativeSession')
await auth.refreshNativeSession();assert.equal(logins,0,'ordinary callers retain the 45 second threshold')
const warm=auth.refreshNativeSession({aheadMs:90000});await settle()
assert.equal(logins,1,'Coach warmup renews before foreground submission')
const join=auth.refreshNativeSession({aheadMs:90000});await settle();assert.equal(logins,1)
request.success({statusCode:200,data:{authenticated:true,id:'owner',accessToken:'new',expiresAt:new Date(Date.now()+300000).toISOString()}})
assert.deepEqual(await Promise.all([warm,join]),['new','new']);assert.equal(timers.size,0)
r.storage.set('stemistSessionMeta',{kind:'wechat',owner:'owner',expiresAt:new Date(0).toISOString()})
const silent=auth.refreshNativeSession();await settle();const rejection=assert.rejects(silent,/超时/)
for(const[id,t]of[...timers])if(t.ms===25000){timers.delete(id);t.fn()}
await rejection
request.success({statusCode:200,data:{authenticated:true,id:'owner',accessToken:'late',expiresAt:new Date(Date.now()+300000).toISOString()}});await settle()
assert.equal(r.storage.get('stemistSessionToken'),'new','late auth cannot replace token after watchdog')
const again=auth.refreshNativeSession();await settle();assert.equal(logins,3,'deadline clears stuck coalescing promise')
request.success({statusCode:200,data:{authenticated:true,id:'owner',accessToken:'recovered',expiresAt:new Date(Date.now()+300000).toISOString()}});await again
const stop=r.load('utils/coachSession').warmCoachSession();await settle();assert.equal(timers.size,1);stop();assert.equal(timers.size,0,'hiding page cancels scheduled warmup')
r.storage.set('stemistSessionMeta',{kind:'wechat',owner:'owner',expiresAt:new Date(0).toISOString()})
const stopPending=r.load('utils/coachSession').warmCoachSession();await settle();stopPending();request.success({statusCode:200,data:{authenticated:true,id:'owner',accessToken:'after-hide',expiresAt:new Date(Date.now()+300000).toISOString()}});await settle();assert.equal(timers.size,0,'inflight renewal cannot schedule another warmup after hide')
console.log('Coach session prewarm: earlier renewal, coalescing, unchanged defaults, watchdog, no late resurrection PASS')
