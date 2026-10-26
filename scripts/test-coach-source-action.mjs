import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
assert(fs.existsSync(new URL('../utils/coachSource.js',import.meta.url)),'Source lookup must be a separate user-confirmed action')
let calls=0,pending=deferred(),lastPayload
const rt=miniRuntime({modules:{'utils/api':{requestJson:async(path,payload)=>{assert.equal(path,'/api/ai/coach/source');calls++;lastPayload=payload;return pending.promise},isAuthError:e=>e?.statusCode===401}}})
rt.storage.set('stemistUser',{id:'source-user'})
const actions=rt.load('utils/coachSource'),page={data:{answer:'已完成的答案'},current:()=>true,setData(p){Object.assign(this.data,p)}}
actions.offerCoachSource(page,{message:'original question',imageDataUrls:['data:image/jpeg;base64,fixture'],context:{product:'STEM Studio'}},{completed:true,sourceLookupAvailable:true})
assert.equal(calls,0);assert.equal(page.data.sourceAction.status,'offer');assert(!JSON.stringify(page.data).includes('base64'),'Image data must stay out of setData and visible state')
const sending=actions.lookupCoachSource(page);const duplicate=actions.lookupCoachSource(page);await settle();assert.equal(calls,1);assert.equal(lastPayload.confirmed,true);assert.equal(page.data.sourceAction.status,'loading');assert.equal(page.data.answer,'已完成的答案')
pending.resolve({sourceText:'## 题目出处\n2024 年 · 第 2 题',questionSource:{status:'matched'}});await sending;await duplicate;assert.equal(page.data.sourceAction.status,'done');assert.match(page.data.sourceAction.text,/2024/)
actions.clearCoachSource(page);assert.equal(page.data.sourceAction,null)
actions.offerCoachSource(page,{message:'new question'},{completed:true,sourceLookupAvailable:true});actions.clearCoachSource(page);assert.equal(calls,1,'Decline never calls the API')
pending=deferred();actions.offerCoachSource(page,{message:'old question'},{completed:true,sourceLookupAvailable:true});const stale=actions.lookupCoachSource(page);await settle();actions.clearCoachSource(page);pending.resolve({sourceText:'old source'});await stale;assert.equal(page.data.sourceAction,null)
pending=deferred();actions.offerCoachSource(page,{message:'question'},{completed:true,sourceLookupAvailable:true});const failed=actions.lookupCoachSource(page);await settle();pending.reject(Error('network'));await failed;assert.equal(page.data.sourceAction.status,'error');assert.equal(page.data.answer,'已完成的答案')
pending=deferred();const changed=actions.lookupCoachSource(page);await settle();rt.storage.set('stemistUser',{id:'other-user'});pending.resolve({sourceText:'private stale source'});await changed;assert.notEqual(page.data.sourceAction?.text,'private stale source')
actions.offerCoachSource(page,{message:'IELTS',context:{product:'IELTSist'}},{completed:true,sourceLookupAvailable:true});assert.equal(page.data.sourceAction,null)
actions.offerCoachSource(page,{message:'partial'},{completed:false,sourceLookupAvailable:true});assert.equal(page.data.sourceAction,null)
console.log('Source offer: no automatic call, confirm once, decline, failed retry, stale/identity and IELTS isolation PASS')
for(const route of ['pages/coach/index','pages/stem/coach']){
 let queried=0
 const app=miniRuntime({modules:{
  'utils/coach':{runCoach:async()=>({completed:true,sourceLookupAvailable:true,answer:'## 答案\n已答完',mode:'ai',providerStatus:'connected'})},
  'utils/api':{isAuthError:()=>false,requestJson:async(path,payload)=>{queried++;assert.equal(payload.message,'原始问题');return{sourceText:'## 题目出处\n2024'}}},
  'utils/image':{readAsJpegDataUrl:async()=> 'data:image/jpeg;base64,fixture'},
  'utils/coachSession':{warmCoachSession:()=>()=>{}},
  'utils/attemptSync':{nextAttemptId:()=> 'fixture-attempt',syncStemPhotoAttempt:async()=>({skipped:true})},
 }})
 const p=app.page(route);p.onLoad({feature:'answers'});p.setData({message:'原始问题',imagePath:'/fixture.jpg'})
 await (route==='pages/coach/index'?p.submit():p.ask());assert.equal(queried,0);assert.equal(p.data.sourceAction.status,'offer')
 p.setData({message:'已输入下一道问题但尚未提交'});await p.identifySource();assert.equal(queried,1);assert.match(p.data.answer,/已答完/);assert.equal(p.data.sourceAction.status,'done');p.onUnload()
}
console.log('Actual Coach/photo pages: completed-answer offer, no automatic lookup, immutable input snapshot PASS')
