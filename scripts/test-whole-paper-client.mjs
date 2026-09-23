import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime, deferred, settle } from './helpers/mini-runtime.mjs'

const clone = value => JSON.parse(JSON.stringify(value))
const markingTemplate=fs.readFileSync(new URL('../bundles/marking/index.wxml',import.meta.url),'utf8')
assert.doesNotMatch(markingTemplate,/需要人工复核|需人工复核|标注待复核/,'AI marking must not present human review as the final workflow step')
assert.match(markingTemplate,/AI 自动完成批改/)
assert.match(markingTemplate,/wx:if="{{selectionError}}"[^>]*role="alert"/,'File-selection failures must be announced beside the picker')
const pdf = Uint8Array.from(Buffer.from('%PDF-1.7\nfixture')).buffer
const jpg = Uint8Array.from([255,216,255,224,1,2]).buffer
const input = (id='file-answer1', role='answer', mediaType='image/jpeg') => ({id, role, mediaType, kind:mediaType==='application/pdf'?'pdf':'image', path:'/tmp/'+id, name:id+(mediaType==='application/pdf'?'.pdf':'.jpg'), size:mediaType==='application/pdf'?pdf.byteLength:jpg.byteLength})
const jobId='job-fixture-123'
function serviceRuntime() {
  let json = async () => ({}), bytes=jpg, size=jpg.byteLength, reads=0, request, download
  const removed=[]
  const r=miniRuntime({
    wx:{env:{USER_DATA_PATH:'/app'},getFileSystemManager:()=>({
      getFileInfo:opts=>opts.success({size}),readFile:opts=>{reads++;opts.success({data:bytes})},
      mkdirSync(){},accessSync(){},unlink:opts=>removed.push(opts.filePath),
    }),request:opts=>{request=opts;return{abort(){opts.fail({errMsg:'abort'})}}},downloadFile:opts=>{download=opts}},
    modules:{'utils/api':{requestJson:(...args)=>json(...args),safeErrorMessage:(_,status)=>'failed '+status},
      'utils/nativeSession':{refreshNativeSession:async()=>{}},
      'utils/session':{clearLocalSession:()=>{r.storage.delete('stemistUser');r.storage.delete('stemistSessionToken')}},
    },
  })
  r.storage.set('stemistUser',{id:'student-a'});r.storage.set('stemistSessionToken','fixture-token')
  return{...r,api:r.load('bundles/marking/service'),removed,setJson:fn=>{json=fn},setBytes:b=>{bytes=b;size=b.byteLength},setSize:n=>{size=n},get reads(){return reads},get request(){return request},get download(){return download}}
}

const r=serviceRuntime(), api=r.api, s=api.scope()
assert.equal((await api.inspect(input(),s)).mediaType,'image/jpeg')
r.setBytes(pdf);assert.equal((await api.inspect(input('file-pdf123','answer','application/pdf'),s)).mediaType,'application/pdf')
await assert.rejects(()=>api.inspect(input(),s),/格式/)
r.setSize(11*1024*1024);const reads=r.reads
await assert.rejects(()=>api.inspect(input('file-pdf123','answer','application/pdf'),s),/10 MB/)
assert.equal(r.reads,reads,'Oversize selection must fail before reading into memory')
r.setBytes(jpg)
assert.throws(()=>api.validateFiles([]),/作答/)
assert.throws(()=>api.validateFiles([input(),input('file-pdf123','answer','application/pdf')]),/作答/)
assert.throws(()=>api.validateFiles(Array.from({length:21},(_,i)=>input('file-'+i))),/作答/)
assert.throws(()=>api.validateFiles([input(),input('file-ref123','mark-scheme')]),/评分标准/)
assert.throws(()=>api.validateFiles([{...input(),size:NaN}]),/无效/)
assert.throws(()=>api.validateFiles([{...input(),role:'admin'}]),/无效/)
api.validateFiles([input(),input('file-ref123','mark-scheme','application/pdf')])
const draft={clientRequestId:'request-fixture',files:[input('file-first1'),input('file-second2')]}
let createBody
r.setJson(async(_path,body)=>{createBody=body;return {jobId,status:'draft',assets:body.files.map((f,i)=>({clientAssetId:f.clientAssetId,assetId:'asset-fixture'+i}))}})
await api.create(draft,s)
assert.deepEqual(clone(createBody.files.map(f=>[f.clientAssetId,f.order])),[['file-first1',1],['file-second2',2]])
r.setJson(async()=>({jobId,assets:[]}));await assert.rejects(()=>api.create(draft,s),/完整/)
const f={...input(),assetId:'asset-answer1'}
const control={cancelled:()=>false}
const uploading=api.upload(jobId,f,s,control);await settle()
assert.equal(r.request.method,'PUT');assert.equal(r.request.data.byteLength,jpg.byteLength)
assert.equal(r.request.header['Content-Type'],'image/jpeg')
assert.equal(r.request.header.Authorization,'Bearer fixture-token')
r.request.success({statusCode:200,data:{assetId:f.assetId,status:'uploaded'}});await uploading
const interrupted=api.upload(jobId,f,s,control);await settle();control.task.abort()
await assert.rejects(()=>interrupted,/已上传文件保留/)
const expired=api.upload(jobId,f,s,control);await settle();r.request.success({statusCode:401,data:{}})
await assert.rejects(()=>expired);assert.equal(api.current(s),false)

