import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime, deferred, settle } from './helpers/mini-runtime.mjs'

const app = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'))
const testClean=value=>String(value||'').replaceAll(String.fromCharCode(0),'').replace(/\r\n?/g,'\n').trim()
assert.ok(app.subPackages.find(item => item.root === 'bundles/coach').pages.includes('admissions'), 'Admissions must be a lazy native Coach page')
const hubRuntime = miniRuntime(), hub = hubRuntime.page('bundles/coach/index')
hub.onLoad({})
assert.equal(hub.data.modes.filter(item => item.id === 'admissions').length, 1)
hub.applyProductConfig({ config: { coach: { modes: hub.data.modes.filter(item => item.id !== 'admissions') } } })
assert.equal(hub.data.modes.filter(item => item.id === 'admissions').length, 1, 'Legacy remote configuration must not hide the new native feature')
hub.openMode({ currentTarget: { dataset: { mode: 'admissions' } } })
assert.equal(hubRuntime.calls.at(-1).url, '/bundles/coach/admissions')

const record = revision => ({ id: 'admissions-test-conversation', persona: 'admissions-advisor', revision, turnCount: revision })
const boundRecord = (id, revision) => ({ id, persona: 'admissions-advisor', revision, turnCount: revision })
const pair = (message, answer, offset = 0) => [
  { id: 'user-' + offset, role: 'user', content: message, sequence: offset + 1, status: 'complete' },
  { id: 'answer-' + offset, role: 'assistant', content: answer, sequence: offset + 2, status: 'complete' },
]
let generation = deferred(), sent = [], fetched = [], resumes = 0, deleted = 0, canonical = [], revision = 0
const runtime = miniRuntime({ wx: { showModal: options => options.success({ confirm: true }), setClipboardData: options => options.success?.({}) }, modules: {
  'bundles/coach/admissionsConversation': {
    cleanAdmissionsMessage: testClean,
    newClientTurnId: () => 'admissions-test-turn-' + (sent.length + 1),
    resumeAdmissions: async () => { resumes++; return { conversation: record(revision), messages: canonical, nextBefore: canonical.length ? 'older-cursor' : '' } },
    fetchAdmissionsMessages: async request => { fetched.push(request); return { conversation: record(revision), messages: pair('更早的问题', '更早的建议'), nextBefore: '' } },
    deleteAdmissions: async () => { deleted++; canonical = []; revision = 0; return { deleted: true, conversationId: record(0).id } },
    sendAdmissions: async request => { sent.push(request); request.onPartial('## 初步建议\n先确认目标专业。'); const result = await generation.promise; if (result instanceof Error) throw result; revision++; canonical = pair(request.message, result, revision * 2); return { mode: 'ai', providerStatus: 'connected', answer: result, conversation: record(revision), clientTurnId: request.clientTurnId, turns: canonical } },
  },
} })
runtime.storage.set('stemistUser', { id: 'student-admissions' })
runtime.storage.set('stemistSessionToken', 'synthetic-session')
runtime.storage.set('stemistCoachPhoto', '/private/academic.jpg')
runtime.storage.set('stemistTavern:student-admissions', { draft: 'private-tavern-content' })
const page = runtime.page('bundles/coach/admissions')
page.onLoad({}); page.onShow(); await settle()
assert.equal(resumes, 1, 'onLoad/onShow must not double-resume')
page.onMessage({detail:{value:'😀'.repeat(12000)}})
assert.equal(Array.from(page.data.message).length,12000,'The page preserves 12,000 Unicode code points without UTF-16 truncation')
page.useStarter({ currentTarget: { dataset: { index: 0 } } })
assert.ok(page.data.message.length > 10)
assert.equal(sent.length, 0, 'Starter fills draft without spending an AI request')
page.onMessage({ detail: { value: '我读 IB，想申请英国物理本科，请帮我分析申请准备。' } })
const first = page.submit(); await settle()
assert.equal(page.data.loading, true)
assert.match(page.data.partialAnswer, /初步建议/)
assert.doesNotMatch(JSON.stringify(sent[0]), /private-tavern|academic\.jpg|imageDataUrls|history|context|persona/)
generation.resolve('## 申请建议\n先核对目标专业官网，再安排准备。'); await first
assert.equal(page.data.loading, false)
assert.equal(page.data.turns.length, 2)
assert.match(page.data.turns[1].content, /申请建议/)
assert.equal(page.data.message, '')
assert.equal(page.data.partialAnswer, '')
assert.equal(page.data.canRetry, false)

