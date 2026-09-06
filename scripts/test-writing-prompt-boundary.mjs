import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const {writingPrompt}=miniRuntime().load('utils/writingPrompt')
const prompt='WRITING TASK 2\nThe full task question.\nWrite at least 250 words.\n--- Page 32 ---\nSPEAKING\nPART 1'
assert.equal(writingPrompt(prompt,'cam15-w-test1-task2'),'WRITING TASK 2\nThe full task question.\nWrite at least 250 words.')
assert.equal(writingPrompt(prompt,'custom'),prompt,'custom prompts are not shortened by source heuristics')
assert.equal(writingPrompt('Instructions without an end marker','cam15-w-test1-task1'),'Instructions without an end marker')
console.log('Native Writing prompt retains the original task instructions and excludes the next module after a verified boundary.')