const d=serviceRuntime(), ds=d.api.scope()
d.storage.set('stemistPaperReports',['/app/marking-reports/../../private.pdf','/other/photo.jpg'])
const downloading=d.api.download(jobId,'report',ds);await settle()
assert.match(d.download.filePath,/整卷批改_job-fixture-123-[\w-]+_批改报告\.pdf$/)
assert.equal(d.removed.length,0,'Forged paths are never deleted')
assert.equal(d.storage.get('stemistPaperReports').length,1)
const firstPath=d.download.filePath
d.download.success({statusCode:200});assert.equal(await downloading,firstPath)
const downloading2=d.api.download(jobId,'report',ds);await settle()
assert.notEqual(d.download.filePath,firstPath,'Retry cannot overwrite an already downloaded report')
const secondPath=d.download.filePath
d.storage.set('stemistUser',{id:'student-b'});d.download.success({statusCode:200})
await assert.rejects(()=>downloading2,/账号/)
assert.deepEqual(d.removed,[secondPath],'Late private result is removed after owner switch')
const failedDownload=serviceRuntime(), fsScope=failedDownload.api.scope()
const storedReports=Array.from({length:20},(_,i)=>'/app/marking-reports/整卷批改_saved-'+i+'_批改报告.pdf')
failedDownload.storage.set('stemistPaperReports',storedReports)
const failure=failedDownload.api.download(jobId,'report',fsScope);await settle()
assert.equal(failedDownload.removed.length,0,'Starting download must not evict completed reports')
failedDownload.download.fail({});await assert.rejects(()=>failure)
assert.deepEqual(clone(failedDownload.storage.get('stemistPaperReports')),storedReports,'Failed download must not consume retention slots')
const download401=failedDownload.api.download(jobId,'report',fsScope);await settle();failedDownload.download.success({statusCode:401})
await assert.rejects(()=>download401);assert.equal(failedDownload.api.current(fsScope),false)

function pageRuntime(overrides={},wx={},globals={}) {
  let currentOwner='student-a',epoch=0
  const calls=[], jobs=new Map(), uploads=[]
  const service={scope:()=>({owner:currentOwner,epoch}),current:s=>s?.owner===currentOwner&&s.epoch===epoch,
    validateFiles:api.validateFiles,inspect:async f=>({...f,size:6,mediaType:f.kind==='pdf'?'application/pdf':'image/jpeg'}),
    list:async()=>[],get:async id=>jobs.get(id),
    create:async draft=>{calls.push(['create',draft.clientRequestId]);const job={jobId,status:'draft',assets:draft.files.map((f,i)=>({clientAssetId:f.id,assetId:'asset-fixture'+i}))};jobs.set(jobId,job);return job},
    upload:async(id,file)=>{uploads.push(file.id);jobs.get(id).assets.find(a=>a.assetId===file.assetId).status='uploaded'},
    submit:async draft=>{calls.push(['submit',draft.files.map(f=>f.assetId)]);jobs.get(jobId).status='queued'},
    retry:async()=>{},...overrides,
  }
  const r=miniRuntime({wx,globals,modules:{'bundles/marking/service':service}})
  r.storage.set('stemistUser',{id:currentOwner});r.storage.set('stemistSessionToken','fixture')
  const p=r.page('bundles/marking/index');p.onLoad()
  return {...r,p,service,calls,jobs,uploads,switchOwner:owner=>{currentOwner=owner;r.storage.set('stemistUser',{id:owner})},switchEpoch:value=>{epoch=value;r.storage.set('stemistPrivacyEpoch',value)}}
}
function fakeTimers(){
  let next=0
  const timers=new Map()
  return{globals:{setTimeout:(fn,delay)=>{const id=++next;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id)},pending:()=>timers.size,runAll:()=>{const queued=[...timers.values()];timers.clear();for(const timer of queued)timer.fn()}}
}
const q=pageRuntime(),p=q.p