generation = deferred()
page.onMessage({ detail: { value: '帮我改一封询问入学资格的邮件。' } })
const failed = page.submit(); await settle(); generation.resolve(Object.assign(Error('连接中断'), { code: 'network_error', partialAnswer: '## 草稿\n未完成' })); await failed
const failedId = sent.at(-1).clientTurnId
assert.equal(page.data.canRetry, true)
assert.match(page.data.message, /邮件/)
assert.equal(page.data.turns.length, 2, 'Incomplete reply must not enter canonical history')
assert.match(page.data.partialAnswer, /未完成/)
generation = deferred(); const retry = page.submit(); await settle()
assert.equal(sent.at(-1).clientTurnId, failedId, 'Retry reuses idempotency identity')
generation.resolve('## 邮件修改稿\nDear Admissions Team,'); await retry
await page.loadOlderHistory()
assert.equal(fetched.at(-1).before,'older-cursor','Resolve the first history cursor before requesting an older page')
assert.equal(page.data.historyBrowsing, true)
assert.equal(page.data.turns[0].content, '更早的问题')
await page.returnLatestHistory()
assert.equal(page.data.historyBrowsing, false)
page.onMessage({ detail: { value: '本账号独立草稿' } })
page.onHide(); page.onUnload()
const restored = runtime.page('bundles/coach/admissions')
restored.onLoad({}); restored.onShow(); await settle()
assert.equal(restored.data.message, '本账号独立草稿')
await restored.clearConversation()
assert.equal(deleted, 1)
assert.equal(restored.data.turns.length, 0)
assert.equal(restored.data.message, '')
assert.equal(runtime.storage.get('stemistCoachPhoto'), '/private/academic.jpg', 'Clearing admissions must not clear academic or Tavern data')
assert.ok(runtime.storage.get('stemistTavern:student-admissions'))

generation = deferred(); restored.onMessage({ detail: { value: '旧账号隐私文书' } })
const stale = restored.submit(); await settle()
runtime.storage.set('stemistUser', { id: 'another-student' })
restored.onShow(); await settle()
generation.resolve('旧账号分析结果'); await stale
assert.equal(restored.data.message, '')
assert.equal(restored.data.partialAnswer, '')
assert.doesNotMatch(JSON.stringify(restored.data.turns), /旧账号/)
assert.equal(restored.onShareAppMessage().path, '/bundles/coach/index')
assert.equal(restored.onShareAppMessage().imageUrl,'/design-system/share-card.png','Sharing never captures private application text')
restored.onUnload()

