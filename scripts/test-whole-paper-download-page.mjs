import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { miniRuntime, settle } from './helpers/mini-runtime.mjs'

function fixture({autoOpen=true}={}){
 const scope={owner:'synthetic-download-owner',epoch:0},calls=[]
 let owner=scope.owner
 const service={scope:()=>({...scope,owner}),current:s=>s.owner===owner,releaseFiles:async()=>{},list:async()=>[],get:async()=>({jobId:'synthetic-download-job',status:'processing'}),download:(_id,_kind,_scope,_label,options)=>new Promise((resolve,reject)=>{
  const call={resolve,reject,options,kind:_kind,scope:_scope,aborted:0};calls.push(call)
  options?.onTask?.({abort(){call.aborted++;reject(Error('下载已暂停'))}})
 })}
 const r=miniRuntime({modules:{'bundles/marking/service':service},wx:{openDocument:opts=>{calls.push({opened:opts.filePath,options:opts});if(autoOpen)opts.success?.({})}}})
 r.storage.set('stemistUser',{id:owner});r.storage.set('stemistSessionToken','synthetic-download-session')
 const p=r.page('bundles/marking/index');p.onLoad();p.__draft.jobId='synthetic-download-job';p.setData({jobId:p.__draft.jobId,reportAvailable:true})
 return {p,calls,switchOwner:()=>{owner='another-owner';r.storage.set('stemistUser',{id:owner})}}
}
const event={currentTarget:{dataset:{kind:'report'}}}

test('background interruption aborts the active download and resumes only that report',async()=>{
 const f=fixture(),pending=f.p.document(event);await settle()
 f.calls[0].options.onProgress({downloadedBytes:65536,totalBytes:131072,percent:50,speedLabel:'64 KB/s',remainingLabel:'约 1 秒'})
 assert.equal(f.p.data.documentProgress.percent,50)
 assert.equal(f.p.data.documentProgress.speedLabel,'64 KB/s')
 f.p.onHide();await pending
 assert.equal(f.calls[0].aborted,1)
 assert.equal(f.p.data.documentBusy,false)
 assert.equal(f.p.data.documentProgress.phase,'paused')
 assert.match(f.p.data.documentProgress.message,/暂停/)
 f.p.onShow();await settle();await settle()
 assert.equal(f.calls.length,2)
 f.calls[1].resolve('/owned/completed.pdf');await settle()
 assert.equal(f.calls.filter(c=>c.opened).length,1)
 f.p.onUnload()
})

test('explicit download pause never auto-resumes',async()=>{
 const f=fixture(),pending=f.p.document(event);await settle()
 f.p.cancelDocument();await pending
 assert.equal(f.p.data.documentProgress.phase,'paused')
 assert.equal(f.p.data.documentProgress.canRetry,true)
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
 assert.match(f.p.data.documentProgress.label,/临时/)
 assert.match(f.p.data.documentProgress.message,/云端报告/)
 f.calls[0].options.onProgress({downloadedBytes:1000,totalBytes:2000,percent:50,phase:'downloading'})
 assert.equal(f.p.data.documentProgress.percent,50)
 f.calls[0].resolve('/tmp/temporary-report.pdf');await pending
 assert.equal(f.p.data.documentProgress.phase,'ready')
 assert.match(f.p.data.documentProgress.message,/临时 PDF.*云端报告/)
 f.p.onUnload()
})

test('unknown, verified, opening and cached phases stay truthful',async()=>{
 const f=fixture({autoOpen:false}),pending=f.p.document(event);await settle()
 assert.equal(f.p.data.documentProgress.phase,'connecting')
 assert.match(f.p.data.documentProgress.message,/权限/)
 assert.equal(f.p.data.documentProgress.knownTotal,false)
 assert.equal(f.p.data.documentProgress.percent,null)
 f.calls[0].options.onProgress({downloadedBytes:999,totalBytes:1000,phase:'verifying'})
 assert.equal(f.p.data.documentProgress.phase,'verifying')
 assert.equal(f.p.data.documentProgress.percent,99)
 f.calls[0].options.onProgress({downloadedBytes:1000,totalBytes:1000,percent:100,complete:true,phase:'cached',fromCache:true})
 f.calls[0].resolve('/owned/cached.pdf');await settle()
 assert.equal(f.p.data.documentProgress.phase,'opening')
 assert.equal(f.p.data.documentProgress.percent,100)
 assert.match(f.p.data.documentProgress.message,/缓存/)
 f.calls.find(call=>call.opened)?.options.success?.({});await pending
 assert.equal(f.p.data.documentProgress.phase,'ready')
 assert.match(f.p.data.documentProgress.message,/缓存/)
 f.p.onUnload()
})

test('download failure exposes a scoped component retry',async()=>{
 const f=fixture(),first=f.p.document(event);await settle();f.calls[0].reject(Error('synthetic offline'));await first
 assert.equal(f.p.data.documentProgress.phase,'error')
 assert.equal(f.p.data.documentProgress.canRetry,true)
 f.p.retryDocument();await settle()
 assert.equal(f.calls.length,2)
 assert.equal(f.calls[1].kind,'report')
 f.p.cancelDocument();await settle();f.p.onUnload()
})

test('source PDF uses the same progress component and stale-owner retry is fenced',async()=>{
 const f=fixture(),sourceEvent={currentTarget:{dataset:{kind:'source'}}},pending=f.p.document(sourceEvent);await settle()
 assert.equal(f.p.data.documentProgress.label,'作答 PDF')
 f.calls[0].reject(Error('synthetic source offline'));await pending
 f.switchOwner();f.p.retryDocument();await settle()
 assert.equal(f.calls.length,1,'an old owner cannot retry a private source PDF after identity changes')
 f.p.onUnload()
})

test('whole-paper download uses the shared progress component without a duplicate status panel',()=>{
 const root=path.resolve(import.meta.dirname,'..'),template=fs.readFileSync(path.join(root,'bundles/marking/index.wxml'),'utf8'),config=JSON.parse(fs.readFileSync(path.join(root,'bundles/marking/index.json'),'utf8'))
 assert.equal(config.usingComponents['pdf-download-progress'],'/components/pdf-download-progress/index')
 assert.match(template,/<pdf-download-progress[^>]*state="{{documentProgress}}"[^>]*compact="{{true}}"[^>]*bindcancel="cancelDocument"[^>]*bindretry="retryDocument"/)
 assert.doesNotMatch(template,/bindtoggle=/,'compact whole-paper progress does not expose a redundant collapse action')
 assert.doesNotMatch(template,/documentStatus|marking-document-progress/)
})
