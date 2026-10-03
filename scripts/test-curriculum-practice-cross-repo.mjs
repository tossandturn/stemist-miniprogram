import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {Readable} from 'node:stream'
import {DatabaseSync} from 'node:sqlite'
import {pathToFileURL} from 'node:url'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const arg=name=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:''}
const backend=path.resolve(arg('--backend')||''),workRoot=arg('--work-root')?path.resolve(arg('--work-root')):'',explicitPaths=[arg('--handoff'),arg('--source-assets'),arg('--source-asset-root')],explicit=explicitPaths.every(Boolean)
if(!arg('--backend')||!workRoot&&!explicit||explicitPaths.some(Boolean)&&!explicit)throw Error('Use --backend plus --work-root, or explicit --handoff --source-assets --source-asset-root paths.')
const handoffPath=explicit?path.resolve(explicitPaths[0]):path.join(workRoot,'reports','2026-10-04','apib-question-review-handoff-v2.json'),sourceAssetsPath=explicit?path.resolve(explicitPaths[1]):path.join(workRoot,'runtime-candidate','2026-10-04','source-assets.json'),sourceAssetRoot=explicit?path.resolve(explicitPaths[2]):path.join(workRoot,'runtime-candidate','2026-10-04','assets')
const scratchParent='D:\\CodexWork',scratch=await fs.mkdtemp(path.join(scratchParent,'stemist-ap-mcq-cross-'))
if(path.dirname(scratch)!==scratchParent)throw Error('Cross-repo scratch escaped D:\\CodexWork.')
const build=await import(pathToFileURL(path.join(backend,'scripts/build-apib-runtime-artifact.mjs')).href),validate=await import(pathToFileURL(path.join(backend,'scripts/validate-apib-runtime-release.mjs')).href),apiModule=await import(pathToFileURL(path.join(backend,'server/curriculumPracticeApi.js')).href)
const database=new DatabaseSync(':memory:')
let uuid=0
function call(api,{method='GET',url,body,user=''}){return new Promise((resolve,reject)=>{
 const request=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body),'utf8')]);request.method=method;request.url=url;request.headers={...(body===undefined?{}:{'content-type':'application/json'}),...(user?{authorization:`Bearer ${user}`}:{})}
 const response={statusCode:200,headers:{},setHeader(name,value){this.headers[String(name).toLowerCase()]=String(value)},end(raw=''){const text=Buffer.isBuffer(raw)?raw.toString('utf8'):String(raw||'');resolve({statusCode:this.statusCode,headers:this.headers,text,payload:text?JSON.parse(text):null})}}
 Promise.resolve(api.handle(request,response,new URL(url,'http://127.0.0.1'))).catch(reject)
})}