const requests = []
const clientRuntime = miniRuntime({ modules: { 'utils/api': { COACH_TEXT_TIMEOUT_MS: 55000, requestJson: async (path, body, options) => {
  requests.push({ path, body, options })
  if (path.endsWith('/resume')) return { conversation: record(0), messages: [], nextBefore: '' }
  if (options.method === 'DELETE') return { deleted: true, conversationId: record(0).id }
  if (path.includes('/messages')) return { conversation: record(1), messages: pair('问', '答'), nextBefore: '' }
  const receiptResult=body.message==='提交延后'?{mode:'interrupted',providerStatus:'storage_error',answer:'已生成但待保存',clientTurnId:body.clientTurnId,conversation:record(body.expectedRevision+1),turns:[],code:'admissions_commit_deferred',retryable:true,partial:true,receiptStatus:'durable',providerRetryRequired:false}:body.message==='生成状态未知'?{mode:'indeterminate',providerStatus:'storage_error',answer:'状态未知的生成内容',clientTurnId:body.clientTurnId,conversation:record(body.expectedRevision+1),turns:[],code:'admissions_generation_indeterminate',retryable:false,partial:true,receiptStatus:'volatile',providerRetryRequired:false,exactlyOnceGuaranteed:false}:null
  const result = receiptResult||{
    mode: 'ai', providerStatus: 'connected', answer: '完整建议', clientTurnId: body.clientTurnId,
    conversation: record(body.message === '版本未前进' ? body.expectedRevision : body.expectedRevision + 1),
    turns: body.message === '来源标识错误'
      ? pair(body.message, '完整建议')
      : [
          { id: body.clientTurnId + ':user', role: 'user', content: body.message, sequence: body.expectedRevision * 2 + 1, status: 'complete' },
          { id: body.clientTurnId + ':assistant', role: 'assistant', content: '完整建议', sequence: body.expectedRevision * 2 + 2, status: 'complete' },
        ],
  }
  options.stream.push(`event: meta\ndata: {"mode":"ai"}\n\nevent: delta\ndata: ${JSON.stringify({text:receiptResult?result.answer+'。':'完整建议'})}\n\n`)
  return result
} } } })
clientRuntime.storage.set('stemistUser', { id: 'client-owner' })
const client = clientRuntime.load('bundles/coach/admissionsConversation')
await client.resumeAdmissions()
assert.equal(requests.at(-1).path, '/api/ai/admissions/conversations/resume')
let preview = ''
await client.sendAdmissions({ message: '帮我分析申请', conversationId: record(0).id, expectedRevision: 0, clientTurnId: 'client-test-turn', onPartial: text => { preview = text } })
assert.equal(preview, '完整建议')
assert.equal(requests.at(-1).path, '/api/ai/admissions/stream')
assert.ok(requests.at(-1).options.timeout <= 55000)
assert.deepEqual(Object.keys(requests.at(-1).body).sort(), ['clientTurnId', 'conversationId', 'expectedRevision', 'message'])
await assert.rejects(client.sendAdmissions({ message: 'x'.repeat(12001), conversationId: record(0).id, expectedRevision: 0, clientTurnId: 'client-test-turn' }), /12000/)
const sensitiveDraft = '\u0000  第一行\r\n第二行\rdata:image/png;base64,QUJDRA==\nsk-1234567890abcdef\nBearer abc.def-123  '
await client.sendAdmissions({ message: sensitiveDraft, conversationId: record(0).id, expectedRevision: 0, clientTurnId: 'client-clean-turn' })
assert.equal(requests.at(-1).body.message, '第一行\n第二行\n[image omitted]\n[secret omitted]\nBearer [secret omitted]', 'Outbound content uses the same canonical cleaning as the server')
assert.equal(client.cleanAdmissionsMessage('data:image/png;base64,QUJD_RA-=='),'[image omitted]')
assert.equal(client.cleanAdmissionsMessage('sk-12345678901'),'sk-12345678901','The client uses the backend credential threshold exactly')
assert.equal(Array.from(client.cleanAdmissionsMessage('😀'.repeat(12000))).length,12000,'The character limit counts Unicode code points like the backend')
assert.throws(()=>client.cleanAdmissionsMessage('😀'.repeat(12001)),/12000/)
await assert.rejects(client.sendAdmissions({ message: '来源标识错误', conversationId: record(0).id, expectedRevision: 0, clientTurnId: 'client-source-turn' }), /不匹配/)
await assert.rejects(client.sendAdmissions({ message: '版本未前进', conversationId: record(0).id, expectedRevision: 2, clientTurnId: 'client-revision-turn' }), /不匹配|版本/)
const deferredClientError=await client.sendAdmissions({message:'提交延后',conversationId:record(0).id,expectedRevision:0,clientTurnId:'client-deferred-turn'}).catch(error=>error)
assert.equal(deferredClientError.code,'admissions_commit_deferred')
assert.equal(deferredClientError.retryable,true)
assert.equal(deferredClientError.providerRetryRequired,false)
assert.match(deferredClientError.partialAnswer,/已生成但待保存/)
const indeterminateClientError=await client.sendAdmissions({message:'生成状态未知',conversationId:record(0).id,expectedRevision:0,clientTurnId:'client-indeterminate-turn'}).catch(error=>error)
assert.equal(indeterminateClientError.code,'admissions_generation_indeterminate')
assert.equal(indeterminateClientError.retryable,false)
assert.equal(indeterminateClientError.exactlyOnceGuaranteed,false)
assert.equal(indeterminateClientError.providerRetryRequired,false)
assert.equal(indeterminateClientError.receiptStatus,'volatile')

const template = fs.readFileSync(new URL('../bundles/coach/admissions.wxml', import.meta.url), 'utf8')
const style = fs.readFileSync(new URL('../bundles/coach/admissions.wxss', import.meta.url), 'utf8')
assert.match(template, /adjust-position="{{false}}"/)
assert.match(template, /bindkeyboardheightchange="onComposerKeyboard"/)
assert.match(template, /answer-content/)
assert.match(template, /answer-content[^>]*academic="{{true}}"/,'Admissions uses the line-aware section renderer, not a whole paragraph styled as a heading')
assert.match(template, /仅显示已收到的部分内容|未完成/)
assert.match(template,/disabled="{{[^}]*(?:sendBlocked)[^}]*}}"/,'Indeterminate generation disables the send action')
assert.match(template,/重试保存|等待确认/,'Receipt states never look like a generic regeneration action')
assert.match(style, /safe-area-inset-bottom/)
assert.match(style, /min-height:\s*44px/)
assert.match(style, /minmax\(0,\s*1fr\)/)
const logoutRuntime=miniRuntime()
logoutRuntime.storage.set('stemistUser',{id:'logout-owner'})
logoutRuntime.storage.set('stemistAdmissions:logout-owner:0',{draft:'private application draft'})
logoutRuntime.load('utils/session').clearLocalSession({preserveDrafts:true})
assert.ok(logoutRuntime.storage.has('stemistAdmissions:logout-owner:0'),'A transient 401 retains same-owner draft')
logoutRuntime.load('utils/session').clearLocalSession()
assert.equal(logoutRuntime.storage.has('stemistAdmissions:logout-owner:0'),false,'Explicit logout must remove admissions drafts')
const recoveredTurns=pair('已发问题','后台已完成的建议').map(item=>({...item,id:'recovered-turn:'+item.role}))
const recovery=miniRuntime({modules:{'bundles/coach/admissionsConversation':{cleanAdmissionsMessage:testClean,resumeAdmissions:async()=>({conversation:record(1),messages:recoveredTurns,nextBefore:''})}}})
recovery.storage.set('stemistUser',{id:'recovery-owner'});recovery.storage.set('stemistSessionToken','synthetic-session')
recovery.storage.set('stemistAdmissions:recovery-owner:0',{owner:'recovery-owner',epoch:0,draft:'已发问题',conversation:record(0),pending:{clientTurnId:'recovered-turn',message:'已发问题',expectedRevision:0}})
const recovered=recovery.page('bundles/coach/admissions');recovered.onLoad();recovered.onShow();await settle()
assert.equal(recovered.data.message,'','A completed pending turn restores without requiring another send')
assert.equal(recovered.data.canRetry,false)
assert.equal(recovered.data.turns[1].content,'后台已完成的建议')
recovered.onUnload()

