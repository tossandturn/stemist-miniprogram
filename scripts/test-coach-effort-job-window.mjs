import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const limits=[],runtime=miniRuntime({globals:{setTimeout(fn,ms){limits.push(ms);return limits.length},clearTimeout(){}}}),job=runtime.load('utils/coachJob')
for(const effort of ['low','high','max']){await job.askCoachJob({message:'test-'+effort,reasoningEffort:effort},{request:async path=>({id:path.split('/').at(-1),status:'succeeded',result:{mode:'ai',answer:'4'}})});assert.equal(limits.at(-1),effort==='low'?120000:180000,'bounded recovery must include upload, long thinking and final result delivery')}
console.log('Coach effort foreground window: low unchanged, long reasoning bounded with upload/recovery allowance PASS.')
