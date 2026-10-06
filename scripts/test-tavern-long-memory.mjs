import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'

const plain = value => JSON.parse(JSON.stringify(value))
const message = (sequence, role = sequence % 2 ? 'user' : 'assistant', content = `${role}-${sequence}`) => ({
  id: `message-${sequence}`,
  role,
  content,
  sequence,
  status: 'complete',
})
const conversation = (id = 'conversation-keeper', revision = 9, turnCount = 120) => ({ id, persona: 'keeper', revision, turnCount })
const envelope = ({ id, revision, messages = [], nextBefore = '' } = {}) => ({
  conversation: conversation(id, revision),
  messages,
  nextBefore,
})

const requests = []
const runtime = miniRuntime({ modules: { 'utils/api': {
  COACH_TEXT_TIMEOUT_MS: 55_000,
  requestJson: async (path, body, options = {}) => {
    requests.push({ path, body, options })
    if (path === '/api/ai/tavern/conversations/resume') return { ...envelope({ messages: [message(1), message(2)], nextBefore: 'cursor:older' }), ...(body.legacyImport ? { legacyImport: { importId: body.legacyImport.importId, confirmed: true, importedMessageCount: body.legacyImport.messages.length } } : {}) }
    if (path.startsWith('/api/ai/tavern/conversations/conversation-keeper/messages?')) return envelope({ messages: [message(3), message(4)], nextBefore: 'cursor:oldest' })
    if (path.startsWith('/api/ai/tavern/conversations/conversation-keeper?')) return { deleted: true, conversationId: 'conversation-keeper' }
    if (path === '/api/ai/coach') return {
      mode: 'ai', providerStatus: 'connected', answer: 'canonical reply', clientTurnId: body.clientTurnId,
      conversation: conversation('conversation-keeper', 10, 121),
      turns: [message(241, 'user', body.message), message(242, 'assistant', 'canonical reply')],
      memory: { contextWindowTokens: 1_000_000, estimatedInputUpperBoundTokens: 8100, countingMethod: 'utf8-upper-bound', historyTruncated: false, usedHistoryMessages: 240, retrievedSegments: 3 },
    }
    throw new Error(`Unexpected request ${path}`)
  },
} } })

const service = runtime.load('bundles/coach/tavernConversation')
for (const [code, statusCode, expected] of [
 ['tavern_turn_in_progress', 409, '上一条消息'],
 ['tavern_conversation_revision_conflict', 409, '其他设备'],
 ['tavern_storage_quota_exceeded', 413, '存储上限'],
 ['synthetic_unknown_failure', 400, '本次对话未完成'],
]) {
 const failing = miniRuntime({ modules: { 'utils/api': {
  requestJson: async () => { throw Object.assign(new Error('Internal conversation state rejected'), { code, statusCode }) },
 } } }).load('bundles/coach/tavernConversation')
 await assert.rejects(failing.resumeTavernConversation({ persona: 'keeper' }), error => {
  assert.equal(error.code, code)
  assert.equal(error.statusCode, statusCode)
  assert.ok(error.message.includes(expected), 'Student sees a localized recovery message, not an internal English failure')
  return true
 })
}
const {
  TAVERN_PAGE_LIMIT,
  TAVERN_MESSAGE_MAX_BYTES,
  TAVERN_PAGE_MAX_BYTES,
  TAVERN_LEGACY_IMPORT_MAX_BYTES,
  displayTavernMessages,
  legacyDisplayTavernMessages,
  legacyTavernMessages,
  legacyImportIdFor,
  newClientTurnId,
  normalizeTavernEnvelope,
  resumeTavernConversation,
  fetchTavernMessages,
  deleteTavernConversation,
  sendTavernTurn,
} = service

assert.equal(TAVERN_PAGE_LIMIT, 40)
assert.ok(TAVERN_MESSAGE_MAX_BYTES>0&&TAVERN_PAGE_MAX_BYTES>=TAVERN_MESSAGE_MAX_BYTES&&TAVERN_LEGACY_IMPORT_MAX_BYTES>=TAVERN_PAGE_MAX_BYTES)

