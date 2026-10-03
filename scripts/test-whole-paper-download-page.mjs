import assert from 'node:assert/strict'
import test from 'node:test'
import { miniRuntime, settle } from './helpers/mini-runtime.mjs'

function fixture(){
 const scope={owner:'synthetic-download-owner',epoch:0},calls=[]
 let owner=scope.owner
 const service={scope:()=>({...scope,owner}),current:s=>s.owner===owner,releaseFiles:async()=>{},list:async()=>[],get:async()=>({jobId:'synthetic-download-job',status:'processing'}),download:(_id,_kind,_scope,_label,options)=>new Promise((resolve,reject)=>{
  const call={resolve,reject,options,aborted:0};calls.push(call)
  options?.onTask?.({abort(){call.aborted++;reject(Error('下载已暂停'))}})
 })}
 const r=miniRuntime({modules:{'bundles/marking/service':service},wx:{openDocument:opts=>{calls.push({opened:opts.filePath});opts.success?.({})}}})
 r.storage.set('stemistUser',{id:owner});r.storage.set('stemistSessionToken','synthetic-download-session')
 const p=r.page('bundles/marking/index');p.onLoad();p.__draft.jobId='synthetic-download-job';p.setData({jobId:p.__draft.jobId,reportAvailable:true})
 return {p,calls,switchOwner:()=>{owner='another-owner';r.storage.set('stemistUser',{id:owner})}}
}
const event={currentTarget:{dataset:{kind:'report'}}}

test('background interruption aborts the active download and resumes only that report',async()=>{
 const f=fixture(),pending=f.p.document(event);await settle()
 f.calls[0].options.onProgress({downloadedBytes:65536,totalBytes:131072,percent:50})
 assert.match(f.p.data.documentStatus,/50%/)
 f.p.onHide();await pending
 assert.equal(f.calls[0].aborted,1)
 assert.equal(f.p.data.documentBusy,false)
 assert.match(f.p.data.documentStatus,/暂停/)
 f.p.onShow();await settle();await settle()
 assert.equal(f.calls.length,2)
 f.calls[1].resolve('/owned/completed.pdf');await settle()
 assert.equal(f.calls.filter(c=>c.opened).length,1)
 f.p.onUnload()
})

test('explicit download pause never auto-resumes',async()=>{
 const f=fixture(),pending=f.p.document(event);await settle()
 f.p.cancelDocument();await pending
 f.p.onHide();f.p.onShow();await settle()
 assert.equal(f.calls.length,1)
 assert.equal(f.calls[0].aborted,1)
 f.p.onUnload()
})

test('late document success cannot open on another page/account',async()=>{
 const f=fixture(),pending=f.p.document(event);await settle()
 f.switchOwner();f.calls[0].resolve('/owned/previous-user.pdf');await pending
 assert.equal(f.calls.some(c=>c.opened),false)
 f.p.onUnload()
})

test('native viewer hide after completion cannot start a download loop',async()=>{
 const f=fixture(),pending=f.p.document(event);await settle()
 f.calls[0].resolve('/owned/completed.pdf');await pending
 f.p.onHide();f.p.onShow();await settle()
 assert.equal(f.calls.filter(c=>!c.opened).length,1)
 f.p.onUnload()
})

test('temporary preview is labeled without claiming a persisted local report',async()=>{
 const f=fixture(),pending=f.p.document(event);await settle()
 f.calls[0].options.onTemporary()
 assert.match(f.p.data.documentStatus,/临时.*云端报告/)
 f.calls[0].options.onProgress({downloadedBytes:1000,totalBytes:2000,percent:50})
 assert.match(f.p.data.documentStatus,/临时预览下载.*50%/)
 f.calls[0].resolve('/tmp/temporary-report.pdf');await pending
 assert.match(f.p.data.documentStatus,/临时 PDF.*云端报告/)
 f.p.onUnload()
})
