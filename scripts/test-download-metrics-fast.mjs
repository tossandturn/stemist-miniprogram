import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let at=0;const {createDownloadMetrics}=miniRuntime().load('utils/downloadMetrics'),metrics=createDownloadMetrics({now:()=>at}),total=8*1024*1024
metrics.observe(0,total);let latest
for(let i=1;i<=24;i++){at=i*50;latest=metrics.observe(i*16384,total)}
assert(Number.isFinite(latest.etaSeconds)&&latest.etaSeconds>0,'frequent real byte updates must estimate after elapsed warmup, even when the 6-sample window is shorter than 800 ms')
assert.match(latest.speedLabel,/KB\/s/)
metrics.reset();at=3000;assert.equal(metrics.observe(4*1024*1024,total).etaSeconds,null,'saved resume bytes are not fresh transfer speed')
at+=50;assert.equal(metrics.observe(4*1024*1024+131072,total).etaSeconds,null)
console.log('Download ETA: high-frequency callbacks warm up by real elapsed time; resumed bytes remain excluded.')
