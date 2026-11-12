import assert from 'node:assert/strict'
import test from 'node:test'
import {miniRuntime,deferred} from './helpers/mini-runtime.mjs'
const guide={id:'announcement-paper-code-guide-v1',title:'真题编号怎么看？考试季、卷型与版本号说明',body:'9702_m25_qp_12 是春季 Paper 1 第 2 版本。',summary:'考试季、卷型与版本号说明',category:'learning',pinned:true,publishedAt:'2026-10-28T18:58:17.311Z',updatedAt:'2026-10-28T18:58:17.311Z'}
const policy={id:'announcement-membership-policy-v1',title:'免费用户与会员使用说明',summary:'PDF 与听力音频合计每天免费两份。',body:'一、免费账号\n每天两份。\n\n二、付费会员\n月卡 ¥28.80，固定 30 天，不自动续费。会员不限下载份数。\n\n三、计次\n同日重试不重复计次。',category:'service',pinned:true,publishedAt:'2026-10-29T17:36:47.286Z'}
test('student list uses server capability without probing management',async()=>{
 const calls=[],r=miniRuntime({modules:{'utils/api':{getJson:async path=>{calls.push(path);return{schemaVersion:'stem-announcements-v1',items:[guide],canManage:false}}}}});r.storage.set('stemistSessionToken','synthetic');r.storage.set('stemistUser',{id:'ielts:42',roles:['school_admin']})
 const page=r.page('bundles/announcements/index');await page.onLoad()
 assert.equal(page.data.canManage,false);assert.equal(calls.some(x=>x.includes('/manage')),false,'local role claims must not trigger administrator endpoint probes')
})
test('verified management capability enables only an explicit management visit',async()=>{
 const calls=[],r=miniRuntime({modules:{'utils/api':{getJson:async path=>{calls.push(path);return{schemaVersion:'stem-announcements-v1',items:[guide],canManage:true}}}}});r.storage.set('stemistSessionToken','synthetic');r.storage.set('stemistUser',{id:'ielts:42'})
 const page=r.page('bundles/announcements/index');await page.onLoad();assert.equal(page.data.canManage,true);assert.equal(calls.length,1)
 page.openManage();assert.equal(r.calls.at(-1).url,'/bundles/announcements/manage')
})
test('home uses a public cache immediately and keeps it during a failed refresh',async()=>{
 let fail=false;const pending=deferred();const r=miniRuntime({modules:{'utils/api':{getJson:async()=>fail?pending.promise:{schemaVersion:'stem-announcements-v1',items:[guide,policy],canManage:true}}}})
 await r.load('utils/announcements').fetchAnnouncements();fail=true
 const page=r.page('pages/index/index');page.__disposed=false;const load=page.loadAnnouncementPreview()
 assert.equal(page.data.announcement.id,guide.id,'first frame should not wait on the network')
 pending.reject(Error('offline'));await load;assert.equal(page.data.announcement.id,guide.id);assert.equal(page.data.announcement.publishedAt,guide.publishedAt)
 const cached=r.load('utils/announcements').readAnnouncementSnapshot();assert.equal(cached.canManage,undefined);assert.equal(cached.items.some(x=>x.readAt),false)
})
test('cached reader state and administrator rights never leak to another account',async()=>{
 const r=miniRuntime({modules:{'utils/api':{getJson:async()=>({schemaVersion:'stem-announcements-v1',items:[{...guide,readAt:'2026-11-12T00:00:00Z'}],canManage:true})}}})
 r.storage.set('stemistUser',{id:'ielts:42'});r.storage.set('stemistSessionToken','synthetic');await r.load('utils/announcements').fetchAnnouncements()
 r.storage.set('stemistUser',{id:'ielts:99'});const service=r.load('utils/announcements'),cached=service.readAnnouncementSnapshot()
 assert.equal(service.announcementViews(cached.items)[0].unread,true);assert.equal(cached.canManage,undefined)
})
test('quota modal uses the published membership terms and never places an order',async()=>{
 const modals=[],r=miniRuntime({wx:{showModal:o=>modals.push(o)},modules:{'utils/api':{getJson:async()=>({schemaVersion:'stem-announcements-v1',items:[guide,policy]})}}})
 await r.load('utils/announcements').fetchAnnouncements();const notice=r.load('utils/downloadQuotaNotice')
 notice.showDownloadQuotaNotice({wxApi:r.wx,isCurrent:()=>true});notice.showDownloadQuotaNotice({wxApi:r.wx,isCurrent:()=>true})
 assert.equal(modals.length,1,'concurrent duplicate quota callbacks show one modal');assert.match(modals[0].content,/28.80/);assert.match(modals[0].content,/不自动续费/);assert.equal(r.calls.length,0)
 modals[0].success({confirm:true});modals[0].complete();assert.equal(r.calls.at(-1).url,'/bundles/account/membership')
})
test('unknown membership price is not invented and stale modal cannot navigate a new account',async()=>{
 const modals=[],r=miniRuntime({wx:{showModal:o=>modals.push(o)}});let current=true
 r.load('utils/downloadQuotaNotice').showDownloadQuotaNotice({wxApi:r.wx,isCurrent:()=>current})
 assert.doesNotMatch(modals[0].content,/28.80|¥/);current=false;modals[0].success({confirm:true});modals[0].complete();assert.equal(r.calls.length,0)
})
test('PDF popup requires the exact quota-denied response and is once per operation',async()=>{
 for(const [statusCode,code,expected] of [[401,'',0],[403,'',0],[429,'',0],[503,'pdf_quota_unavailable',0],[429,'pdf_daily_limit_reached',1]]){
  let request;const modals=[],r=miniRuntime({wx:{showModal:o=>modals.push(o),downloadFile:o=>{request=o;return{abort(){},onProgressUpdate(){},onHeadersReceived(){}}}}})
  r.storage.set('stemistUser',{id:'ielts:42'});r.storage.set('stemistSessionToken','synthetic')
  const controller=r.load('utils/pdfDownload').createPdfDownloadController();controller.setScope('one')
  await controller.open({url:'https://stem.ieltsist.com/local-pdf/9702/synthetic.pdf',itemId:'one',ownerKey:'one'})
  const response={statusCode,header:code?{'X-Pdf-Access-Code':code}:{}}
  request.success(response);request.success(response)
  assert.equal(modals.length,expected,`status ${statusCode}, ${code||'no code'}`)
  if(modals.length){controller.setScope('two');modals[0].success({confirm:true});modals[0].complete();assert.equal(r.calls.length,0,'a late quota modal cannot navigate after the file/page changed')}
  controller.dispose()
 }
})
test('audio uses the same explicit quota notice without auto-sharing or purchasing',async()=>{
 const modals=[],r=miniRuntime({wx:{showModal:o=>modals.push(o)},modules:{'utils/nativeSession':{refreshNativeSession:async()=>{}},'utils/listeningAudioRangeCache':{hasCompleteAudioCandidate:()=>false,acquireRangeAudio:()=>({promise:Promise.reject(Object.assign(Error('quota'),{code:'pdf_daily_limit_reached'})),release(){}})}}})
 r.storage.set('stemistUser',{id:'ielts:42'});r.storage.set('stemistSessionToken','synthetic')
 const item={id:'audio-'+'a'.repeat(32),url:'https://stem.ieltsist.com/api/stem/ielts-audio/files/audio-'+'a'.repeat(32),sha256:'b'.repeat(64),bytes:100,fileName:'Cambridge_IELTS_15_Test1.mp3'}
 const controller=r.load('bundles/curricula/audioDownload').createAudioDownloadController();controller.setScope('one');await controller.download(item)
 assert.equal(controller.getState().progress.quotaExhausted,true);assert.equal(modals.length,1);assert.equal(r.calls.length,0)
 controller.dispose();modals[0].success({confirm:true});modals[0].complete();assert.equal(r.calls.length,0)
})
