import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const seen=[],runtime=miniRuntime({modules:{'utils/coach':{runCoach:async input=>{seen.push(input);throw Error('synthetic retryable failure')}}}})
runtime.storage.set('stemistUser',{id:'student-a'});runtime.storage.set('stemistSessionToken','fixture-only')
const pref=runtime.load('utils/coachEffort'),page=runtime.page('pages/coach/index');page.onLoad({feature:'answers',source:'alevel'});page.onMessage({detail:{value:'Solve 2+2'}})
pref.saveCoachEffort('max');page.chooseEffort({detail:{value:'max'}});await page.submit();assert.equal(seen.at(-1).reasoningEffort,'max');assert.equal(page.data.canRetry,true)
page.onMessage({detail:{value:'Solve 2+2 '}});assert.equal(page.data.canRetry,true,'whitespace-only input must not unlock a pending request setting')
pref.saveCoachEffort('low');page.chooseEffort({detail:{value:'low'}});assert.equal(page.data.reasoningEffort,'max','retry snapshot cannot be changed');await page.retry();assert.equal(seen.at(-1).reasoningEffort,'max','preference from another page cannot change retry')
page.onMessage({detail:{value:'Solve 3+3'}});page.chooseEffort({detail:{value:'low'}});assert.equal(page.data.canRetry,false);await page.submit();assert.equal(seen.at(-1).reasoningEffort,'low')
page.onUnload();const legacy=runtime.page('pages/stem/coach');legacy.onLoad({});legacy.chooseEffort({detail:{value:'high'}});assert.equal(legacy.data.reasoningEffort,'high');legacy.setData({loading:true});legacy.chooseEffort({detail:{value:'low'}});assert.equal(legacy.data.reasoningEffort,'high');console.log('Coach page effort: captured selection, retry stability and explicit new question PASS.')
