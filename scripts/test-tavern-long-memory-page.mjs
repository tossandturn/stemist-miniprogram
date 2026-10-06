import assert from 'node:assert/strict'
import { deferred, miniRuntime, settle } from './helpers/mini-runtime.mjs'

const plain = value => JSON.parse(JSON.stringify(value))
const completeMessage = (sequence, role, content) => ({ id: `cloud-${sequence}`, role, content, sequence, status: 'complete' })
const completedRounds = count => Array.from({ length: count }, (_, index) => [
  completeMessage(index * 2 + 1, 'user', `cloud user ${index + 1}`),
  completeMessage(index * 2 + 2, 'assistant', `cloud assistant ${index + 1}`),
]).flat()
const legacyRounds = count => Array.from({ length: count }, (_, index) => [
  { role: 'user', content: `legacy user ${index + 1} ${'问'.repeat(800)}` },
  { role: 'assistant', content: `legacy assistant ${index + 1} ${'答'.repeat(800)}` },
]).flat()

function fakeBackend({ messages = [], revision = 0, failDelete = 0, coachPlan = [] } = {}) {
  let cloud = plain(messages), currentRevision = revision, deleted = false, importSeen = false
  const requests = [], providerRequests = []
  const record = () => ({ id: 'conversation-keeper', persona: 'keeper', revision: currentRevision, turnCount: Math.floor(cloud.length / 2) })
  const page = before => {
    const bound = before ? Number(String(before).replace('before:', '')) : Number.POSITIVE_INFINITY
    const eligible = cloud.filter(item => item.sequence < bound)
    const items = eligible.slice(-40), first = items[0]?.sequence || 0
    return { conversation: record(), messages: plain(items), nextBefore: eligible.length > items.length ? `before:${first}` : '' }
  }
  const api = {
    COACH_TEXT_TIMEOUT_MS: 55_000,
    isAuthError: error => error?.code === 'auth_required' || error?.statusCode === 401,
    requestJson: async (path, body, options = {}) => {
      requests.push({ path, body: body === undefined ? undefined : plain(body), options: plain(options) })
      if (path === '/api/ai/tavern/conversations/resume') {
        let legacyImport
        if (body.legacyImport && !importSeen) {
          importSeen = true
          const imported = body.legacyImport.messages
          cloud = imported.map((item, index) => completeMessage(index + 1, item.role, item.content))
          currentRevision += 1
        }
        if(body.legacyImport)legacyImport={importId:body.legacyImport.importId,confirmed:true,importedMessageCount:body.legacyImport.messages.length}
        deleted = false
        return {...page(''),...(legacyImport?{legacyImport}:{})}
      }
      if (path.startsWith('/api/ai/tavern/conversations/conversation-keeper/messages?')) {
        const parsed = new URL(`https://fixture.invalid${path}`)
        return page(parsed.searchParams.get('before') || '')
      }
      if (path.startsWith('/api/ai/tavern/conversations/conversation-keeper?') && options.method === 'DELETE') {
        if (failDelete > 0) { failDelete -= 1; const error = Error('delete unavailable'); error.code = 'network_error'; throw error }
        deleted = true; cloud = []; currentRevision += 1
        return { deleted: true, conversationId: 'conversation-keeper' }
      }
      if (path === '/api/ai/coach') {
        providerRequests.push(plain(body))
        const planned = coachPlan.shift()
        if (planned instanceof Error) throw planned
        if (typeof planned === 'function') return planned({ body, cloud, revision: currentRevision })
        currentRevision += 1
        const start = cloud.at(-1)?.sequence || 0
        const turns = [completeMessage(start + 1, 'user', body.message), completeMessage(start + 2, 'assistant', planned?.answer || 'canonical answer')]
        cloud = [...cloud, ...turns]
        return { mode: 'ai', providerStatus: 'connected', answer: turns[1].content, clientTurnId: body.clientTurnId, conversation: record(), turns, memory: { contextWindowTokens: 1_000_000, estimatedInputUpperBoundTokens: 9000, countingMethod: 'utf8-upper-bound', historyTruncated: false, usedHistoryMessages: cloud.length - 2, retrievedSegments: 2 } }
      }
      throw Error(`unexpected request ${path}`)
    },
  }
  return { api, requests, providerRequests, cloud: () => plain(cloud), deleted: () => deleted, revision: () => currentRevision }
}

