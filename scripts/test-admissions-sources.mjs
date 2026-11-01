import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'

const source={id:'S1-0123456789ab',title:'Mechanical Engineering',url:'https://www.imperial.ac.uk/study/courses/undergraduate/mechanical-engineering/',retrievedAt:'2026-11-02T01:00:00Z',excerpt:'A* A A including Mathematics and Physics.',applicableYears:['2027'],verification:{kind:'course-requirements',requestedYear:'2027',yearMatched:true}}
const r=miniRuntime(),mod=r.load('bundles/coach/admissionsSources')
assert.equal(mod.normalizeSources([source])[0].excerpt,source.excerpt)
assert.match(mod.normalizeSources([source])[0].yearLabel,/2027/)
assert.equal(mod.normalizeSources([{...source,url:'http://127.0.0.1/'}]).length,0)
assert.equal(mod.normalizeSources([{...source,url:'https://site.test/?token=abc'}]).length,0)
assert.equal(mod.normalizeSources([{...source,id:'../../secret'}]).length,0)
assert.equal(mod.normalizeSources(Array(8).fill(source)).length,1)
assert.ok(mod.normalizeSources([{...source,excerpt:'x'.repeat(5000)}])[0].excerpt.length<=900)
const user={id:'turn-test:user',role:'user',content:'申请要求',sequence:1,status:'complete'}
const assistant={id:'turn-test:assistant',role:'assistant',content:'已核对官网。',sequence:2,status:'complete',research:{sources:[source]}}
const envelope={conversation:{id:'conversation-test',persona:'admissions-advisor',revision:1,turnCount:1},messages:[user,assistant],nextBefore:''}
const normalized=mod.normalizeAdvisorEnvelope(envelope,'admissions-advisor')
assert.equal(normalized.messages[1].sources[0].id,source.id)
assert.equal(mod.normalizeAdvisorEnvelope({...envelope,conversation:{...envelope.conversation,persona:'ielts-teacher'}},'ielts-teacher').messages[1].sources,undefined)
assert.equal(mod.mergeAdvisorMessages(normalized.messages,[{...assistant,research:undefined}])[1].sources[0].id,source.id,'immutable source cards survive unrelated turns and canonical merge')
assert.match(mod.mergeAdvisorMessages(normalized.messages)[1].sources[0].yearLabel,/2027/,'repeated normalization preserves verified year context')
assert.equal(mod.mergeAdvisorMessages(normalized.messages)[1].sourceConversationId,'conversation-test')

let pending=deferred(),requests=[],written=[],removed=[],previews=[]
const runtime=miniRuntime({wx:{env:{USER_DATA_PATH:'/sandbox'},getFileSystemManager:()=>({writeFile:o=>{written.push(o.filePath);o.success()},unlink:o=>{removed.push(o.filePath);o.success?.()}}),previewImage:o=>previews.push(o)},modules:{'utils/api':{requestJson:async(...args)=>{requests.push(args);return pending.promise}}}})
runtime.storage.set('stemistUser',{id:'test-owner'})
const def=runtime.load('bundles/coach/source-preview/index'),component={...def,...def.methods,data:{...def.data,sources:[source],conversationId:'conversation-test',turnId:'turn-test:assistant',autoPreview:false},setData(patch){Object.assign(this.data,patch)}}
def.lifetimes.attached.call(component)
component.refreshSources()
assert.equal(component.data.cards.length,1)
const fetching=component.fetchPreview({currentTarget:{dataset:{id:source.id}}});await settle()
assert.equal(requests[0][0],'/api/ai/admissions/source-preview')
assert.deepEqual(Object.keys(requests[0][1]).sort(),['conversationId','sourceId','turnId'])
assert.doesNotMatch(JSON.stringify(requests),/https:|quota|download|private/)
pending.resolve({preview:{kind:'static-webpage-screenshot',mimeType:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',width:800,height:600,sourceUrl:source.url,capturedAt:'2026-11-02T01:01:00Z'}})
await fetching
assert.equal(component.data.cards[0].previewKind,'static-webpage-screenshot')
assert.match(component.data.cards[0].previewLabel,/静态网页截图/)
assert.equal(written.length,1)
component.zoom({currentTarget:{dataset:{id:source.id}}})
assert.equal(previews.length,1)
assert.equal(previews[0].urls[0],written[0])

pending=deferred();component.data.cards[0].imagePath=''
const stale=component.fetchPreview({currentTarget:{dataset:{id:source.id}}});await settle()
runtime.storage.set('stemistUser',{id:'other-owner'})
pending.resolve({preview:{kind:'static-webpage-screenshot',mimeType:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',width:800,height:600,sourceUrl:source.url,capturedAt:'2026-11-02T01:01:00Z'}})
await stale
assert.equal(written.length,1,'no source image write after account change')
def.lifetimes.detached.call(component)
assert.ok(removed.includes(written[0]),'only generated temporary preview images are removed')
console.log('PASS admissions source cards: per-answer provenance, native preview, lazy authenticated fetch, quota isolation and account/lifecycle fencing')
