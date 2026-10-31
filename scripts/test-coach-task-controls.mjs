import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const runtime=miniRuntime(),definition=runtime.load('components/coach-panel/index'),events=[]
const control={...definition.methods,data:{academic:true,reasoningEffort:'low',saveTask:false,loading:false,readOnly:false,canRetry:false,progress:{}},triggerEvent:(name,value)=>events.push({name,value})}
control.onSaveTask({detail:{value:['save']}});assert.equal(events.length,0)
control.data.reasoningEffort='high';control.onSaveTask({detail:{value:['save']}});assert.equal(events.at(-1).value.value,true)
control.data.canRetry=true;control.onSaveTask({detail:{value:[]}});assert.equal(events.length,1)
control.openTask();assert.equal(runtime.calls.length,0)
control.data.progress={savedTask:true,taskId:'cj-fixture_saved_task_001'};control.openTask();assert.match(runtime.calls.at(-1).url,/tasks\?id=cj-fixture_saved_task_001/)
const root=process.env.STEMIST_TEST_RUNTIME_ROOT||path.resolve(import.meta.dirname,'..')
for(const file of ['pages/coach/index.wxml','pages/stem/coach.wxml']){
 const wxml=fs.readFileSync(path.join(root,file),'utf8');assert.match(wxml,/save-task="\{\{saveTask\}\}"/);assert.match(wxml,/bind:savetask="chooseSaveTask"/)
}
const wxml=fs.readFileSync(path.join(root,'components/coach-panel/index.wxml'),'utf8')
assert.match(wxml,/保存为任务/);assert.match(wxml,/3 天/);assert.match(wxml,/progress\.steps/);assert.match(wxml,/estimateNote/);assert.match(wxml,/leaveHint/)
console.log('PASS high/max-only opt-in, locked retry, saved-only navigation and page wiring.')
