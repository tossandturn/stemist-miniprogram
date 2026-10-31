import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {miniRuntime} from './helpers/mini-runtime.mjs'
import {taskFixture} from './helpers/coach-task-fixture.mjs'
const r=miniRuntime(),def=r.load('components/coach-effort/index'),events=[]
const c={...def.methods,data:{...structuredClone(def.data),scope:'answers',effort:'',locked:false,disabled:false},setData(p){Object.assign(this.data,p)},triggerEvent:(name,value)=>events.push(value)}
def.lifetimes.attached.call(c)
assert.deepEqual(Array.from(c.data.labels),['快速','深入','极致'])
assert.equal(c.data.label,'快速');assert.match(c.data.note,/思考已开启/)
for(const [index,value,label] of [[0,'low','快速'],[1,'high','深入'],[2,'max','极致']]){c.onOpen();c.onChange({detail:{value:String(index)}});assert.equal(events.at(-1).value,value);assert.equal(c.data.label,label);assert.match(c.data.note,/思考已开启/)}
c.data.locked=true;c.data.effort='high';c.refresh();assert.match(c.data.note,/思考已开启/);assert.doesNotMatch(c.data.label,/low|high|max/i)
const view=r.load('utils/coachTaskView'),fixture=taskFixture();assert.match(view.taskProgressView(fixture).effortLabel,/深入.*思考已开启/)
assert.equal(r.load('utils/api').safeErrorMessage({code:'coach_task_persistence_effort',error:'Only high/max allowed'},400),'仅“深入”或“极致”模式可保存任务。')
const states=[],tracker=r.load('utils/operationProgress').createOperationTracker({taskMode:true,effort:'max',onChange:x=>states.push(x),setTimer:()=>1,clearTimer:()=>{}});assert.match(states[0].effortLabel,/极致.*思考已开启/);tracker.dispose()
const root=process.env.STEMIST_TEST_RUNTIME_ROOT||path.resolve(import.meta.dirname,'..')
for(const file of ['bundles/coach/tasks.wxml','bundles/coach/index.wxml'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/\b(?:low|high|max)\b/i)
console.log('PASS Chinese-only mode names, exactly three visible choices, thinking-on copy, protocol keys unchanged.')