// Existing local records remain intact until an explicit send imports them.
const migrationBackend = fakeBackend()
const migrationRuntime = miniRuntime({ modules: { 'utils/api': migrationBackend.api } })
migrationRuntime.storage.set('stemistUser', { id: 'legacy-owner' })
migrationRuntime.storage.set('stemistSessionToken', 'fixture-token')
migrationRuntime.storage.set('stemistTavern:legacy-owner:0:selected', 'keeper')
const rawLegacy = legacyRounds(20)
migrationRuntime.storage.set('stemistTavern:legacy-owner:0:keeper', { owner: 'legacy-owner', epoch: 0, persona: 'keeper', draft: 'new request', turns: rawLegacy })
const migrationPage = migrationRuntime.page('bundles/coach/tavern')
migrationPage.onLoad(); await settle()
assert.equal(migrationPage.data.turns.length, 40)
assert.equal(migrationPage.data.historySource, 'legacy', 'an empty cloud resume must keep the old local page visibly labelled as pending migration')
assert.equal(migrationPage.read('keeper').legacyBackup.length, 40, 'raw legacy messages are backed up before any old bounded helper can discard them')
assert.equal(migrationBackend.requests.filter(item => item.path.endsWith('/resume')).length, 1)
assert.equal(migrationBackend.requests[0].body.legacyImport, undefined, 'background resume must not import until the user explicitly sends')
await migrationPage.submit()
const importRequest = migrationBackend.requests.find(item => item.path.endsWith('/resume') && item.body.legacyImport)
assert.equal(importRequest.body.legacyImport.messages.length, 40)
assert.ok(importRequest.body.legacyImport.messages.reduce((sum, item) => sum + Array.from(item.content).length, 0) > 24_000)
assert.equal(migrationBackend.providerRequests.length, 1)
assert.equal(migrationBackend.providerRequests[0].history, undefined)
assert.equal(migrationBackend.providerRequests[0].message, 'new request')
assert.equal(migrationPage.data.turns.length, 40, 'the render window remains bounded after importing and sending')
assert.equal(migrationPage.read('keeper').legacyBackup.length, 40, 'confirmed migration keeps a local fallback until explicit clear')
assert.equal(migrationPage.read('keeper').legacyImported, true)
assert.equal(migrationPage.data.historySource, 'cloud')
assert.equal(migrationRuntime.storage.get(migrationPage.key()).draft, '', 'a successful send cannot resurrect the submitted draft after reopening')

const largeImportBackend=fakeBackend(),largeImportRuntime=miniRuntime({modules:{'utils/api':largeImportBackend.api}})
largeImportRuntime.storage.set('stemistUser',{id:'large-import-owner'});largeImportRuntime.storage.set('stemistSessionToken','fixture-token');largeImportRuntime.storage.set('stemistTavern:large-import-owner:0:selected','keeper');largeImportRuntime.storage.set('stemistTavern:large-import-owner:0:keeper',{owner:'large-import-owner',epoch:0,persona:'keeper',draft:'after large import',turns:legacyRounds(55)})
const largeImportPage=largeImportRuntime.page('bundles/coach/tavern');largeImportPage.onLoad();await settle();assert.equal(largeImportPage.data.turns.length,40);await largeImportPage.submit()
const largeImportRequest=largeImportBackend.requests.find(item=>item.body?.legacyImport)
assert.equal(largeImportRequest.body.legacyImport.messages.length,110)
assert.equal(largeImportPage.read('keeper').legacyImported,true,'matching transactional ack confirms an import larger than the visible phone page')
assert.equal(largeImportPage.data.turns.length,40)
assert.equal(largeImportPage.data.historySource,'cloud')

let partialCoachCalls=0
const partialRuntime=miniRuntime({modules:{'utils/api':{COACH_TEXT_TIMEOUT_MS:55_000,isAuthError:()=>false,requestJson:async(path,body)=>{
 if(path==='/api/ai/tavern/conversations/resume'&&!body.legacyImport)return{conversation:{id:'conversation-keeper',persona:'keeper',revision:0,turnCount:0},messages:[],nextBefore:''}
 if(path==='/api/ai/tavern/conversations/resume')return{conversation:{id:'conversation-keeper',persona:'keeper',revision:1,turnCount:1},messages:[completeMessage(1,'user','partial'),completeMessage(2,'assistant','partial')],nextBefore:''}
 if(path==='/api/ai/coach'){partialCoachCalls++;throw Error('provider must not run after a partial import acknowledgement')}
 throw Error(`unexpected partial import request ${path}`)
}}}})
partialRuntime.storage.set('stemistUser',{id:'partial-owner'});partialRuntime.storage.set('stemistSessionToken','fixture-token');partialRuntime.storage.set('stemistTavern:partial-owner:0:selected','keeper');partialRuntime.storage.set('stemistTavern:partial-owner:0:keeper',{owner:'partial-owner',epoch:0,persona:'keeper',draft:'send after import',turns:legacyRounds(2)})
const partialPage=partialRuntime.page('bundles/coach/tavern');partialPage.onLoad();await settle();await partialPage.submit()
assert.equal(partialCoachCalls,0)
assert.equal(partialPage.read('keeper').legacyImported,false)
assert.equal(partialPage.read('keeper').legacyBackup.length,4)
assert.equal(partialPage.data.historySource,'legacy')
assert.equal(partialPage.data.message,'send after import')