try{
 await build.buildApIbRuntimeCandidate({handoffPath,sourceAssetsPath,outputRoot:scratch,createdAt:'2026-10-04T00:00:00.000Z'})
 await validate.validateApIbRuntimeRelease({releaseRoot:scratch,sourceAssetRoot,write:true,validatedAt:'2026-10-04T00:01:00.000Z'})
 const api=apiModule.createCurriculumPracticeApi({releaseRoot:scratch,sourceAssetRoot,authenticateRequest:request=>String(request.headers.authorization||'')==='Bearer user-a'?{id:'user-a'}:String(request.headers.authorization||'')==='Bearer user-b'?{id:'user-b'}:null,databaseProvider:()=>database,now:(()=>{let n=0;return()=>`2026-10-04T00:${String(n++).padStart(2,'0')}:00.000Z`})(),randomUUID:()=>`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`}),requests=[]
 const invoke=async(method,url,body,options={})=>{const user=options.stemAuth===false?'':'user-a',response=await call(api,{method,url,body,user});requests.push({method,url,body,user,statusCode:response.statusCode,text:response.text});if(response.statusCode<200||response.statusCode>=300)throw Object.assign(Error(response.payload?.error?.message||'request failed'),{statusCode:response.statusCode,code:response.payload?.error?.code});return response.payload}
 const runtime=miniRuntime({modules:{'utils/api':{getJson:(url,options)=>invoke('GET',url,undefined,options),requestJson:(url,body,options)=>invoke(options?.method||'POST',url,body,options)},'utils/apiOrigin':{DEFAULT_API_BASE:'https://stem.ieltsist.com',safeApiBase:()=>''}}})
 runtime.storage.set('stemistUser',{id:'user-a'});runtime.storage.set('stemistSessionToken','user-a')
 const service=runtime.load('bundles/curricula/practiceService'),scope=service.scope(),catalog=await service.fetchCatalog()
 assert.deepEqual(Object.fromEntries(catalog.routes.map(route=>[route.id,route.questionCount])),{'ap-physics-1-mcq-study':40,'ap-physics-c-em-mcq-study':105});assert.ok(catalog.routes.every(route=>route.authority==='ai-provisional'&&route.formalProgressEligible===false))
 const release=api.loadRelease(),single=release.publicCatalog.questions.find(question=>question.answerMode==='single'),multiple=release.publicCatalog.questions.find(question=>question.answerMode==='multiple');assert.ok(single&&multiple)
 const question=await service.fetchQuestion(single.id);assert.equal(question.id,single.id);assert.ok(question.source.regions.length);assert.ok(question.source.regions.every(region=>region.imageUrl.startsWith('https://stem.ieltsist.com/api/stem/curriculum-practice/source/')))
 assert.doesNotMatch(JSON.stringify(question),/correctOptions|answerHash|markScheme|bindingHash|gatewayEnvelope|qwenEnvelope/)
 const session=await service.createSession({routeId:single.routeId,questionIds:[single.id]},scope),draft=service.createDraft(session,scope,{routeLabel:'AP MCQ',topicLabel:''});draft.answers[single.id]=[question.options[0]];service.saveDraft(draft,scope)
 const submissionId='submission-cross-repo-0001',submitted=await service.submitSession(session.id,{submissionId,answers:[{questionId:single.id,selectedOptions:[question.options[0]]}],routeId:single.routeId,questionIds:[single.id]},scope)
 assert.equal(submitted.session.status,'submitted');assert.equal(submitted.session.result.maxScore,1);assert.equal(submitted.session.result.items[0].questionId,single.id);assert.equal(submitted.session.result.items[0].unanswered,false);assert.equal(submitted.duplicate,false)
 const duplicate=await service.submitSession(session.id,{submissionId,answers:[{questionId:single.id,selectedOptions:[question.options[0]]}],routeId:single.routeId,questionIds:[single.id]},scope);assert.equal(duplicate.duplicate,true)
 const restored=await service.getSession(session.id,scope),history=await service.fetchHistory(scope);assert.equal(restored.result.maxScore,1);assert.ok(history.some(item=>item.id===session.id));assert.doesNotMatch(JSON.stringify({restored,history}),/correctOptions|answerHash|markScheme|bindingHash/)
 const crossOwner=await call(api,{url:`/api/stem/curriculum-practice/sessions/${session.id}`,user:'user-b'});assert.equal(crossOwner.statusCode,404);assert.equal(crossOwner.payload.error.code,'curriculum_practice_session_not_found')
 const multiQuestion=await service.fetchQuestion(multiple.id),multiSession=await service.createSession({routeId:multiple.routeId,questionIds:[multiple.id]},scope),multiResult=await service.submitSession(multiSession.id,{submissionId:'submission-cross-multi-1',answers:[{questionId:multiple.id,selectedOptions:[multiQuestion.options[0]]}],routeId:multiple.routeId,questionIds:[multiple.id]},scope)
 assert.equal(multiResult.session.result.maxScore,1);assert.equal(typeof multiResult.session.result.items[0].correct,'boolean');assert.ok(!requests.some(request=>/marking|mark-scheme|answer-index/i.test(request.url)))
 console.log(JSON.stringify({status:'PASS',catalogQuestions:catalog.routes.reduce((sum,route)=>sum+route.questionCount,0),singleQuestion:single.id,multipleQuestion:multiple.id,lazyQuestionRequests:requests.filter(request=>request.url.includes('/questions/')).length,privateSessions:history.length,idempotentDuplicate:duplicate.duplicate,owner404:true,noAnswerLeak:true}))
}finally{
 database.close();const resolved=path.resolve(scratch);if(path.dirname(resolved)!==scratchParent||!path.basename(resolved).startsWith('stemist-ap-mcq-cross-'))throw Error('Refusing unsafe scratch cleanup.');await fs.rm(resolved,{recursive:true,force:false})
}
