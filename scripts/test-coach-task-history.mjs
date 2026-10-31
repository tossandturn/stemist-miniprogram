import assert from 'node:assert/strict'
import {miniRuntime,deferred} from './helpers/mini-runtime.mjs'
import {taskFixture} from './helpers/coach-task-fixture.mjs'
const fixture=taskFixture(),requests=[]
let response={schemaVersion:'stem-coach-task-list-v1',items:[fixture],nextCursor:null,serverNow:fixture.serverNow}
const runtime=miniRuntime({modules:{'utils/api':{requestJson:async(...args)=>{requests.push(args);return response}}}})
runtime.storage.set('stemistUser',{id:'fixture-a'});runtime.storage.set('stemistSessionToken','fixture-only')
const service=runtime.load('bundles/coach/taskData'),scope=service.scope()
const list=await service.list(scope)
assert.equal(list.items.length,1);assert.equal(list.items[0].answer,undefined);assert.equal(list.items[0].result,undefined)
assert.match(requests[0][0],/jobs\?limit=20/);assert.equal(requests[0][2].method,'GET');assert.equal(requests[0][1],undefined)
response=fixture;const detail=await service.detail(scope,fixture.id);assert.match(detail.answer,/x=2/)
assert.equal(detail.partial,false);assert.equal(detail.snapshot.result,undefined,'snapshot stores only safe progress metadata')
await assert.rejects(service.detail(scope,'../../private'),/任务/)
await assert.rejects(service.list(scope,'!invalid'),/分页/)
response={...fixture,task:{...fixture.task,persistence:{saved:false,retentionMs:600000}}}
await assert.rejects(service.detail(scope,fixture.id),/未保存|任务/)
response={...fixture,expiresAt:fixture.serverNow-1};await assert.rejects(service.detail(scope,fixture.id),/过期/)
response={schemaVersion:'stem-coach-task-list-v1',items:Array(21).fill(fixture),serverNow:fixture.serverNow,nextCursor:null}
await assert.rejects(service.list(scope),/异常/)
const late=deferred();response=late.promise;const pending=service.list(scope);runtime.storage.set('stemistUser',{id:'fixture-b'});late.resolve(list);await assert.rejects(pending,/账号/)
assert.equal(runtime.storage.size,2,'task answers are never written to local storage')
console.log('PASS saved-only authenticated metadata list/detail, expiry, bounded pagination and stale account fence.')