const malformedBindingRuntime = miniRuntime({ modules: { 'utils/api': fakeBackend().api } })
malformedBindingRuntime.storage.set('stemistUser', { id: 'binding-owner' })
malformedBindingRuntime.storage.set('stemistTavern:binding-owner:0:selected', 'keeper')
malformedBindingRuntime.storage.set('stemistTavern:binding-owner:0:keeper', { schemaVersion: 2, owner: 'binding-owner', epoch: 0, persona: 'keeper', conversation: { id: 'conversation-study-buddy', persona: 'study-buddy', revision: 1, turnCount: 1 }, turns: [completeMessage(1, 'user', 'wrong role private'), completeMessage(2, 'assistant', 'wrong role answer')] })
const malformedBindingPage = malformedBindingRuntime.page('bundles/coach/tavern'); malformedBindingPage.onLoad()
assert.equal(malformedBindingPage.data.turns.length, 0, 'a cached conversation whose bound persona disagrees with the storage key fails closed')

// Two hundred cloud messages paginate by replacement, never by unbounded setData append.
const pagingBackend = fakeBackend({ messages: completedRounds(100), revision: 100 })
const pagingRuntime = miniRuntime({ modules: { 'utils/api': pagingBackend.api } })
pagingRuntime.storage.set('stemistUser', { id: 'paging-owner' }); pagingRuntime.storage.set('stemistSessionToken', 'fixture-token')
pagingRuntime.storage.set('stemistTavern:paging-owner:0:selected', 'keeper')
pagingRuntime.storage.set('stemistTavern:paging-owner:0:keeper', { owner: 'paging-owner', epoch: 0, persona: 'keeper', draft: '', turns: [] })
const pagingPage = pagingRuntime.page('bundles/coach/tavern'); pagingPage.onLoad(); await settle()
assert.equal(pagingPage.data.turns.length, 40)
assert.equal(pagingPage.data.turns[0].sequence, 161)
assert.equal(pagingPage.data.hasOlderHistory, true)
await pagingPage.loadOlderHistory()
assert.equal(pagingPage.data.turns.length, 40)
assert.equal(pagingPage.data.turns[0].sequence, 121, JSON.stringify({ error: pagingPage.data.error, status: pagingPage.data.status, requests: pagingBackend.requests.slice(-2) }))
assert.equal(pagingPage.data.historyBrowsing, true)
pagingPage.returnLatestHistory()
assert.equal(pagingPage.data.turns[0].sequence, 161)
assert.equal(pagingBackend.providerRequests.length, 0, 'history paging never calls the provider')

// A timeout keeps the same idempotency ID; editing the logical message gets a new one.
const timeout = Error('timeout'); timeout.code = 'network_timeout'
const retryBackend = fakeBackend({ coachPlan: [timeout, { answer: 'retry complete' }, { answer: 'changed complete' }] })
const retryRuntime = miniRuntime({ modules: { 'utils/api': retryBackend.api } })
retryRuntime.storage.set('stemistUser', { id: 'retry-owner' }); retryRuntime.storage.set('stemistSessionToken', 'fixture-token')
const retryPage = retryRuntime.page('bundles/coach/tavern'); retryPage.onLoad(); retryPage.choosePersona({ currentTarget: { dataset: { persona: 'keeper' } } }); await settle()
retryPage.onMessage({ detail: { value: 'same logical message' } }); await retryPage.submit()
assert.equal(retryPage.data.canRetry, true)
const firstTurnId = retryBackend.providerRequests[0].clientTurnId
await retryPage.retry()
assert.equal(retryBackend.providerRequests[1].clientTurnId, firstTurnId, 'timeout retry reuses the paid-call idempotency identity')
retryPage.onMessage({ detail: { value: 'changed logical message' } }); await retryPage.submit()
assert.notEqual(retryBackend.providerRequests[2].clientTurnId, firstTurnId, 'editing the message creates a new logical turn identity')

