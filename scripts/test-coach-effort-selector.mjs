import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const runtime=miniRuntime(),definition=runtime.load('components/coach-effort/index'),events=[]
runtime.storage.set('stemistUser',{id:'student-a'})
const control={...definition.methods,data:{effort:'',disabled:false,locked:false,compact:false,...structuredClone(definition.data)},setData(patch){Object.assign(this.data,patch)},triggerEvent(name,value){events.push({name,value})}}
definition.lifetimes.attached.call(control);assert.equal(control.data.selected,'low')
control.onChange({detail:{value:'3'}});assert.equal(control.data.selected,'max');assert.equal(runtime.load('utils/coachEffort').readCoachEffort(),'max');assert.equal(events.at(-1).value.value,'max')
control.data.disabled=true;control.onChange({detail:{value:'0'}});assert.equal(events.length,1)
control.data.disabled=false;control.data.locked=true;control.onChange({detail:{value:'0'}});assert.equal(events.length,1)
control.data.locked=false;control.onOpen();runtime.storage.set('stemistUser',{id:'student-b'});control.refresh();control.onChange({detail:{value:'2'}});assert.equal(events.length,1,'a selection opened under another account cannot persist even after refresh')
assert.equal(runtime.load('utils/coachEffort').readCoachEffort(),'low')
control.data.scope='admissions';control.data.effort='';control.data.message='请分析申请竞争力';control.refresh();assert.equal(control.data.selected,'high');assert.match(control.data.label,/推荐/)
control.onOpen();control.data.scope='tavern';control.refresh();control.onChange({detail:{value:'3'}});assert.equal(events.length,1,'picker opened in another purpose cannot update current purpose')
control.onOpen();control.onChange({detail:{value:'3'}});assert.equal(runtime.load('utils/coachEffort').readCoachEffort('tavern'),'max');assert.equal(runtime.load('utils/coachEffort').readCoachEffort('answers'),'low')
control.onChange({detail:{value:'0'}});assert.equal(runtime.load('utils/coachEffort').coachEffortPreference('tavern'),'auto');assert.equal(control.data.selected,'low')
control.data.effort='high';control.data.locked=true;control.refresh();assert.equal(control.data.selected,'high','pending request shows its captured effort, not a new preference')
const root=process.env.STEMIST_TEST_RUNTIME_ROOT||path.resolve(import.meta.dirname,'..'),wxml=fs.readFileSync(path.join(root,'components/coach-effort/index.wxml'),'utf8'),css=fs.readFileSync(path.join(root,'components/coach-effort/index.wxss'),'utf8');assert.match(wxml,/picker/);assert.match(wxml,/思考强度/);assert.match(css,/min-height:\s*44px/)
console.log('Coach effort selector: real preference change, loading/pending locks, stale account protection and labelled touch target PASS.')