let chooser,privacyChecks=0
const inspected=deferred()
const selection=pageRuntime({inspect:file=>inspected.promise.then(()=>({...file,size:pdf.byteLength,mediaType:'application/pdf'}))},{
  getPrivacySetting:options=>{privacyChecks++;options.success({needAuthorization:false})},
  chooseMessageFile:options=>{chooser=options},
})
selection.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.ok(chooser,'PDF chooser must be invoked synchronously from the user tap')
assert.equal(privacyChecks,1,'Privacy is prefetched before the user tap, not awaited inside it')
assert.equal(selection.p.data.picking,true)
selection.p.onHide()
assert.equal(selection.p.data.picking,true,'Native chooser lifecycle hide must not end selection state')
chooser.success({tempFiles:[{path:'/tmp/answer.pdf',name:'answer.pdf'}]})
selection.p.onShow()
assert.equal(privacyChecks,2,'Returning from the native chooser revalidates privacy state')
await settle()
assert.equal(selection.p.data.picking,true,'Submit remains blocked while the selected PDF is inspected')
inspected.resolve()
await settle()
assert.equal(selection.p.data.picking,false)
assert.equal(selection.p.data.answers.length,1,'Selection survives the chooser hide/show lifecycle')
assert.equal(selection.p.data.answers[0].mediaType,'application/pdf')
await selection.p.submit();selection.p.pause()
assert.equal(selection.p.data.jobStatus,'queued','A PDF selected through the native chooser can be submitted')
assert.deepEqual(selection.uploads,[selection.p.__draft.files[0].id])

const recoveryClock=fakeTimers()
let recoveryChooser
const recovery=pageRuntime({}, {
  getPrivacySetting:options=>options.success({needAuthorization:false}),
  chooseMessageFile:options=>{recoveryChooser=options},
},recoveryClock.globals)
recovery.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
const abandonedChooser=recoveryChooser
recovery.p.onHide()
assert.equal(recoveryClock.pending(),0,'No recovery timeout runs while the native chooser owns the screen')
recoveryClock.runAll();assert.equal(recovery.p.data.picking,true)
recovery.p.onShow()
assert.equal(recoveryClock.pending(),1,'Recovery starts only after the page becomes visible again')
recoveryClock.runAll();await settle()
assert.equal(recovery.p.data.picking,false)
assert.match(recovery.p.data.selectionError,/未返回结果/)
recovery.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
const retryChooser=recoveryChooser
assert.notEqual(retryChooser,abandonedChooser)
abandonedChooser.success({tempFiles:[{path:'/tmp/stale.pdf',name:'stale.pdf'}]})
await settle()
assert.equal(recovery.p.data.answers.length,0,'A late callback from the abandoned chooser cannot add a stale file')
assert.equal(recovery.p.data.picking,true,'A late callback cannot unlock the newer chooser')
retryChooser.fail({errMsg:'chooseMessageFile:fail cancel'});await settle()
assert.equal(recovery.p.data.picking,false)

const inspectionClock=fakeTimers()
const inspectionResult=deferred()
let inspectionChooser
const inspectionRecovery=pageRuntime({inspect:file=>inspectionResult.promise.then(()=>({...file,size:pdf.byteLength,mediaType:'application/pdf'}))},{
  getPrivacySetting:options=>options.success({needAuthorization:false}),
  chooseMessageFile:options=>{inspectionChooser=options},
},inspectionClock.globals)
inspectionRecovery.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
inspectionRecovery.p.onHide();inspectionRecovery.p.onShow()
assert.equal(inspectionClock.pending(),1)
inspectionChooser.success({tempFiles:[{path:'/tmp/inspect.pdf',name:'inspect.pdf'}]})
await settle()
assert.equal(inspectionClock.pending(),0,'A native callback clears return recovery before inspection')
inspectionClock.runAll()
assert.equal(inspectionRecovery.p.data.picking,true,'Return recovery never interrupts file inspection')
inspectionResult.resolve();await settle()
assert.equal(inspectionRecovery.p.data.answers.length,1)