// A response-lost timeout may already be committed remotely; resume + replay returns it without duplication or a second billable completion.
let replayRevision=0,replayMessages=[],replayTurnId='',billableCompletions=0,replayCalls=[]
const replayRuntime=miniRuntime({ modules: { 'utils/api': { COACH_TEXT_TIMEOUT_MS:55_000,isAuthError:()=>false,requestJson:async(path,body)=>{
 replayCalls.push({path,body:body&&plain(body)})
 const record=()=>({id:'conversation-keeper',persona:'keeper',revision:replayRevision,turnCount:replayMessages.length/2}),envelope=()=>({conversation:record(),messages:plain(replayMessages),nextBefore:''})
 if(path==='/api/ai/tavern/conversations/resume')return envelope()
 if(path==='/api/ai/coach'&&!replayTurnId){replayTurnId=body.clientTurnId;billableCompletions++;replayRevision=1;replayMessages=[completeMessage(1,'user',body.message),completeMessage(2,'assistant','stored before timeout')];const error=Error('response lost');error.code='network_timeout';throw error}
 if(path==='/api/ai/coach'){assert.equal(body.clientTurnId,replayTurnId);return{mode:'ai',providerStatus:'connected',answer:'stored before timeout',clientTurnId:replayTurnId,conversation:record(),turns:plain(replayMessages),memory:{contextWindowTokens:1_000_000,estimatedInputUpperBoundTokens:100,countingMethod:'fixture',historyTruncated:false,usedHistoryMessages:0,retrievedSegments:0}}}
 throw Error(`unexpected replay request ${path}`)
} } } })
replayRuntime.storage.set('stemistUser',{id:'replay-owner'});replayRuntime.storage.set('stemistSessionToken','fixture-token')
const replayPage=replayRuntime.page('bundles/coach/tavern');replayPage.onLoad();replayPage.choosePersona({currentTarget:{dataset:{persona:'keeper'}}});await settle();replayPage.onMessage({detail:{value:'commit once'}});await replayPage.submit()
assert.equal(replayPage.data.canRetry,true)
await replayPage.resumeConversation(false)
assert.equal(replayPage.data.turns.length,2)
await replayPage.retry()
assert.equal(billableCompletions,1)
assert.equal(replayPage.data.turns.length,2,'canonical replay cannot append the already-restored turn twice')
assert.equal(replayPage.data.status,'AI 已回应')
assert.equal(replayRuntime.storage.get(replayPage.key()).draft,'')

// A revision conflict refreshes state but preserves the logical clientTurnId for explicit retry.
const revisionConflict = Error('revision conflict'); revisionConflict.code = 'coach_tavern_revision_conflict'; revisionConflict.statusCode = 409
const conflictBackend = fakeBackend({ revision: 4, coachPlan: [revisionConflict, { answer: 'after refresh' }] })
const conflictRuntime = miniRuntime({ modules: { 'utils/api': conflictBackend.api } })
conflictRuntime.storage.set('stemistUser', { id: 'conflict-owner' }); conflictRuntime.storage.set('stemistSessionToken', 'fixture-token')
const conflictPage = conflictRuntime.page('bundles/coach/tavern'); conflictPage.onLoad(); conflictPage.choosePersona({ currentTarget: { dataset: { persona: 'keeper' } } }); await settle()
conflictPage.onMessage({ detail: { value: 'do not rebill as a new turn' } }); await conflictPage.submit()
const conflictTurnId = conflictBackend.providerRequests[0].clientTurnId
assert.equal(conflictPage.data.canRetry, true)
await conflictPage.retry()
assert.equal(conflictBackend.providerRequests[1].clientTurnId, conflictTurnId)
assert.equal(conflictBackend.providerRequests[1].expectedRevision, conflictBackend.revision() - 1)

const lateSession=deferred(),lateTokenApi={COACH_TEXT_TIMEOUT_MS:55_000,isAuthError:error=>error?.statusCode===401,requestJson:async path=>{if(path==='/api/ai/tavern/conversations/resume')return{conversation:{id:'conversation-late-token',persona:'keeper',revision:0,turnCount:0},messages:[],nextBefore:''};if(path==='/api/ai/coach')return lateSession.promise;throw Error(`unexpected late token ${path}`)}}
const lateTokenRuntime=miniRuntime({modules:{'utils/api':lateTokenApi}});lateTokenRuntime.storage.set('stemistUser',{id:'late-token-owner'});lateTokenRuntime.storage.set('stemistSessionToken','old-synthetic-token')
const lateTokenPage=lateTokenRuntime.page('bundles/coach/tavern');lateTokenPage.onLoad();lateTokenPage.choosePersona({currentTarget:{dataset:{persona:'keeper'}}});await settle();lateTokenPage.onMessage({detail:{value:'pending old session'}});const oldSessionRequest=lateTokenPage.submit();await settle();lateTokenRuntime.storage.set('stemistSessionToken','new-synthetic-token');lateSession.reject(Object.assign(Error('old token expired'),{statusCode:401,code:'auth_required'}));await oldSessionRequest
assert.equal(lateTokenPage.data.authRequired,false,'late 401 from an old same-owner token cannot invalidate the newer session')
assert.doesNotMatch(lateTokenPage.data.error,/登录|auth/i)
assert.equal(lateTokenPage.data.message,'pending old session')