const oldLocal = Array.from({ length: 20 }, (_, index) => [
  { role: 'user', content: `old-user-${index}-${'你'.repeat(1600)}` },
  { role: 'assistant', content: `old-assistant-${index}-${'答'.repeat(1600)}` },
]).flat()
const legacy = legacyTavernMessages(oldLocal)
assert.equal(legacy.length, 40, 'all existing 20 local rounds survive migration despite exceeding the former 24k character budget')
assert.match(legacy[0].content, /^old-user-0-/)
assert.match(legacy.at(-1).content, /^old-assistant-19-/)

const fiftyFiveRounds=Array.from({length:55},(_,index)=>[{role:'user',content:`many-user-${index}`},{role:'assistant',content:`many-assistant-${index}`}]).flat()
assert.equal(legacyTavernMessages(fiftyFiveRounds).length,110,'legacy preservation is independent from the 40-message phone page')
assert.equal(legacyDisplayTavernMessages(fiftyFiveRounds).length,40,'only the rendered local page is bounded to 40 messages')

const twoHundred = Array.from({ length: 220 }, (_, index) => message(index + 1))
assert.throws(()=>displayTavernMessages(twoHundred),/page|40|过大|消息/i,'an oversized canonical collection is rejected rather than silently cropped')
const visible=displayTavernMessages(twoHundred.slice(-40))
assert.equal(visible.length,40);assert.equal(visible[0].id,'message-181');assert.equal(visible.at(-1).id,'message-220')

const proxiedMessages = new Proxy([message(1), message(2)], {
  preventExtensions() { throw new Error('SDK proxy cannot be frozen') },
})
const proxiedPayload = new Proxy(envelope({ messages: proxiedMessages }), {
  preventExtensions() { throw new Error('SDK proxy cannot be frozen') },
})
assert.deepEqual(plain(normalizeTavernEnvelope(proxiedPayload, 'keeper').messages), [message(1), message(2)], 'SDK response proxies are copied into plain local objects without freezing provider-owned values')

assert.equal(newClientTurnId({ now: 1234, random: () => 0.25 }), 'turn:ya:m672jxbim7')
assert.equal(legacyImportIdFor('keeper', legacy), legacyImportIdFor('keeper', plain(legacy)), 'legacy import identity is stable even when local quota prevents persisting a random nonce')
assert.notEqual(legacyImportIdFor('keeper', legacy), legacyImportIdFor('study-buddy', legacy))

const imported = legacy.slice(0, 2)
const resumed = await resumeTavernConversation({ persona: 'keeper', attemptId: 'attempt-opaque', legacyImport: { importId: 'legacy:one', messages: imported } })
assert.equal(resumed.conversation.id, 'conversation-keeper')
assert.deepEqual(plain(resumed.legacyImport),{importId:'legacy:one',confirmed:true,importedMessageCount:2})
assert.deepEqual(plain(requests.at(-1).body), { persona: 'keeper', attemptId: 'attempt-opaque', legacyImport: { importId: 'legacy:one', messages: plain(imported) } })

const page = await fetchTavernMessages({ conversationId: 'conversation-keeper', persona: 'keeper', before: 'cursor:older', attemptId: 'attempt-opaque' })
assert.deepEqual(plain(page.messages.map(item => item.id)), ['message-3', 'message-4'])
assert.equal(requests.at(-1).options.method, 'GET')
assert.match(requests.at(-1).path, /limit=40/)
assert.match(requests.at(-1).path, /before=cursor%3Aolder/)

const completion = await sendTavernTurn({ persona: 'keeper', message: 'only the new message', conversationId: 'conversation-keeper', clientTurnId: 'turn:stable', expectedRevision: 9, attemptId: 'attempt-opaque' })
assert.equal(completion.conversation.revision, 10)
assert.equal(completion.turns.length, 2)
assert.equal(completion.memory.contextWindowTokens, 1_000_000)
const sent = requests.at(-1).body
assert.deepEqual(Object.keys(sent).sort(), ['attemptId', 'clientTurnId', 'conversationId', 'expectedRevision', 'feature', 'message', 'persona'].sort())
assert.equal(sent.history, undefined, 'stateful Tavern transport never re-sends visible history')
assert.equal(sent.context, undefined)
assert.equal(sent.imageDataUrls, undefined)