const lifecycleClock=fakeTimers()
let lifecycleChooser
const lifecycleRecovery=pageRuntime({}, {
  getPrivacySetting:options=>options.success({needAuthorization:false}),
  chooseMessageFile:options=>{lifecycleChooser=options},
},lifecycleClock.globals)
lifecycleRecovery.p.pickPdf({currentTarget:{dataset:{role:'answer'}}});lifecycleRecovery.p.onHide();lifecycleRecovery.p.onShow()
assert.equal(lifecycleClock.pending(),1)
lifecycleRecovery.switchOwner('student-b');lifecycleRecovery.p.bindOwner()
assert.equal(lifecycleClock.pending(),0,'Owner changes clear pending chooser recovery')
lifecycleChooser.success({tempFiles:[{path:'/tmp/old-owner.pdf',name:'old-owner.pdf'}]});await settle()
assert.equal(lifecycleRecovery.p.data.answers.length,0)
lifecycleRecovery.p.pickPdf({currentTarget:{dataset:{role:'answer'}}});lifecycleRecovery.p.onHide();lifecycleRecovery.p.onShow()
assert.equal(lifecycleClock.pending(),1)
lifecycleRecovery.p.onUnload()
assert.equal(lifecycleClock.pending(),0,'Unload clears pending chooser recovery')

let consentChooser
const consent=pageRuntime({}, {
  getPrivacySetting:options=>options.success({needAuthorization:true}),
  chooseMessageFile:options=>{consentChooser=options},
})
assert.equal(consent.p.data.privacy,true)
consent.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.equal(consentChooser,undefined,'Privacy consent is required before opening protected file APIs')
consent.p.agreePrivacy()
assert.match(consent.p.data.status,/再次点击选择文件/)
consent.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.ok(consentChooser,'The tap after confirmed privacy consent opens the chooser synchronously')
const cancelledChooser=consentChooser
consentChooser.fail({errMsg:'chooseMessageFile:fail cancel'})
await settle()
assert.equal(consent.p.data.selectionError,'','Cancelling the native chooser is not presented as an error')
consent.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.notEqual(consentChooser,cancelledChooser,'Cancelling leaves the picker immediately retryable')
consentChooser.success({tempFiles:[{path:'/tmp/retry.pdf',name:'retry.pdf'}]})
await settle()
assert.equal(consent.p.data.answers.length,1)

let blockedChooser
const privacyPending=pageRuntime({}, {
  getPrivacySetting:()=>{},
  chooseMessageFile:options=>{blockedChooser=options},
})
privacyPending.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.equal(blockedChooser,undefined,'Unknown privacy state never enters a protected file API')
assert.equal(privacyPending.p.data.picking,false)
assert.match(privacyPending.p.data.selectionError,/隐私设置/)

let privacyFailChecks=0,privacyFailChooser
const privacyFailure=pageRuntime({}, {
  getPrivacySetting:options=>{privacyFailChecks++;options.fail({errMsg:'getPrivacySetting:fail'})},
  chooseMessageFile:options=>{privacyFailChooser=options},
})
privacyFailure.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
assert.equal(privacyFailChecks,2,'A tap retries a failed privacy preflight')
assert.equal(privacyFailChooser,undefined)
assert.equal(privacyFailure.p.data.picking,false)
assert.match(privacyFailure.p.data.selectionError,/隐私设置暂时无法读取/)

let failedChooser
const nativeFailure=pageRuntime({}, {
  getPrivacySetting:options=>options.success({needAuthorization:false}),
  chooseMessageFile:options=>{failedChooser=options},
})
nativeFailure.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
failedChooser.fail({errMsg:'chooseMessageFile:fail api scope is not declared in the privacy agreement'})
await settle()
assert.equal(nativeFailure.p.data.picking,false)
assert.match(nativeFailure.p.data.selectionError,/未声明“选中的文件”/,'A missing privacy declaration points to the administrator, not repeated student consent')
nativeFailure.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
failedChooser.fail({errMsg:'chooseMessageFile:fail privacy authorization required'})
await settle()
assert.match(nativeFailure.p.data.selectionError,/完成隐私授权/,'A consent failure tells the student how to recover')
assert.doesNotMatch(nativeFailure.p.data.selectionError,/未声明/)

