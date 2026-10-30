import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'

// A guest/deep link must show an explicit recovery action, never an endless spinner.
{
 let calls=0
 const r=miniRuntime({modules:{'utils/api':{requestJson:async()=>{calls++;throw Error('must not request')}}}})
 const page=r.page('bundles/account/profile');await page.onLoad();page.onShow()
 assert.equal(page.data.loading,false,'guest profile load must settle')
 assert.equal(page.data.authRequired,true)
 assert.equal(calls,0);assert.equal(r.calls.length,0,'do not force navigation or authentication')
 page.openAccount();assert.equal(r.calls.at(-1).url,'/bundles/account/auth')
}
// Expiry while the request is outstanding must clear private data and unblock UI.
{
 const gate=deferred(),r=miniRuntime({modules:{'utils/api':{requestJson:()=>gate.promise}}})
 r.storage.set('stemistUser',{id:'ielts:42'});r.storage.set('stemistSessionToken','synthetic')
 const page=r.page('bundles/account/profile'),loading=page.onLoad();await settle()
 r.storage.delete('stemistSessionToken');r.storage.delete('stemistUser')
 gate.reject(Object.assign(Error('expired'),{statusCode:401}));await loading
 assert.equal(page.data.loading,false);assert.equal(page.data.loaded,false);assert.equal(page.data.authRequired,true)
 assert.equal(page.data.displayName,'');assert.equal(page.data.avatarDataUrl,'')
}
// Non-AI screens must not tell the user to return to AI on authentication errors.
{
 const r=miniRuntime({wx:{request:o=>{o.success({statusCode:401,data:{}});return{abort(){}}}}})
 await assert.rejects(r.load('utils/api').requestJson('/api/stem/announcements/manage',undefined,{method:'GET'}),e=>e.statusCode===401&&!/AI/.test(e.message)&&/登录/.test(e.message))
}
console.log('PASS profile guest/expired-session recovery and context-neutral authentication messages.')
