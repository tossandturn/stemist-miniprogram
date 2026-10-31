import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const r=miniRuntime(),effort=r.load('utils/coachEffort')
r.storage.set('stemistUser',{id:'ielts:17'})
for(const scope of ['academic','steps','answers','check'])assert.equal(effort.readCoachEffort(scope),'low','academic task default must be low with thinking, not automatically high')
assert.equal(effort.readCoachEffort('pdf'),'high','whole-paper marking keeps its own default')
assert.equal(effort.readCoachEffort('admissions','请分析申请背景'),'high','adviser scene policy stays separate')
effort.saveCoachEffort('high','answers');assert.equal(effort.readCoachEffort('answers'),'high','respect a student choice')
effort.saveCoachEffort('max','check');assert.equal(effort.readCoachEffort('check'),'max','existing max choices remain compatible')
effort.saveCoachEffort('auto','answers');assert.equal(effort.readCoachEffort('answers'),'low')
r.storage.set('stemistUser',{id:'ielts:18'});assert.equal(effort.readCoachEffort('check'),'low','new owner cannot inherit another student choice')
const root=process.env.STEMIST_TEST_RUNTIME_ROOT||path.resolve(import.meta.dirname,'..'),component=fs.readFileSync(path.join(root,'components/coach-effort/index.js'),'utf8')
assert.match(component,/思考已开启|开启思考/,'make the thinking-enabled setting visible')
console.log('PASS academic task defaults: low thinking, explicit high/max, separate PDF/adviser defaults and owner isolation')