const deleted = await deleteTavernConversation({ conversationId: 'conversation-keeper', persona: 'keeper', attemptId: 'attempt-opaque' })
assert.deepEqual(plain(deleted), { deleted: true, conversationId: 'conversation-keeper' })
assert.equal(requests.at(-1).options.method, 'DELETE')
assert.match(requests.at(-1).path, /persona=keeper/)

const badAckRuntime=miniRuntime({modules:{'utils/api':{requestJson:async()=>({conversation:conversation('conversation-bad-ack',1,1),messages:[message(1),message(2)],nextBefore:'',legacyImport:{importId:'legacy:wrong',confirmed:true,importedMessageCount:1}})}}})
await assert.rejects(()=>badAckRuntime.load('bundles/coach/tavernConversation').resumeTavernConversation({persona:'keeper',legacyImport:{importId:'legacy:expected',messages:imported}}),error=>error?.code==='tavern_legacy_import_unconfirmed','mismatched transactional import acknowledgement fails before Coach can run')

const wire=[]
const transport=miniRuntime({wx:{request:options=>{
 wire.push(options)
 if(options.url.endsWith('/api/ai/tavern/conversations/resume'))return options.success({statusCode:200,data:envelope({id:'conversation-wire',revision:0,messages:[]})})
 if(options.url.endsWith('/api/ai/coach'))return options.success({statusCode:200,data:{mode:'ai',providerStatus:'connected',answer:'wire answer',clientTurnId:options.data.clientTurnId,conversation:{id:'conversation-wire',persona:'keeper',revision:1,turnCount:1},turns:[message(1,'user',options.data.message),message(2,'assistant','wire answer')],memory:{contextWindowTokens:1_000_000,estimatedInputUpperBoundTokens:100,countingMethod:'fixture',historyTruncated:false,usedHistoryMessages:0,retrievedSegments:0}}})
 throw Error(`unexpected actual transport ${options.url}`)
}}})
transport.storage.set('stemistUser',{id:'wire-owner'});transport.storage.set('stemistSessionToken','fixture-token')
const actualService=transport.load('bundles/coach/tavernConversation'),wireConversation=await actualService.resumeTavernConversation({persona:'keeper'})
await actualService.sendTavernTurn({persona:'keeper',message:'wire current only',conversationId:wireConversation.conversation.id,clientTurnId:'turn:wire:1',expectedRevision:wireConversation.conversation.revision})
assert.equal(wire.length,2)
assert.equal(wire[0].url,'https://stem.ieltsist.com/api/ai/tavern/conversations/resume')
assert.equal(wire[1].url,'https://stem.ieltsist.com/api/ai/coach')
assert.equal(wire[1].data.message,'wire current only')
assert.equal(wire[1].data.history,undefined)
assert.equal(wire[1].data.context,undefined)

for(const malformed of [
 {conversation:{id:'conversation-strict',persona:'keeper',revision:false,turnCount:1},messages:[]},
 {conversation:{id:'conversation-strict',persona:'keeper',revision:1,turnCount:'1'},messages:[]},
 {conversation:{id:'conversation-strict',persona:'keeper',revision:1,turnCount:1},messages:[{id:'strict-u',role:'user',content:'x',sequence:null,status:'complete'}]},
 {conversation:{id:'conversation-strict',persona:'keeper',revision:1,turnCount:1},messages:[{id:'strict-u',role:'user',content:'x',sequence:'1',status:'complete'}]},
])assert.throws(()=>normalizeTavernEnvelope({...malformed,nextBefore:''},'keeper'),/revision|turnCount|sequence|无效/i,'network canonical integers must reject coercible non-number values')