// An authenticated clear must discover the cloud conversation even if local metadata is unavailable.
let unknownClearResumes=0, unknownClearDeletes=0
const unknownClear=miniRuntime({modules:{'utils/api':{isAuthError:()=>false},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:testClean,
  newClientTurnId:()=> 'unknown-clear-turn',
  resumeAdmissions:async()=>{unknownClearResumes++;return{conversation:record(0),messages:[],nextBefore:''}},
  fetchAdmissionsMessages:async()=>({conversation:record(0),messages:[],nextBefore:''}),
  deleteAdmissions:async({conversationId})=>{unknownClearDeletes++;return{deleted:true,conversationId}},
  sendAdmissions:async()=>{throw Error('unused')},
}}})
unknownClear.storage.set('stemistUser',{id:'unknown-clear-owner'});unknownClear.storage.set('stemistSessionToken','token')
const unknownClearPage=unknownClear.page('bundles/coach/admissions');unknownClearPage.onLoad();await unknownClearPage.clearConversation()
assert.equal(unknownClearResumes,1,'Clear resolves the authenticated cloud conversation before deleting')
assert.equal(unknownClearDeletes,1,'Clear never reports success without a cloud DELETE')
const deletedRetry=miniRuntime({modules:{'utils/api':{isAuthError:()=>false},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:testClean,newClientTurnId:()=> 'deleted-retry-turn',resumeAdmissions:async()=>({conversation:record(0),messages:[],nextBefore:''}),fetchAdmissionsMessages:async()=>({conversation:record(0),messages:[],nextBefore:''}),
  deleteAdmissions:async()=>{throw Object.assign(Error('already deleted'),{statusCode:410,code:'admissions_conversation_deleted'})},sendAdmissions:async()=>{throw Error('unused')},
}}})
deletedRetry.storage.set('stemistUser',{id:'deleted-retry-owner'});deletedRetry.storage.set('stemistSessionToken','token')
deletedRetry.storage.set('stemistAdmissions:deleted-retry-owner:0',{owner:'deleted-retry-owner',epoch:0,draft:'must stay cleared',conversation:record(0),pending:null,clearPending:true})
const deletedRetryPage=deletedRetry.page('bundles/coach/admissions');deletedRetryPage.onLoad()
assert.equal(await deletedRetryPage.clearConversation(),true,'An authenticated already-deleted response completes the interrupted local clear fence')
assert.equal(deletedRetryPage.data.message,'')

// If every durable storage operation fails, an in-memory clear fence must still mask stale private data.
let fenceBlocked=true, fenceDeletes=0
const fenceStorage=new Map([
  ['stemistUser',{id:'fence-owner'}],['stemistSessionToken','token'],
  ['stemistAdmissions:fence-owner:0',{owner:'fence-owner',epoch:0,draft:'sensitive application draft',conversation:record(0),pending:null,clearPending:false}],
])
const fenceRuntime=miniRuntime({wx:{
  getStorageSync:key=>fenceStorage.has(key)?fenceStorage.get(key):'',
  setStorageSync:(key,value)=>{if(fenceBlocked&&String(key).startsWith('stemistAdmissions:'))throw Error('quota');fenceStorage.set(key,value)},
  removeStorageSync:key=>{if(fenceBlocked&&String(key).startsWith('stemistAdmissions:'))throw Error('quota');fenceStorage.delete(key)},
  getStorageInfoSync:()=>({keys:[...fenceStorage.keys()]}),
},modules:{'utils/api':{isAuthError:()=>false},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:testClean,
  newClientTurnId:()=> 'fence-clear-turn',resumeAdmissions:async()=>({conversation:record(0),messages:[],nextBefore:''}),
  fetchAdmissionsMessages:async()=>({conversation:record(0),messages:[],nextBefore:''}),
  deleteAdmissions:async({conversationId})=>{fenceDeletes++;return{deleted:true,conversationId}},sendAdmissions:async()=>{throw Error('unused')},
}}})
const fencePage=fenceRuntime.page('bundles/coach/admissions');fencePage.onLoad();await fencePage.clearConversation();assert.equal(fenceDeletes,1)
const fencedReopen=fenceRuntime.page('bundles/coach/admissions');fencedReopen.onLoad()
assert.equal(fencedReopen.data.message,'','A clear fence masks an old local draft after storage failure')
assert.equal(fencedReopen.data.clearPending,true,'Unsafe local persistence remains explicitly retryable')
fenceBlocked=false;await fencedReopen.clearConversation();assert.equal(fencedReopen.data.clearPending,false,'Retry persists the local privacy fence without another cloud delete')
assert.equal(fenceDeletes,1)

