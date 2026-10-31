import assert from 'node:assert/strict'
import {miniRuntime,deferred} from './helpers/mini-runtime.mjs'
import {taskFixture} from './helpers/coach-task-fixture.mjs'
let resolveList=null,detailCalls=0
const fixture=taskFixture(),runtime=miniRuntime({modules:{'bundles/coach/taskData':{
 scope:()=>({owner:runtime.storage.get('stemistUser')?.id||'guest',epoch:runtime.storage.get('stemistPrivacyEpoch')||0}),
 current:s=>s.owner===(runtime.storage.get('stemistUser')?.id||'guest')&&s.epoch===(runtime.storage.get('stemistPrivacyEpoch')||0),
 list:async()=>resolveList?resolveList.promise:{items:[fixture],nextCursor:null,serverNow:fixture.serverNow},
 detail:async(s,id)=>{detailCalls++;assert.equal(id,fixture.id);return{snapshot:fixture,view:runtime.load('utils/coachTaskView').taskProgressView(fixture),answer:fixture.result.answer,partial:false,local:false}},
 errorMessage:()=> '暂时无法更新任务状态',
}}})
const page=runtime.page('bundles/coach/tasks');page.onLoad({});await page.onShow();assert.equal(page.data.authenticated,false);assert.equal(detailCalls,0)
runtime.storage.set('stemistUser',{id:'fixture-a'});runtime.storage.set('stemistSessionToken','fixture-only');await page.onShow()
assert.equal(page.data.items.length,1);assert.equal(page.data.items[0].answer,undefined)
await page.open({currentTarget:{dataset:{id:fixture.id}}});assert.equal(detailCalls,1);assert.match(page.data.answer,/x=2/)
assert.equal(page.data.detail.savedTask,true);assert.match(page.data.detail.retentionLabel,/3 天/)
page.onHide();assert.equal(page.__tickTimer,null);assert.equal(page.__pollTimer,null)
runtime.storage.set('stemistUser',{id:'fixture-b'});await page.onShow();assert.equal(page.data.id,'');assert.equal(page.data.answer,'')
resolveList=deferred();const late=page.manualRefresh();page.onHide();resolveList.resolve({items:[],nextCursor:null});await late
assert.equal(page.data.items.length,1,'late hidden callback cannot mutate the visible list')
page.onUnload();assert.equal(page.data.answer,'');assert.equal(page.data.items.length,0)
assert.ok(![...runtime.storage.keys()].some(x=>/task|answer/i.test(x)))
console.log('PASS task page guest, owner isolation, detail rendering, hidden cancellation and no persisted answer.')