let invalidChooser
const invalidSelection=pageRuntime({inspect:async()=>{throw Error('PDF 不能超过 10 MB。')}},{
  getPrivacySetting:options=>options.success({needAuthorization:false}),
  chooseMessageFile:options=>{invalidChooser=options},
})
invalidSelection.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
invalidChooser.success({tempFiles:[{path:'/tmp/oversize.pdf',name:'oversize.pdf'}]})
await settle()
assert.equal(invalidSelection.p.data.picking,false)
assert.equal(invalidSelection.p.data.selectionError,'PDF 不能超过 10 MB。','Local inspection errors remain precise and actionable')

let scopedChooser,scopePrivacyChecks=0
const scopedInspection=deferred()
const scopedSelection=pageRuntime({inspect:file=>scopedInspection.promise.then(()=>({...file,size:pdf.byteLength,mediaType:'application/pdf'}))},{
  getPrivacySetting:options=>{scopePrivacyChecks++;options.success({needAuthorization:false})},
  chooseMessageFile:options=>{scopedChooser=options},
})
scopedSelection.p.pickPdf({currentTarget:{dataset:{role:'answer'}}})
scopedChooser.success({tempFiles:[{path:'/tmp/private-a.pdf',name:'private-a.pdf'}]})
await settle()
assert.equal(scopedSelection.p.data.picking,true)
scopedSelection.switchOwner('student-b');scopedSelection.p.bindOwner()
assert.equal(scopePrivacyChecks,2,'Owner changes revalidate privacy instead of reusing cached state')
assert.equal(scopedSelection.p.data.picking,false)
scopedInspection.resolve();await settle()
assert.equal(scopedSelection.p.data.answers.length,0,'Inspection finishing after an owner change cannot publish the old private file')
scopedSelection.switchEpoch(1);scopedSelection.p.bindOwner()
assert.equal(scopePrivacyChecks,3,'Privacy epoch changes also revalidate cached state')

p.__draft.files=[input('file-first1'),input('file-second2'),input('file-ref123','mark-scheme','application/pdf')];p.save()
p.move({currentTarget:{dataset:{id:'file-second2',delta:-1}}})
assert.deepEqual(clone(p.__draft.files.map(f=>f.id)),['file-second2','file-first1','file-ref123'])
await p.submit();p.pause()
assert.deepEqual(q.uploads,['file-second2','file-first1','file-ref123'])
assert.equal(p.data.jobStatus,'queued')
assert.deepEqual(clone(q.calls.find(c=>c[0]==='submit')[1]),['asset-fixture0','asset-fixture1','asset-fixture2'])
const requestId=p.__draft.clientRequestId
await p.submit();p.pause()
assert.equal(q.calls.filter(c=>c[0]==='create').length,1,'Retry retrieves same job, never creates duplicate')
assert.equal(q.calls.filter(c=>c[0]==='submit').length,1,'Already queued job not resubmitted')
p.data.history=[{jobId}];p.openJob({currentTarget:{dataset:{id:jobId}}});await settle();p.pause()
assert.equal(p.__draft.files.length,3,'History restores local upload paths')
assert.equal(p.__draft.clientRequestId,requestId)

p.setJob({jobId,status:'completed',result:{assessmentMode:'ai-advisory-unscored',officialScore:false,provisionalScore:100,maxScore:100,summary:'feedback',questionResults:[{questionId:'1',score:1,maxScore:1,feedback:'test'}]}})
assert.equal(p.data.result.scoreReady,false);assert.equal(p.data.questions[0].scoreReady,false)
p.setJob({jobId,status:'completed',result:{assessmentMode:'ai-provisional',officialScore:false,provisionalScore:5,maxScore:10,questionResults:Array.from({length:21},(_,i)=>({questionId:String(i+1),feedback:'test'}))}})
assert.equal(p.data.result.scoreReady,true);assert.equal(p.data.questions.length,10)
p.reportPage({currentTarget:{dataset:{delta:1}}});assert.equal(p.data.questions[0].questionId,'11')
p.reportPage({currentTarget:{dataset:{delta:1}}});assert.equal(p.data.questions.length,1)
p.setJob({jobId,status:'completed',result:{assessmentMode:'ai-provisional',officialScore:true,provisionalScore:5,maxScore:10}})
assert.equal(p.data.result.scoreReady,false,'Official flag cannot be promoted by UI')
p.setJob({jobId,status:'completed',result:{assessmentMode:'ai-provisional',officialScore:false,provisionalScore:3,maxScore:4,reviewRequired:true,missingPages:[2],missingQuestions:['3(b)'],questionResults:[{questionLabel:'2(a)',provisionalScore:3,maxScore:4,rationale:'单位缺失',confidence:0.7,reviewRequired:true,evidence:['作答第 1 页第二行'],criteria:[{label:'单位',awarded:0,maxScore:1,comment:'缺少 N'}]}]}})
assert.equal(p.data.questions[0].questionId,'2(a)')
assert.equal(p.data.questions[0].score,3)
assert.equal(p.data.questions[0].feedback,'单位缺失')
assert.match(p.data.questions[0].evidence,/第 1 页/)
assert.match(p.data.result.completeness,/3\(b\)/)
assert.equal(p.data.reportAvailable,false,'Saved AI feedback does not imply that a report PDF exists')
p.setJob({jobId,status:'completed',reportPdfPath:'/private/report.pdf',sourcePdfPath:'/private/source.pdf'})
assert.equal(p.data.reportAvailable,true)