const hugePage=Array.from({length:40},(_,index)=>({id:`huge-${index}`,role:index%2?'assistant':'user',content:`sentinel-${index}-`+'界'.repeat(128*1024),sequence:index+1,status:'complete'}))
assert.throws(()=>normalizeTavernEnvelope({conversation:{id:'conversation-huge',persona:'keeper',revision:1,turnCount:20},messages:hugePage,nextBefore:''},'keeper'),/bytes|过大|page|消息/i,'bounded count cannot admit an unbounded UTF-8 page')
const hugeLegacy=Array.from({length:110},(_,index)=>({role:index%2?'assistant':'user',content:'界'.repeat(16*1024)}))
assert.throws(()=>legacyTavernMessages(hugeLegacy),/bytes|过大|旧对话/i,'legacy outbound payload is rejected before request construction')
const displayHeavyLegacy=Array.from({length:40},(_,index)=>({role:index%2?'assistant':'user',content:'界'.repeat(5*1024)}))
assert.throws(()=>legacyDisplayTavernMessages(displayHeavyLegacy),/bytes|过大|page|消息/i,'legacy display page obeys the same setData byte budget')
assert.equal(legacyTavernMessages(fiftyFiveRounds).length,110,'110 short legacy messages remain valid')

const canonicalResult=overrides=>({mode:'ai',providerStatus:'connected',answer:'canonical answer',clientTurnId:'turn:canonical',conversation:{id:'conversation-canonical',persona:'keeper',revision:2,turnCount:2},turns:[{id:'canonical-u',role:'user',content:'submitted request',sequence:3,status:'complete'},{id:'canonical-a',role:'assistant',content:'canonical answer',sequence:4,status:'complete'}],memory:{contextWindowTokens:1000,estimatedInputUpperBoundTokens:100,countingMethod:'fixture',historyTruncated:false,usedHistoryMessages:2,retrievedSegments:0},...overrides})
const rejectCanonical=async overrides=>{const testRuntime=miniRuntime({modules:{'utils/api':{COACH_TEXT_TIMEOUT_MS:55_000,requestJson:async()=>canonicalResult(overrides)}}});return assert.rejects(()=>testRuntime.load('bundles/coach/tavernConversation').sendTavernTurn({persona:'keeper',message:'submitted request',conversationId:'conversation-canonical',clientTurnId:'turn:canonical',expectedRevision:1}),/canonical|关联|不匹配|完整|状态/i)}
await rejectCanonical({turns:[{id:'canonical-u',role:'user',content:'different request',sequence:3,status:'complete'},{id:'canonical-a',role:'assistant',content:'canonical answer',sequence:4,status:'complete'}]})
await rejectCanonical({turns:[{id:'canonical-u',role:'user',content:'submitted request',sequence:3,status:'complete'},{id:'canonical-a',role:'assistant',content:'different answer',sequence:4,status:'complete'}]})
await rejectCanonical({turns:[{id:'canonical-u',role:'user',content:'submitted request',sequence:3,status:'pending'},{id:'canonical-a',role:'assistant',content:'canonical answer',sequence:4,status:'complete'}]})
await rejectCanonical({turns:[{id:'canonical-u',role:'user',content:'submitted request',sequence:3,status:'complete'},{id:'canonical-a',role:'assistant',content:'canonical answer',sequence:4,status:'failed'}]})
await rejectCanonical({turns:[{id:'canonical-u',role:'user',content:'submitted request',sequence:3,status:'complete'}]})
await rejectCanonical({turns:[{id:'canonical-u',role:'user',content:'submitted request',sequence:3,status:'complete'},{id:'canonical-a',role:'assistant',content:'canonical answer',sequence:4,status:'complete'},{id:'extra',role:'assistant',content:'extra',sequence:5,status:'complete'}]})

const strictMemoryRuntime=miniRuntime({modules:{'utils/api':{COACH_TEXT_TIMEOUT_MS:55_000,requestJson:async()=>canonicalResult({memory:{contextWindowTokens:'1000',estimatedInputUpperBoundTokens:100,countingMethod:'fixture',historyTruncated:false,usedHistoryMessages:2,retrievedSegments:0}})}}})
await assert.rejects(()=>strictMemoryRuntime.load('bundles/coach/tavernConversation').sendTavernTurn({persona:'keeper',message:'submitted request',conversationId:'conversation-canonical',clientTurnId:'turn:canonical',expectedRevision:1}),/contextWindowTokens|无效/i)

assert.equal(requests.find(item=>item.path==='/api/ai/coach').options.timeout,60_000,'Tavern transport leaves five seconds beyond the server maximum deadline')
console.log('Tavern conversation service: legacy preservation, Proxy-safe DTOs, bounded display pages and incremental transport contract passed.')
