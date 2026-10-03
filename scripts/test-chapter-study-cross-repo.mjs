import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {Readable} from 'node:stream'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const index=process.argv.indexOf('--backend')
if(index<0||!process.argv[index+1])throw Error('Supply --backend with the reviewed STEM backend worktree.')
const backend=path.resolve(process.argv[index+1]),stem=await import(pathToFileURL(path.join(backend,'server/stemApi.js')).href),foundation=await import(pathToFileURL(path.join(backend,'server/originalFoundationPractice.js')).href),bank=await import(pathToFileURL(path.join(backend,'src/data/questionBank.js')).href)
const signingKey='mini-cross-repo-chapter-study-signing-key'
function token(userId){
 const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),now=Math.floor(Date.now()/1000)
 const payload=Buffer.from(JSON.stringify({iss:'ieltsist.com',aud:'stem.ieltsist.com',sub:`ielts:${userId}`,username:`mini-${userId}`,iat:now,exp:now+300})).toString('base64url')
 return`${header}.${payload}.${crypto.createHmac('sha256',signingKey).update(`${header}.${payload}`).digest('base64url')}`
}
function call(api,{method,url,body,bearer=''}){return new Promise((resolve,reject)=>{
 const request=Readable.from(body?[Buffer.from(JSON.stringify(body),'utf8')]:[]);request.method=method;request.url=url;request.headers={...(body?{'content-type':'application/json'}:{}),...(bearer?{authorization:`Bearer ${bearer}`}:{})}
 const response={statusCode:200,headers:{},setHeader(name,value){this.headers[String(name).toLowerCase()]=value},end(raw=''){const text=String(raw||'');resolve({statusCode:this.statusCode,payload:text?JSON.parse(text):null})}}
 Promise.resolve(api(request,response,()=>reject(Error(`Unhandled ${method} ${url}`)))).catch(reject)
})}

const routeId='cie-9702-as-physics',catalogGroups=foundation.originalFoundationQuestionGroupsForRoute(routeId),officialTopicId=catalogGroups[0].originalQuestion.topicId,gapTopicId=catalogGroups[1].originalQuestion.topicId
const record=bank.studyQuestionBank.find(item=>item.routeId===routeId&&bank.isHumanReviewedPastPaperItem(item));assert.ok(record)
const fixture=[{...record,knowledgeGroupId:officialTopicId,syllabusMapping:{...(record.syllabusMapping||{}),primaryTopicId:officialTopicId,secondaryTopicIds:[],topicIds:[officialTopicId],reviewStatus:'reviewed',reviewedBy:'mini-cross-repo',reviewedAt:'2026-10-04T00:00:00.000Z'}}]
const bearer=token(101),api=stem.createStemApi({env:{NODE_ENV:'test',STEM_DB_PATH:':memory:',STEM_IDENTITY_SIGNING_KEY:signingKey},questionBank:fixture}),requests=[]
try{
 const inventoryResponse=await call(api,{method:'GET',url:`/api/stem/routes/${routeId}/syllabus-topics`})
 assert.equal(inventoryResponse.statusCode,200)
 const runtime=miniRuntime({modules:{'utils/api':{requestJson:async(url,body)=>{requests.push({url,body});const response=await call(api,{method:'POST',url,body,bearer});if(response.statusCode>=400)throw Object.assign(Error(response.payload?.error||'request failed'),{code:response.payload?.code,statusCode:response.statusCode});return response.payload}}}})
 runtime.storage.set('stemistUser',{id:'ielts:101'});runtime.storage.set('stemistSessionToken',bearer)
 const inventory=runtime.load('utils/inventory').normalizeInventory(inventoryResponse.payload,routeId),native=runtime.load('utils/nativePractice')
 const officialTopic=inventory.topics.find(item=>item.chapterStudy.officialAvailable>0);assert.ok(officialTopic);assert.equal(officialTopic.chapterStudy.available,officialTopic.chapterStudy.officialAvailable+officialTopic.chapterStudy.originalAvailable,'real inventory exposes the unique official + original union')
 const officialComponent=Number(record.sourceRef?.component||record.paperComponent),mixedState=native.selectionState(inventory,[officialTopicId],[officialComponent],2,'chapter-study');assert.equal(mixedState.canStart,true)
 const mixed=await native.generatePractice({routeId,stage:'AS',subjectCode:'9702',components:[officialComponent],syllabusTopicIds:[officialTopicId],questionCount:2,studyMode:'chapter-study',sourcePreference:'official-first'})
 assert.equal(mixed.sourceMix.official,1);assert.equal(mixed.sourceMix.originalFoundation,1);assert.equal(mixed.questions.filter(item=>item.original).length,1);assert.ok(mixed.questions.find(item=>!item.original).images.length,'non-original chapter questions retain full source images')
 const topicId=gapTopicId,component=inventory.paperComponents[0]
 assert.ok(inventory.chapterStudy.gapTopicIds.includes(topicId));const topic=inventory.topics.find(item=>item.id===topicId)
 assert.equal(topic.chapterStudy.available,topic.chapterStudy.officialAvailable+topic.chapterStudy.originalAvailable);assert.equal(topic.chapterStudy.fallbackKind,'original-foundation')
 const state=native.selectionState(inventory,[topicId],[component],1,'chapter-study');assert.equal(state.canStart,true);assert.deepEqual([...state.sizes],[1])
 const spec={routeId,stage:'AS',subjectCode:'9702',components:[component],syllabusTopicIds:[topicId],questionCount:1,studyMode:'chapter-study',sourcePreference:'official-first'}
 const session=await native.generatePractice(spec);assert.equal(session.questions.length,1);assert.equal(session.questions[0].original,true);assert.equal(session.questions[0].images.length,0)
 native.saveSession(session);const selectedOptionId=session.questions[0].choiceOptions[0].label;native.saveChoice(session.id,session.questions[0].id,selectedOptionId)
 const result=await native.markChoice(session.id,session.questions[0].id);assert.equal(result.scoreScope,'original-learning-only');assert.equal(result.formalProgressEligible,false)
 const attemptCall=requests.find(item=>item.url==='/api/stem/attempts');assert.ok(attemptCall);assert.equal(attemptCall.body.studyMode,attemptCall.body.attempt.studyMode);assert.equal(attemptCall.body.sourcePreference,attemptCall.body.attempt.sourcePreference);assert.equal(attemptCall.body.markingParts[0].provenance.sourceKind,undefined);assert.match(attemptCall.body.markingParts[0].provenance.bindingSignature,/^original:[a-f0-9]{64}$/)
 assert.ok(!requests.some(item=>/marking\/capabilities|mark-handwriting/.test(item.url)),'original questions never request official or AI marking authority')
 const history=await call(api,{method:'GET',url:'/api/stem/attempts',bearer});assert.equal(history.statusCode,200)
 const saved=history.payload.attempts.find(item=>item.attemptId===attemptCall.body.attemptId);assert.ok(saved);assert.equal(saved.binding.parts[0].sourceKind,'original-foundation');assert.equal(saved.attempt.studyMode,'chapter-study');assert.equal(saved.attempt.scoreResult.scoreScope,'original-learning-only')
 console.log(JSON.stringify({status:'pass',topicId,inventoryAvailable:topic.chapterStudy.available,questionId:session.questions[0].id,score:result.score,attemptId:saved.attemptId}))
}finally{stem.closeStemDatabaseForTests()}