// A transient 401 followed by the same owner logging in must rehydrate and issue a new resume.
let authResumeCalls=0
const authResume=deferred()
const authRecovery=miniRuntime({modules:{'utils/api':{isAuthError:error=>Number(error?.statusCode)===401||error?.code==='auth_required'},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:testClean,
  newClientTurnId:()=> 'auth-recovery-turn',
  resumeAdmissions:async()=>{authResumeCalls++;if(authResumeCalls===1)return authResume.promise;return{conversation:record(0),messages:[],nextBefore:''}},
  fetchAdmissionsMessages:async()=>({conversation:record(0),messages:[],nextBefore:''}),deleteAdmissions:async({conversationId})=>({deleted:true,conversationId}),sendAdmissions:async()=>{throw Error('unused')},
}}})
authRecovery.storage.set('stemistUser',{id:'same-owner'});authRecovery.storage.set('stemistSessionToken','expired-token')
authRecovery.storage.set('stemistAdmissions:same-owner:0',{owner:'same-owner',epoch:0,draft:'preserved application draft',conversation:record(0),pending:null,clearPending:false})
const authPage=authRecovery.page('bundles/coach/admissions');authPage.onLoad();authPage.onShow();await settle()
authRecovery.storage.delete('stemistUser');authRecovery.storage.delete('stemistSessionToken')
authResume.reject(Object.assign(Error('expired'),{statusCode:401,code:'auth_required'}));await settle();await settle()
authRecovery.storage.set('stemistUser',{id:'same-owner'});authRecovery.storage.set('stemistSessionToken','fresh-token');authPage.onShow();await settle();await settle()
assert.equal(authResumeCalls,2,'Same-owner login starts a fresh resume instead of reusing a settled promise')
assert.equal(authPage.data.message,'preserved application draft')

// Explicit revision conflict is reconciled, then the same idempotency ID is rebased once.
let conflictRevision=0, conflictRequests=[]
const conflictRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:testClean,
  newClientTurnId:()=> 'revision-conflict-turn',resumeAdmissions:async()=>({conversation:record(conflictRevision),messages:[],nextBefore:''}),
  fetchAdmissionsMessages:async()=>({conversation:record(conflictRevision),messages:[],nextBefore:''}),deleteAdmissions:async({conversationId})=>({deleted:true,conversationId}),
  sendAdmissions:async request=>{conflictRequests.push(request);if(conflictRequests.length===1)throw Object.assign(Error('conflict'),{statusCode:409,code:'admissions_conversation_revision_conflict'});return{mode:'ai',providerStatus:'connected',answer:'rebased answer',clientTurnId:request.clientTurnId,conversation:record(request.expectedRevision+1),turns:[{id:request.clientTurnId+':user',role:'user',content:request.message,sequence:3,status:'complete'},{id:request.clientTurnId+':assistant',role:'assistant',content:'rebased answer',sequence:4,status:'complete'}]}},
}}})
conflictRuntime.storage.set('stemistUser',{id:'conflict-owner'});conflictRuntime.storage.set('stemistSessionToken','token')
const conflictPage=conflictRuntime.page('bundles/coach/admissions');conflictPage.onLoad();conflictPage.onShow();await settle();await settle();conflictPage.onMessage({detail:{value:'retry safely'}});await conflictPage.submit()
conflictRevision=1;await conflictPage.returnLatestHistory();await conflictPage.submit()
assert.deepEqual(conflictRequests.map(item=>item.expectedRevision),[0,1])
assert.equal(conflictRequests[0].clientTurnId,conflictRequests[1].clientTurnId)