// Remote clear is truthful: failure keeps content and a retry tombstone; success alone confirms deletion.
const clearBackend = fakeBackend({ messages: completedRounds(2), revision: 2, failDelete: 1 })
const clearRuntime = miniRuntime({ modules: { 'utils/api': clearBackend.api } })
clearRuntime.storage.set('stemistUser', { id: 'clear-owner' }); clearRuntime.storage.set('stemistSessionToken', 'fixture-token')
clearRuntime.storage.set('stemistTavern:clear-owner:0:selected', 'keeper')
clearRuntime.storage.set('stemistTavern:clear-owner:0:keeper', { owner: 'clear-owner', epoch: 0, persona: 'keeper', draft: '', turns: [] })
const clearPage = clearRuntime.page('bundles/coach/tavern'); clearPage.onLoad(); await settle()
await clearPage.clear()
assert.equal(clearPage.data.turns.length, 4)
assert.equal(clearPage.data.clearPending, true)
assert.doesNotMatch(clearPage.data.status, /已清空/)
await clearPage.clear()
assert.equal(clearBackend.deleted(), true)
assert.equal(clearPage.data.turns.length, 0)
assert.equal(clearPage.data.clearPending, false)
assert.equal(clearPage.data.status, '已清空当前角色对话')

const staleBacking=new Map();let staleCloudDeleted=false
const staleCloud=[completeMessage(1,'user','private stale cache'),completeMessage(2,'assistant','private stale answer')]
const staleWx={getStorageSync:key=>staleBacking.has(key)?staleBacking.get(key):'',setStorageSync:(key,value)=>{if(staleCloudDeleted&&key.endsWith(':keeper')&&value?.schemaVersion===2&&!value.conversation&&value.turns?.length===0)throw Error('synthetic quota write failure');staleBacking.set(key,value)},removeStorageSync:key=>staleBacking.delete(key),getStorageInfoSync:()=>({keys:[...staleBacking.keys()]})}
const staleApi={isAuthError:()=>false,requestJson:async(path,body,options={})=>{if(path==='/api/ai/tavern/conversations/resume'){if(staleCloudDeleted)throw Object.assign(Error('offline after delete'),{code:'network_error'});return{conversation:{id:'conversation-stale-clear',persona:'keeper',revision:1,turnCount:1},messages:staleCloud,nextBefore:''}}if(options.method==='DELETE'){staleCloudDeleted=true;return{deleted:true,conversationId:'conversation-stale-clear'}}throw Error(`unexpected stale clear ${path}`)}}
staleBacking.set('stemistUser',{id:'stale-clear-owner'});staleBacking.set('stemistSessionToken','fixture-token');staleBacking.set('stemistPrivacyEpoch',0);staleBacking.set('stemistTavern:stale-clear-owner:0:selected','keeper');staleBacking.set('stemistTavern:stale-clear-owner:0:keeper',{schemaVersion:2,owner:'stale-clear-owner',epoch:0,persona:'keeper',turns:[],historySource:'cloud'})
const staleRuntime=miniRuntime({wx:staleWx,modules:{'utils/api':staleApi}}),stalePage=staleRuntime.page('bundles/coach/tavern');stalePage.onLoad();await settle();assert.equal(stalePage.data.turns.length,2);await stalePage.clear();assert.equal(stalePage.data.turns.length,0)
const staleReopened=staleRuntime.page('bundles/coach/tavern');staleReopened.onLoad();await settle();assert.equal(staleReopened.data.turns.length,0,'confirmed remote clear cannot redisplay stale local cache when fresh-state persistence fails')

const totalFailureBacking=new Map();let totalFailureDeleted=false
const totalFailureWx={getStorageSync:key=>totalFailureBacking.has(key)?totalFailureBacking.get(key):'',setStorageSync:(key,value)=>{if(totalFailureDeleted&&String(key).startsWith('stemistTavern:'))throw Error('all tombstone writes fail');totalFailureBacking.set(key,value)},removeStorageSync:key=>{if(totalFailureDeleted&&String(key).includes(':keeper'))throw Error('old cache removal fails');totalFailureBacking.delete(key)},getStorageInfoSync:()=>({keys:[...totalFailureBacking.keys()]})}
const totalFailureApi={isAuthError:()=>false,requestJson:async(path,body,options={})=>{if(path==='/api/ai/tavern/conversations/resume')return{conversation:{id:'conversation-total-failure',persona:'keeper',revision:1,turnCount:1},messages:staleCloud,nextBefore:''};if(options.method==='DELETE'){totalFailureDeleted=true;return{deleted:true,conversationId:'conversation-total-failure'}}throw Error(`unexpected total failure ${path}`)}}
totalFailureBacking.set('stemistUser',{id:'total-failure-owner'});totalFailureBacking.set('stemistSessionToken','fixture-token');totalFailureBacking.set('stemistTavern:total-failure-owner:0:selected','keeper');totalFailureBacking.set('stemistTavern:total-failure-owner:0:keeper',{schemaVersion:2,owner:'total-failure-owner',epoch:0,persona:'keeper',conversation:{id:'conversation-total-failure',persona:'keeper',revision:1,turnCount:1},turns:staleCloud,historySource:'cloud'})
const totalFailureRuntime=miniRuntime({wx:totalFailureWx,modules:{'utils/api':totalFailureApi}}),totalFailurePage=totalFailureRuntime.page('bundles/coach/tavern');totalFailurePage.onLoad();await totalFailurePage.clear();assert.equal(totalFailurePage.data.turns.length,0);assert.equal(totalFailurePage.data.status,'云端对话已清除');assert.match(totalFailurePage.data.warning,/本机|缓存|持久/)
const totalFailureReopen=totalFailureRuntime.page('bundles/coach/tavern');totalFailureReopen.onLoad();await settle();assert.equal(totalFailureReopen.data.turns.length,0,'same-process in-memory fence remains fail closed when every persistent fence operation fails')

