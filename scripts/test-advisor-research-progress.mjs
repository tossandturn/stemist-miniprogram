import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const r=miniRuntime(),conversation=r.load('bundles/coach/advisorConversation'),page=r.load('bundles/coach/advisorPage')
assert.equal(typeof conversation.advisorStage,'function','research metadata needs a visible stage, not generic analysis')
assert.equal(conversation.advisorStage({providerStatus:'researching',researchPhase:'search'}),'searching')
assert.equal(conversation.advisorStage({providerStatus:'researching',researchPhase:'fetch'}),'reading-sources')
assert.equal(conversation.advisorStage({providerStatus:'connecting',researchPhase:'fetch'}),'analysis','do not invent research progress on ordinary drafting')
assert.match(page.advisorStageLabel('searching',{}),/检索|搜索/)
assert.match(page.advisorStageLabel('reading-sources',{}),/读取|核对/)
assert.equal(page.advisorStageLabel('analysis',{analysing:'分析'}),'分析')
console.log('PASS real admissions search/read progress without fabricated percentages or drafting research claims')