// A new request must not leave the device until its idempotency record is durable.
let persistBlocked=false,persistSends=0
const persistStorage=new Map([['stemistUser',{id:'persist-owner'}],['stemistSessionToken','token']])
const persistRuntime=miniRuntime({wx:{getStorageSync:key=>persistStorage.has(key)?persistStorage.get(key):'',setStorageSync:(key,value)=>{if(persistBlocked&&String(key).startsWith('stemistAdmissions:'))throw Error('quota');persistStorage.set(key,value)},removeStorageSync:key=>persistStorage.delete(key),getStorageInfoSync:()=>({keys:[...persistStorage.keys()]})},modules:{'utils/api':{isAuthError:()=>false},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:testClean,
  newClientTurnId:()=> 'persisted-pending-turn',resumeAdmissions:async()=>({conversation:record(0),messages:[],nextBefore:''}),fetchAdmissionsMessages:async()=>({conversation:record(0),messages:[],nextBefore:''}),deleteAdmissions:async({conversationId})=>({deleted:true,conversationId}),sendAdmissions:async()=>{persistSends++;throw Error('must not dispatch')},
}}})
const persistPage=persistRuntime.page('bundles/coach/admissions');persistPage.onLoad();persistPage.onShow();await settle();await settle();persistPage.onMessage({detail:{value:'do not duplicate'}});persistBlocked=true;await persistPage.submit()
assert.equal(persistSends,0)
assert.match(persistPage.data.error,/未发送|本机/)

// Completing a turn invalidates an opaque history cursor before paging again.
let cursorResumes=0,cursorFetches=[]
const cursorRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:testClean,
  newClientTurnId:()=> 'cursor-turn-123',resumeAdmissions:async()=>{cursorResumes++;return{conversation:record(cursorResumes===1?20:21),messages:[],nextBefore:cursorResumes===1?'old-boundary':'fresh-boundary'}},
  fetchAdmissionsMessages:async request=>{cursorFetches.push(request);return{conversation:record(21),messages:pair('older','answer'),nextBefore:''}},deleteAdmissions:async({conversationId})=>({deleted:true,conversationId}),
  sendAdmissions:async request=>({mode:'ai',providerStatus:'connected',answer:'new answer',clientTurnId:request.clientTurnId,conversation:record(21),turns:[{id:request.clientTurnId+':user',role:'user',content:request.message,sequence:41,status:'complete'},{id:request.clientTurnId+':assistant',role:'assistant',content:'new answer',sequence:42,status:'complete'}]}),
}}})
cursorRuntime.storage.set('stemistUser',{id:'cursor-owner'});cursorRuntime.storage.set('stemistSessionToken','token')
const cursorPage=cursorRuntime.page('bundles/coach/admissions');cursorPage.onLoad();cursorPage.onShow();await settle();await settle();cursorPage.onMessage({detail:{value:'new turn'}});await cursorPage.submit();await cursorPage.loadOlderHistory()
assert.equal(cursorResumes,2,'Paging refreshes the latest opaque cursor after a new completion')
assert.equal(cursorFetches.at(-1).before,'fresh-boundary')

// Existing conversation identity/revision are binding, never advisory.
const bindingRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:testClean,
  newClientTurnId:()=> 'binding-turn-123',resumeAdmissions:async()=>({conversation:boundRecord('different-conversation',2),messages:pair('wrong','thread'),nextBefore:''}),fetchAdmissionsMessages:async()=>({conversation:boundRecord('different-conversation',2),messages:pair('wrong','thread'),nextBefore:''}),deleteAdmissions:async({conversationId})=>({deleted:true,conversationId}),sendAdmissions:async()=>{throw Error('unused')},
}}})
bindingRuntime.storage.set('stemistUser',{id:'binding-owner'});bindingRuntime.storage.set('stemistSessionToken','token')
bindingRuntime.storage.set('stemistAdmissions:binding-owner:0',{owner:'binding-owner',epoch:0,draft:'',conversation:boundRecord('expected-conversation',3),pending:null,clearPending:false})
const bindingPage=bindingRuntime.page('bundles/coach/admissions');bindingPage.onLoad();bindingPage.onShow();await settle();await settle()
assert.equal(bindingPage.__conversation.id,'expected-conversation')
assert.equal(bindingPage.data.turns.length,0)
assert.match(bindingPage.data.error,/对话|记录|刷新/)
const pagingBinding=miniRuntime({modules:{'utils/api':{isAuthError:()=>false},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:testClean,newClientTurnId:()=> 'paging-binding-turn',
  resumeAdmissions:async()=>({conversation:boundRecord('paging-conversation',3),messages:[],nextBefore:'paging-cursor'}),
  fetchAdmissionsMessages:async()=>({conversation:boundRecord('paging-conversation',2),messages:pair('stale','history'),nextBefore:''}),
  deleteAdmissions:async({conversationId})=>({deleted:true,conversationId}),sendAdmissions:async()=>{throw Error('unused')},
}}})
pagingBinding.storage.set('stemistUser',{id:'paging-owner'});pagingBinding.storage.set('stemistSessionToken','token')
const pagingPage=pagingBinding.page('bundles/coach/admissions');pagingPage.onLoad();pagingPage.onShow();await settle();await settle();await pagingPage.loadOlderHistory()
assert.equal(pagingPage.data.turns.length,0,'A stale history page never replaces the current thread')
assert.match(pagingPage.data.error,/过期|刷新/)