const signedOutClearBackend = fakeBackend({ messages: completedRounds(1), revision: 1 })
const signedOutClearRuntime = miniRuntime({ modules: { 'utils/api': signedOutClearBackend.api } })
signedOutClearRuntime.storage.set('stemistUser', { id: 'signed-out-owner' })
signedOutClearRuntime.storage.set('stemistTavern:signed-out-owner:0:selected', 'keeper')
signedOutClearRuntime.storage.set('stemistTavern:signed-out-owner:0:keeper', { owner: 'signed-out-owner', epoch: 0, persona: 'keeper', draft: '', turns: legacyRounds(1) })
const signedOutClearPage = signedOutClearRuntime.page('bundles/coach/tavern'); signedOutClearPage.onLoad(); await signedOutClearPage.clear()
assert.equal(signedOutClearPage.data.turns.length, 2, 'an account-owned local page is not hidden when remote deletion cannot be authenticated')
assert.equal(signedOutClearPage.data.clearPending, true)
assert.doesNotMatch(signedOutClearPage.data.status, /已清空/)
assert.equal(signedOutClearBackend.requests.some(item => item.options.method === 'DELETE'), false)

const clearAuthEnvelope={conversation:{id:'conversation-clear-auth',persona:'keeper',revision:2,turnCount:1},messages:[completeMessage(1,'user','private clear user'),completeMessage(2,'assistant','private clear assistant')],nextBefore:''}
const clearAuthBase=miniRuntime().load('bundles/coach/tavernConversation');let clearAuthRuntime,expireClearAuth=true
clearAuthRuntime=miniRuntime({wx:{request:()=>{throw Error('network forbidden in clear auth race')}},modules:{'bundles/coach/tavernConversation':{...clearAuthBase,resumeTavernConversation:async()=>clearAuthEnvelope,deleteTavernConversation:async()=>{if(expireClearAuth){clearAuthRuntime.storage.delete('stemistUser');clearAuthRuntime.storage.delete('stemistSessionToken');throw Object.assign(Error('synthetic expired auth'),{statusCode:401,code:'coach_auth_required'})}return{deleted:true,conversationId:'conversation-clear-auth'}}}}})
clearAuthRuntime.storage.set('stemistUser',{id:'clear-auth-owner'});clearAuthRuntime.storage.set('stemistSessionToken','fixture-session');clearAuthRuntime.storage.set('stemistTavern:clear-auth-owner:0:selected','keeper')
const clearAuthPage=clearAuthRuntime.page('bundles/coach/tavern');clearAuthPage.onLoad();await settle();await clearAuthPage.clear()
assert.equal(clearAuthPage.data.loading,false,'expired auth during DELETE cannot strand loading')
assert.equal(clearAuthPage.data.turns.length,0,'expired auth during DELETE immediately hides old-owner dialogue')
assert.equal(clearAuthPage.data.authRequired,true)
assert.equal(clearAuthPage.data.clearPending,true)
assert.equal(clearAuthRuntime.storage.get('stemistTavern:clear-auth-owner:0:keeper').clearPending,true,'unconfirmed remote clear stays with the old owner')
assert.equal([...clearAuthRuntime.storage.keys()].some(key=>String(key).startsWith('stemistTavern:guest:')),false,'auth expiry never writes the old-owner tombstone into guest storage')
clearAuthPage.openAccount();clearAuthRuntime.storage.set('stemistUser',{id:'clear-auth-owner'});clearAuthRuntime.storage.set('stemistSessionToken','restored-session');expireClearAuth=false;clearAuthPage.onShow();await clearAuthPage.clear()
assert.equal(clearAuthPage.data.status,'已清空当前角色对话','same owner can retry the pending remote clear after authentication')