const late=deferred(),a=pageRuntime({list:()=>late.promise})
const pendingHistory=a.p.loadHistory();a.switchOwner('student-b');a.p.bindOwner();late.resolve([{jobId,title:'private student A'}]);await pendingHistory
assert.equal(a.p.data.history.length,0,'Late history cannot cross accounts')
const authFail=deferred(),b=pageRuntime({get:()=>authFail.promise})
b.p.__draft.jobId=jobId;b.p.setData({result:{summary:'private'}})
const pendingStatus=b.p.refreshJob();b.switchOwner('guest');authFail.reject(Error('401'));await pendingStatus
assert.equal(b.p.data.authenticated,false);assert.equal(b.p.data.result,null,'Expired identity clears visible private report')
const first=deferred(),second=deferred();let requestCount=0
const race=pageRuntime({get:()=>++requestCount===1?first.promise:second.promise})
race.p.__draft.jobId=jobId
const earlier=race.p.refreshJob(),later=race.p.refreshJob()
second.resolve({jobId,status:'completed'});await later
first.resolve({jobId,status:'processing'});await earlier
assert.equal(race.p.data.jobStatus,'completed','Older poll cannot roll back a newer result')
const stale=pageRuntime()
stale.storage.set('stemistDraft:whole-paper:student-b',{epoch:0,files:[],routeId:'old-removed-route'})
stale.switchOwner('student-b');stale.p.bindOwner()
assert.equal(stale.p.__draft.routeId,stale.p.data.routes[stale.p.data.routeIndex].id,'Visible course must match new submission route')
let cancellationCalls=0
const cancellation=pageRuntime({cancel:async()=>{cancellationCalls++},get:async()=>({jobId,status:'failed',failureCode:'cancelled',retryable:false})})
cancellation.p.__draft.jobId=jobId;cancellation.p.setJob({jobId,status:'draft'})
cancellation.wx.showModal=opts=>opts.success({confirm:false})
await cancellation.p.cancelDraft();assert.equal(cancellationCalls,0)
cancellation.wx.showModal=opts=>opts.success({confirm:true})
await cancellation.p.cancelDraft();assert.equal(cancellationCalls,1);assert.equal(cancellation.p.data.jobLabel,'已取消');assert.equal(cancellation.p.data.error,'')
await cancellation.p.cancelDraft();assert.equal(cancellationCalls,1,'Completed cancellation cannot be repeated through UI')

const paused=deferred(),c=pageRuntime({upload:()=>paused.promise})
c.p.__draft.files=[input()];const pendingUpload=c.p.submit();await settle();c.p.onHide();paused.resolve({status:'uploaded'});await pendingUpload
assert.equal(c.calls.filter(x=>x[0]==='submit').length,0,'Backgrounded upload never auto-submits')
assert.equal(c.p.__draft.files[0].uploaded,true,'Completed upload can be resumed')
for(const fixture of [q,selection,recovery,inspectionRecovery,consent,privacyPending,privacyFailure,nativeFailure,invalidSelection,scopedSelection,a,b,c,race,stale,cancellation])fixture.p.onUnload()
console.log('Whole-paper client: native PDF selection, inspection, upload, privacy, ordering, idempotence, auth expiry, history, scoring, paging and pause regressions PASS')