// Account changes during throttled preview reject the request without escaping the timer callback.
let timerSequence=0,timerCancel
const timerQueue=new Map(),timerGlobals={setTimeout:(fn,ms)=>{const id=++timerSequence;timerQueue.set(id,{fn,ms});return id},clearTimeout:id=>timerQueue.delete(id)}
const timerRuntime=miniRuntime({globals:timerGlobals,modules:{'utils/api':{COACH_TEXT_TIMEOUT_MS:55000,requestJson:async(path,body,options)=>{options.stream.push('event: meta\ndata: {"mode":"ai"}\n\n');options.stream.push('event: delta\ndata: {"text":"第一段。\\n"}\n\n');options.stream.push('event: delta\ndata: {"text":"第二段。\\n"}\n\n');return new Promise(()=>{})}}}})
timerRuntime.storage.set('stemistUser',{id:'timer-owner'})
const timerClient=timerRuntime.load('bundles/coach/admissionsConversation')
const timerOutcome=timerClient.sendAdmissions({message:'timer test',conversationId:'timer-conversation',clientTurnId:'timer-client-turn',expectedRevision:0,onPartial(){},onCancelReady:fn=>{timerCancel=fn}}).catch(error=>error)
await settle();timerRuntime.storage.set('stemistPrivacyEpoch',1)
for(const[id,timer]of[...timerQueue])if(timer.ms===120){timerQueue.delete(id);assert.doesNotThrow(()=>timer.fn())}
assert.equal((await timerOutcome).code,'account_changed');timerCancel?.()

// A durable provider receipt retries only the commit with the same clientTurnId and survives restart.
let deferredCalls=[]
const deferredRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:testClean,newClientTurnId:()=> 'deferred-client-turn',
  resumeAdmissions:async()=>({conversation:record(0),messages:[],nextBefore:''}),fetchAdmissionsMessages:async()=>({conversation:record(0),messages:[],nextBefore:''}),deleteAdmissions:async({conversationId})=>({deleted:true,conversationId}),
  sendAdmissions:async request=>{deferredCalls.push(request);if(deferredCalls.length===1)throw Object.assign(Error('commit deferred'),{code:'admissions_commit_deferred',statusCode:503,retryable:true,providerRetryRequired:false,receiptStatus:'durable',partialAnswer:'已生成的完整建议。'});return{mode:'ai',providerStatus:'connected',answer:'已生成的完整建议。',clientTurnId:request.clientTurnId,conversation:record(2),turns:[{id:request.clientTurnId+':user',role:'user',content:request.message,sequence:1,status:'complete'},{id:request.clientTurnId+':assistant',role:'assistant',content:'已生成的完整建议。',sequence:2,status:'complete'}]}},
}}})
deferredRuntime.storage.set('stemistUser',{id:'deferred-owner'});deferredRuntime.storage.set('stemistSessionToken','token')
const deferredPage=deferredRuntime.page('bundles/coach/admissions');deferredPage.onLoad();deferredPage.onShow();await settle();await settle();deferredPage.onMessage({detail:{value:'保存这条申请建议'}});await deferredPage.submit()
assert.equal(deferredPage.data.receiptState,'commit-deferred')
assert.equal(deferredPage.data.canRetry,true)
assert.equal(deferredPage.data.sendBlocked,false)
assert.match(deferredPage.data.error,/重试保存/)
assert.equal(deferredPage.data.message,'保存这条申请建议')
assert.equal(deferredPage.data.partialAnswer,'已生成的完整建议。')
deferredPage.onMessage({detail:{value:'下一条申请问题草稿'}})
assert.equal(deferredPage.data.sendBlocked,false,'A newer draft does not prevent retrying the durable commit')
const deferredId=deferredPage.__pending.clientTurnId;deferredPage.onHide();deferredPage.onUnload()
const deferredRestored=deferredRuntime.page('bundles/coach/admissions');deferredRestored.onLoad();deferredRestored.onShow();await settle();await settle()
assert.equal(deferredRestored.__pending.clientTurnId,deferredId)
assert.equal(deferredRestored.data.receiptState,'commit-deferred')
assert.equal(deferredRestored.data.partialAnswer,'已生成的完整建议。')
assert.equal(deferredRestored.data.message,'下一条申请问题草稿')
await deferredRestored.submit()
assert.deepEqual(deferredCalls.map(item=>item.clientTurnId),[deferredId,deferredId])
assert.equal(deferredRestored.data.receiptState,'')
assert.equal(deferredRestored.data.partialAnswer,'')
assert.equal(deferredRestored.data.message,'下一条申请问题草稿','Saving the prior generated answer preserves the newer draft')