let switchRuntime
switchRuntime=miniRuntime({wx:{request:()=>{throw Error('network forbidden in owner switch race')}},modules:{'bundles/coach/tavernConversation':{...clearAuthBase,resumeTavernConversation:async()=>clearAuthEnvelope,deleteTavernConversation:async()=>{switchRuntime.storage.set('stemistUser',{id:'different-owner'});throw Object.assign(Error('synthetic owner changed'),{statusCode:409,code:'account_changed'})}}}})
switchRuntime.storage.set('stemistUser',{id:'switch-clear-owner'});switchRuntime.storage.set('stemistSessionToken','fixture-session');switchRuntime.storage.set('stemistTavern:switch-clear-owner:0:selected','keeper')
const switchPage=switchRuntime.page('bundles/coach/tavern');switchPage.onLoad();await settle();await switchPage.clear()
assert.equal(switchPage.data.loading,false)
assert.equal(switchPage.data.turns.length,0,'owner switch during DELETE hides the previous owner dialogue')
assert.equal(switchPage.data.authRequired,false)
assert.match(switchPage.data.error,/账号状态/)
assert.equal([...switchRuntime.storage.keys()].some(key=>String(key).startsWith('stemistTavern:different-owner:')),false,'owner switch never copies the pending clear into the new owner namespace')

let autoResumeRuntime
autoResumeRuntime=miniRuntime({wx:{request:()=>{throw Error('network forbidden in autoresume auth race')}},modules:{'bundles/coach/tavernConversation':{...clearAuthBase,resumeTavernConversation:async()=>{autoResumeRuntime.storage.delete('stemistUser');autoResumeRuntime.storage.delete('stemistSessionToken');throw Object.assign(Error('synthetic autoresume auth expiry'),{statusCode:401,code:'coach_auth_required'})}}}})
autoResumeRuntime.storage.set('stemistUser',{id:'autoresume-owner'});autoResumeRuntime.storage.set('stemistSessionToken','fixture-session');autoResumeRuntime.storage.set('stemistTavern:autoresume-owner:0:selected','keeper');autoResumeRuntime.storage.set('stemistTavern:autoresume-owner:0:keeper',{owner:'autoresume-owner',epoch:0,persona:'keeper',draft:'private autoresume draft',turns:legacyRounds(1)})
const autoResumePage=autoResumeRuntime.page('bundles/coach/tavern');autoResumePage.onLoad();await settle();await settle()
assert.equal(autoResumePage.data.loading,false)
assert.equal(autoResumePage.data.turns.length,0,'401 during background resume hides the old-owner cached page')
assert.equal(autoResumePage.data.message,'')
assert.equal(autoResumePage.data.authRequired,true)
assert.equal([...autoResumeRuntime.storage.keys()].some(key=>String(key).startsWith('stemistTavern:guest:')),false)

let olderAuthRuntime
olderAuthRuntime=miniRuntime({wx:{request:()=>{throw Error('network forbidden in older-page auth race')}},modules:{'bundles/coach/tavernConversation':{...clearAuthBase,fetchTavernMessages:async()=>{olderAuthRuntime.storage.delete('stemistUser');olderAuthRuntime.storage.delete('stemistSessionToken');throw Object.assign(Error('synthetic older-page auth expiry'),{statusCode:401,code:'coach_auth_required'})}}}})
olderAuthRuntime.storage.set('stemistUser',{id:'older-auth-owner'});olderAuthRuntime.storage.set('stemistTavern:older-auth-owner:0:selected','keeper');olderAuthRuntime.storage.set('stemistTavern:older-auth-owner:0:keeper',{schemaVersion:2,owner:'older-auth-owner',epoch:0,persona:'keeper',draft:'',turns:clearAuthEnvelope.messages,nextBefore:'before:1',historySource:'cloud',conversation:clearAuthEnvelope.conversation})
const olderAuthPage=olderAuthRuntime.page('bundles/coach/tavern');olderAuthPage.onLoad();await olderAuthPage.loadOlderHistory()
assert.equal(olderAuthPage.data.historyLoading,false)
assert.equal(olderAuthPage.data.turns.length,0,'401 during pagination hides the old-owner page')
assert.equal(olderAuthPage.data.authRequired,true)

