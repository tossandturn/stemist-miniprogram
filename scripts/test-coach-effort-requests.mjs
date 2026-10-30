import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let academic,ielts
const runtime=miniRuntime({modules:{'utils/api':{askCoach:async p=>(academic=p,{mode:'ai',providerStatus:'connected',answer:'4'}),askIeltsCoach:async p=>(ielts=p,{mode:'ai',providerStatus:'connected',answer:'Feedback'})}}})
runtime.storage.set('stemistUser',{id:'student-a'});runtime.load('utils/coachEffort').saveCoachEffort('max','answers')
await runtime.load('utils/coach').runCoach({message:'2+2',feature:'answers'});assert.equal(academic.reasoningEffort,'max','academic service must snapshot selected effort')
await runtime.load('utils/coach').runCoach({message:'Explain',context:{product:'IELTSist',skill:'writing'}});assert.equal(ielts.reasoningEffort,undefined,'specialist IELTS route is independent')
let body
const transport=miniRuntime({modules:{'utils/coachJob':{askCoachJob:async p=>(body=p,{mode:'ai',providerStatus:'connected',answer:'4'})}}})
await transport.load('utils/api').askCoach({message:'2+2',feature:'answers',reasoningEffort:'high'});assert.equal(body.reasoningEffort,'high')
await transport.load('utils/api').askCoach({message:'old caller',feature:'answers'});assert.equal(Object.hasOwn(body,'reasoningEffort'),false,'legacy callers remain omitted')
const requests=[],clients=miniRuntime({modules:{'utils/api':{requestJson:async(path,data,options)=>{requests.push({path,data,options});throw Error('synthetic boundary stop')},COACH_TEXT_TIMEOUT_MS:55000}}})
const input={message:'Hello',conversationId:'conversation-0001',clientTurnId:'turn-0001',expectedRevision:0,reasoningEffort:'max'}
await assert.rejects(()=>clients.load('bundles/coach/admissionsConversation').sendAdmissions(input));assert.equal(requests.at(-1).data.reasoningEffort,'max');assert.equal(requests.at(-1).options.timeout,130000)
await assert.rejects(()=>clients.load('bundles/coach/ieltsTeacherConversation').sendIeltsTeacher(input));assert.equal(requests.at(-1).data.reasoningEffort,'max')
await assert.rejects(()=>clients.load('bundles/coach/tavernConversation').sendTavernTurn({...input,persona:'keeper'}));assert.equal(requests.at(-1).data.reasoningEffort,'max');assert.equal(requests.at(-1).options.timeout,130000)
const marking=clients.load('bundles/marking/service'),scope=marking.scope();await assert.rejects(()=>marking.create({clientRequestId:'marking-0001',reasoningEffort:'high',files:[{id:'file-0001',role:'answer',mediaType:'image/png',size:100,name:'answer.png'}]},scope));assert.equal(requests.at(-1).data.reasoningEffort,'high')
runtime.load('utils/session').clearLocalSession();assert.equal(runtime.storage.has('stemistCoachEffort:v1'),false,'logout clears the bound preference')
console.log('Coach effort requests: academic/advisers/Tavern/PDF forwarding, legacy omission and IELTS isolation PASS.')
