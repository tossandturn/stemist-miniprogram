import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const seen=[],runtime=miniRuntime({modules:{'utils/coach':{runCoach:async input=>{seen.push(input);throw Error('fixture retry')}}}})
runtime.storage.set('stemistUser',{id:'fixture-owner'});runtime.storage.set('stemistSessionToken','fixture-only')
const page=runtime.page('pages/coach/index');page.onLoad({feature:'answers',source:'alevel'})
assert.equal(page.data.saveTask,false)
page.chooseSaveTask({detail:{value:true}});assert.equal(page.data.saveTask,false,'low cannot opt in')
runtime.load('utils/coachEffort').saveCoachEffort('high','answers');page.chooseEffort({detail:{value:'high'}});page.chooseSaveTask({detail:{value:true}});assert.equal(page.data.saveTask,true)
page.onMessage({detail:{value:'Solve this equation'}});await page.submit()
assert.equal(seen.at(-1).saveTask,true)
page.chooseSaveTask({detail:{value:false}});assert.equal(page.data.saveTask,true,'retry mode is immutable')
await page.retry();assert.equal(seen.at(-1).saveTask,true)
page.onUnload()
const restored=runtime.page('pages/coach/index');restored.onLoad({feature:'answers',source:'alevel'})
assert.equal(restored.data.saveTask,true,'pending retry restores the captured opt-in')
restored.onMessage({detail:{value:'A new equation'}});runtime.load('utils/coachEffort').saveCoachEffort('low','answers');restored.chooseEffort({detail:{value:'low'}})
assert.equal(restored.data.saveTask,false);await restored.submit();assert.equal(seen.at(-1).saveTask,false)
restored.setData({saveTask:true,progress:{savedTask:true,taskId:'cj-stale_saved_task_001'}});restored.clear();assert.equal(restored.data.saveTask,false);assert.equal(restored.data.progress.taskId,undefined)
restored.onUnload()
const legacy=runtime.page('pages/stem/coach');legacy.onLoad({})
assert.equal(legacy.data.saveTask,false);legacy.chooseEffort({detail:{value:'max'}});legacy.chooseSaveTask({detail:{value:true}});assert.equal(legacy.data.saveTask,true)
legacy.chooseEffort({detail:{value:'low'}});assert.equal(legacy.data.saveTask,false);legacy.onUnload()
const calls=[]
const forward=miniRuntime({modules:{'utils/api':{
 askCoach:async value=>{calls.push(value);return{mode:'ai',providerStatus:'connected',answer:'4'}},
 askIeltsCoach:async value=>{calls.push(value);return{mode:'ai',providerStatus:'connected',answer:'feedback'}},
}}})
await forward.load('utils/coach').runCoach({message:'2+2',reasoningEffort:'low'})
assert.equal(calls.at(-1).saveTask,false)
await forward.load('utils/coach').runCoach({message:'2+2',reasoningEffort:'high',saveTask:true})
assert.equal(calls.at(-1).saveTask,true)
await forward.load('utils/coach').runCoach({message:'essay',context:{product:'IELTSist'},saveTask:true})
assert.equal(calls.at(-1).saveTask,undefined,'independent IELTS service unchanged')
console.log('PASS optional high/max saving, low immediate, retry/draft stability and IELTS isolation.')
