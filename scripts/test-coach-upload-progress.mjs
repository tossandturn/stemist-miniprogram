import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const r=miniRuntime();let time=10000,states=[]
const tracker=r.load('utils/operationProgress').createOperationTracker({now:()=>time,onChange:s=>states.push(s),setTimer:()=>1,clearTimer(){},history:r.wx})
tracker.stage('calling')
tracker.stage({phase:'uploading',uploadedBytes:65536,totalBytes:262144,speedBytesPerSecond:32768,etaSeconds:6})
assert.equal(states.at(-1).phase,'uploading','upload is a real phase before model analysis')
assert.equal(states.at(-1).percentage,25);assert.match(states.at(-1).elapsedLabel,/64.*KB.*256.*KB/)
assert.match(states.at(-1).speedLabel,/32.*KB\/s/);assert.match(states.at(-1).etaLabel,/6.*秒/)
tracker.stage({phase:'uploading',uploadedBytes:65536,totalBytes:262144,speedBytesPerSecond:0,etaSeconds:null,retrying:true})
assert.equal(states.at(-1).percentage,25);assert.match(states.at(-1).label,/续传/);assert.doesNotMatch(states.at(-1).etaLabel,/无需重新上传/)
tracker.stage('calling');assert.equal(states.at(-1).percentage,null);assert.equal(states.at(-1).speedLabel,undefined)
tracker.stage('analysis');tracker.stage({phase:'uploading',uploadedBytes:1,totalBytes:2,speedBytesPerSecond:1,etaSeconds:1})
assert.equal(states.at(-1).phase,'analysis','late upload event cannot overwrite model output phase')
tracker.finish(false)
const markup=fs.readFileSync(new URL('../components/coach-panel/index.wxml',import.meta.url),'utf8')
assert.match(markup,/progress\.percentage/);assert.match(markup,/progress\.speedLabel/)
assert.match(markup,/上传图片/);assert.match(markup,/暂停上传/)
console.log('PASS real upload progress, speed, ETA, retry labeling, pause and no synthetic model percentage')
