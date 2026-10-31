import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const root=process.env.STEMIST_TEST_RUNTIME_ROOT||path.resolve(import.meta.dirname,'..')
assert.ok(fs.existsSync(path.join(root,'utils/coachTaskView.js')),'task progress needs a strict versioned view without hidden model content')
const r=miniRuntime(),view=r.load('utils/coachTaskView'),base=1_000_000
function snapshot({stage='thinking',status='running',effort='low',saved=false,elapsed=5000,source='initial'}={}){
 return{id:'cj-taskfixture1234567890',status,stage,createdAt:base,updatedAt:base+elapsed,expiresAt:base+(saved?259200000:600000),serverNow:base+elapsed,task:{schemaVersion:'stem-coach-task-v1',stage:{code:stage,changedAt:base+1000},reasoning:{effectiveEffort:effort,enabled:true,activityObserved:stage==='thinking'},input:{kind:'image',imageCount:1},helpIntent:'worked-solution',persistence:{saved,retentionMs:saved?259200000:600000},milestones:{acceptedAt:base,processingStartedAt:base,completedAt:status==='succeeded'?base+elapsed:null},estimate:{status:source==='cohort'?'calibrated':'initial',totalMs:{lower:12000,upper:30000},remainingMs:{lower:Math.max(0,12000-elapsed),upper:Math.max(0,30000-elapsed)},source:{kind:source,sampleCount:source==='cohort'?8:0}}}}
}
let state=view.taskProgressView(snapshot())
assert.equal(state.phase,'analysis');assert.equal(state.percentage,null);assert.equal(state.canLeave,false);assert.equal(state.savedTask,false);assert.match(state.effortLabel,/快速.*思考已开启/);assert.match(state.etaLabel,/7.*25/);assert.match(state.estimateNote,/初步/)
assert.equal(view.taskProgressView(snapshot({saved:true})),null,'low cannot masquerade as a saved task')
state=view.taskProgressView(snapshot({saved:true,effort:'high',source:'cohort'}),2000)
assert.equal(state.canLeave,true);assert.equal(state.savedTask,true);assert.match(state.etaLabel,/5.*23/);assert.match(state.estimateNote,/近期/);assert.match(state.retentionLabel,/3 天/)
state=view.taskProgressView(snapshot(),40000);assert.equal(state.etaSeconds,null);assert.match(state.etaLabel,/超过/);assert.equal(state.percentage,null)
state=view.taskProgressView(snapshot({stage:'complete',status:'succeeded',elapsed:18000}),50000);assert.equal(state.phase,'complete');assert.match(state.elapsedLabel,/18 秒/,'completed elapsed time never keeps running');assert.equal(state.active,false)
for(const invalid of [{...snapshot(),id:'../other'},{...snapshot(),task:{schemaVersion:'bad'}},{...snapshot(),status:'invented'},{...snapshot(),serverNow:'1000'}])assert.equal(view.taskProgressView(invalid),null)
const privateInput=snapshot();privateInput.task.reasoning.content='private-thought';privateInput.task.secret='private-token';assert.doesNotMatch(JSON.stringify(view.taskProgressView(privateInput)),/private-thought|private-token/)

let time=0,serial=0;const timers=new Map(),states=[]
const tracker=r.load('utils/operationProgress').createOperationTracker({taskMode:true,effort:'low',key:'coach-photo',onChange:s=>states.push(s),now:()=>time,setTimer:f=>{timers.set(++serial,f);return serial},clearTimer:id=>timers.delete(id),history:r.wx})
assert.match(states.at(-1).label,/准备/);assert.match(states.at(-1).etaLabel,/30/);assert.equal(states.at(-1).canLeave,false)
tracker.stage('calling');assert.match(states.at(-1).label,/提交/)
tracker.stage({phase:'uploading',totalBytes:1000,uploadedBytes:500,speedBytesPerSecond:100,etaSeconds:5});assert.equal(states.at(-1).percentage,50);assert.equal(states.at(-1).canLeave,false)
tracker.stage({phase:'task',snapshot:snapshot({saved:true,effort:'high'})});assert.equal(states.at(-1).canLeave,true);assert.equal(states.at(-1).phase,'analysis')
time=2000;timers.values().next().value();assert.match(states.at(-1).etaLabel,/5.*23/)
tracker.stage({phase:'task',snapshot:snapshot({saved:true,effort:'high',stage:'preparing',elapsed:100})});assert.equal(states.at(-1).phase,'analysis','stale response cannot rewind verified progress')
tracker.stage('recovering');assert.equal(states.at(-1).phase,'recovering');assert.match(states.at(-1).etaLabel,/恢复|状态/);assert.equal(states.at(-1).canLeave,true)
tracker.stage({phase:'task',snapshot:snapshot({saved:true,effort:'high',stage:'answering',elapsed:15000})});assert.equal(states.at(-1).phase,'arranging')
tracker.finish(true);assert.equal(states.at(-1).phase,'complete');assert.equal(timers.size,0);assert.equal(r.storage.has('stemistOperationTimings'),false,'task mode uses server cohorts and does not mix local low/high samples')
const failed=[];const terminal=r.load('utils/operationProgress').createOperationTracker({taskMode:true,onChange:s=>failed.push(s),setTimer:()=>1,clearTimer:()=>{}})
terminal.stage({phase:'task',snapshot:snapshot({saved:true,effort:'high',stage:'failed',status:'failed'})});terminal.finish(false)
assert.equal(failed.at(-1).label,'答疑未完成','a known server failure must not be relabelled as unknown or still processing')
console.log('PASS task stages and ETA: strict metadata, saved high only, initial/calibrated/exceeded estimates, clock correction, stale response and no fabricated percentage')