const divinationBase=miniRuntime().load('bundles/coach/tavernDivination');let interpretAuthRuntime
interpretAuthRuntime=miniRuntime({wx:{request:()=>{throw Error('network forbidden in interpretation auth race')}},modules:{'bundles/coach/tavernConversation':clearAuthBase,'bundles/coach/tavernDivination':{...divinationBase,interpretTavernDraw:async()=>{interpretAuthRuntime.storage.delete('stemistUser');interpretAuthRuntime.storage.delete('stemistSessionToken');throw Object.assign(Error('synthetic interpretation auth expiry'),{statusCode:401,code:'coach_auth_required'})}}}})
interpretAuthRuntime.storage.set('stemistUser',{id:'interpret-auth-owner'})
const interpretAuthPage=interpretAuthRuntime.page('bundles/coach/tavern');interpretAuthPage.onLoad();interpretAuthPage.choosePersona({currentTarget:{dataset:{persona:'eastern-oracle'}}});const interpretState=interpretAuthPage.read('eastern-oracle');interpretState.conversation={id:'conversation-interpret-auth',persona:'eastern-oracle',revision:1,turnCount:1};interpretState.turns=[completeMessage(1,'user','private fortune user'),completeMessage(2,'assistant','private fortune assistant')];interpretState.historySource='cloud';interpretAuthPage.setData({draw:{id:'draw-interpret-auth'},question:'private fortune question',turns:interpretState.turns});await interpretAuthPage.retryInterpretation()
assert.equal(interpretAuthPage.data.loading,false)
assert.equal(interpretAuthPage.data.interpretLoading,false)
assert.equal(interpretAuthPage.data.turns.length,0,'401 during interpretation hides old-owner dialogue')
assert.equal(interpretAuthPage.data.question,'')
assert.equal(interpretAuthPage.data.draw,null)
assert.equal(interpretAuthPage.data.authRequired,true)

// Explicit logout only isolates local identity; it never deletes the account-owned cloud conversation.
const logoutBackend = fakeBackend({ messages: completedRounds(3), revision: 3 })
const logoutRuntime = miniRuntime({ modules: { 'utils/api': logoutBackend.api } })
logoutRuntime.storage.set('stemistUser', { id: 'logout-owner' }); logoutRuntime.storage.set('stemistSessionToken', 'fixture-token')
logoutRuntime.storage.set('stemistTavern:logout-owner:0:selected', 'keeper')
logoutRuntime.storage.set('stemistTavern:logout-owner:0:keeper', { owner: 'logout-owner', epoch: 0, persona: 'keeper', draft: '', turns: [] })
const logoutPage = logoutRuntime.page('bundles/coach/tavern'); logoutPage.onLoad(); await settle()
assert.equal(logoutPage.data.turns.length, 6)
logoutRuntime.load('utils/session').clearLocalSession(); logoutPage.onShow()
assert.equal(logoutPage.data.turns.length, 0)
assert.equal(logoutBackend.requests.some(item => item.options.method === 'DELETE'), false, 'logout must not delete remote long-term memory')
logoutRuntime.storage.set('stemistUser', { id: 'logout-owner' }); logoutRuntime.storage.set('stemistSessionToken', 'restored-token')
const restoredLogoutPage = logoutRuntime.page('bundles/coach/tavern'); restoredLogoutPage.onLoad(); restoredLogoutPage.choosePersona({ currentTarget: { dataset: { persona: 'keeper' } } }); await settle()
assert.equal(restoredLogoutPage.data.turns.length, 6, 'the same owner can resume account-owned cloud history after login')

// A completed response older than a newly resumed page cannot overwrite or duplicate it.
const late = deferred()
const raceBackend = fakeBackend({ messages: completedRounds(2), revision: 2, coachPlan: [() => late.promise] })
const raceRuntime = miniRuntime({ modules: { 'utils/api': raceBackend.api } })
raceRuntime.storage.set('stemistUser', { id: 'race-owner' }); raceRuntime.storage.set('stemistSessionToken', 'fixture-token')
const racePage = raceRuntime.page('bundles/coach/tavern'); racePage.onLoad(); racePage.choosePersona({ currentTarget: { dataset: { persona: 'keeper' } } }); await settle()
racePage.onMessage({ detail: { value: 'late turn' } }); const pending = racePage.submit(); await settle()
racePage.loadPersona('keeper', { chosen: true, open: false }); await settle()
late.resolve({ mode: 'ai', providerStatus: 'connected', answer: 'late old reply', clientTurnId: raceBackend.providerRequests[0].clientTurnId, conversation: { id: 'conversation-keeper', persona: 'keeper', revision: 3, turnCount: 3 }, turns: [completeMessage(5, 'user', 'late turn'), completeMessage(6, 'assistant', 'late old reply')], memory: { contextWindowTokens: 1_000_000, estimatedInputUpperBoundTokens: 100, countingMethod: 'utf8-upper-bound', historyTruncated: false, usedHistoryMessages: 4, retrievedSegments: 0 } })
await pending
assert.equal(racePage.data.turns.some(item => item.content === 'late old reply'), false, 'an obsolete completion cannot overwrite a newer resume generation')

console.log('Tavern page long memory: migration, 200-message paging, idempotent retries, truthful remote clear and stale-race guards passed.')