// A volatile/indeterminate generation cannot silently call the provider again and remains blocked across restart.
let indeterminateCalls=0,indeterminateCommitted=false
const indeterminateRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:testClean,newClientTurnId:()=> 'indeterminate-client-turn',
  resumeAdmissions:async()=>indeterminateCommitted?{conversation:record(2),messages:[{id:'indeterminate-client-turn:user',role:'user',content:'只生成一次',sequence:1,status:'complete'},{id:'indeterminate-client-turn:assistant',role:'assistant',content:'后来确认的建议',sequence:2,status:'complete'}],nextBefore:''}:{conversation:record(0),messages:[],nextBefore:''},
  fetchAdmissionsMessages:async()=>({conversation:record(0),messages:[],nextBefore:''}),deleteAdmissions:async({conversationId})=>({deleted:true,conversationId}),
  sendAdmissions:async()=>{indeterminateCalls++;throw Object.assign(Error('generation indeterminate'),{code:'admissions_generation_indeterminate',statusCode:503,retryable:false,exactlyOnceGuaranteed:false,providerRetryRequired:false,receiptStatus:'volatile',partialAnswer:'可能已生成的建议。'})},
}}})
indeterminateRuntime.storage.set('stemistUser',{id:'indeterminate-owner'});indeterminateRuntime.storage.set('stemistSessionToken','token')
const indeterminatePage=indeterminateRuntime.page('bundles/coach/admissions');indeterminatePage.onLoad();indeterminatePage.onShow();await settle();await settle();indeterminatePage.onMessage({detail:{value:'只生成一次'}});await indeterminatePage.submit()
assert.equal(indeterminatePage.data.receiptState,'indeterminate')
assert.equal(indeterminatePage.data.canRetry,false)
assert.equal(indeterminatePage.data.sendBlocked,true)
assert.match(indeterminatePage.data.error,/避免重复调用 AI|刷新记录/)
assert.doesNotMatch(indeterminatePage.data.error,/请重试(?:。|$)/)
assert.equal(indeterminatePage.data.message,'只生成一次')
assert.equal(indeterminatePage.data.partialAnswer,'可能已生成的建议。')
await indeterminatePage.submit();assert.equal(indeterminateCalls,1,'The same indeterminate turn never calls the provider again')
await indeterminatePage.returnLatestHistory();assert.equal(indeterminatePage.data.sendBlocked,true);assert.equal(indeterminatePage.data.partialAnswer,'可能已生成的建议。')
indeterminatePage.onHide();indeterminatePage.onUnload()
const indeterminateRestored=indeterminateRuntime.page('bundles/coach/admissions');indeterminateRestored.onLoad();indeterminateRestored.onShow();await settle();await settle()
assert.equal(indeterminateRestored.data.receiptState,'indeterminate')
assert.equal(indeterminateRestored.data.sendBlocked,true)
assert.equal(indeterminateRestored.data.partialAnswer,'可能已生成的建议。')
indeterminateRestored.onMessage({detail:{value:'一个真正不同的新问题'}});await indeterminateRestored.submit();assert.equal(indeterminateCalls,1,'Changed text remains blocked until receipt reconciliation or clear')
indeterminateCommitted=true;await indeterminateRestored.returnLatestHistory()
assert.equal(indeterminateRestored.data.receiptState,'')
assert.equal(indeterminateRestored.data.sendBlocked,false)
assert.equal(indeterminateRestored.data.message,'一个真正不同的新问题','Refresh preserves a genuinely changed draft')
assert.equal(indeterminateRestored.data.partialAnswer,'')

const hubStyle=fs.readFileSync(new URL('../bundles/coach/index.wxss',import.meta.url),'utf8')
assert.ok(hubStyle.indexOf('.mode-detail{')<hubStyle.indexOf('.mode-admissions .mode-detail{'),'Base Coach typography rule remains independently testable')
assert.match(hubStyle,/\.coach-hub-page\.device-tablet \.mode-admissions\s*\{[^}]*padding-left:\s*(?:9[0-9]|[1-9]\d{2,})px/,'Tablet admissions text keeps clear of its absolute icon')
console.log('PASS admissions advisor: entry, isolation, restore, streaming, canonical completion, replay, clear, history, and keyboard contracts')
