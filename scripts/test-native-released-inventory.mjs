import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const r=miniRuntime(),{normalizeInventory}=r.load('utils/inventory'),{selectionState}=r.load('utils/nativePractice')
const ids=prefix=>Array.from({length:6},(_,i)=>prefix+i)
const policy={schemaVersion:'stem-topic-practice-policy-v1',minSourceGroups:6,minReviewedGroups:12,setSizes:[6,10,15]}
const payload={routeId:'cie-0625-igcse-physics',paperComponents:[2],practicePolicy:policy,topics:[{id:'space',name:'Space',apiStartable:true,availableSetSizes:[6,10],questionIdsByComponent:{2:{verifiedQuestionIds:[],apiReadyQuestionIds:ids('approved-'),releasedStudyQuestionIds:ids('approved-'),studyQuestionIds:[...ids('approved-'),...ids('unreleased-')]}}}]}
let inventory=normalizeInventory(payload,payload.routeId),state=selectionState(inventory,['space'],[2],6)
assert.equal(state.availableCount,6);assert.equal(state.canStart,true);assert.equal(state.ready,false);assert.equal(state.studyReady,true)
assert.equal(state.sizes.includes(10),false,'raw unapproved OCR IDs never inflate usable quantity')
const legacy=structuredClone(payload);delete legacy.practicePolicy;state=selectionState(normalizeInventory(legacy),['space'],[2],6);assert.equal(state.canStart,false,'unversioned study flags are not enough to change legacy eligibility')
const denied=structuredClone(payload);denied.topics[0].apiStartable=false;assert.equal(selectionState(normalizeInventory(denied),['space'],[2],6).canStart,false)
const mixed=structuredClone(payload);mixed.topics[0].questionIdsByComponent[2].apiReadyQuestionIds=ids('approved-').slice(0,5);mixed.topics.push({...mixed.topics[0],id:'other'});state=selectionState(normalizeInventory(mixed),['space','other'],[2],6);assert.equal(state.availableCount,5);assert.equal(state.canStart,false,'small topics and duplicate memberships do not manufacture a startable set')
const bad=structuredClone(payload);bad.practicePolicy.minReviewedGroups=10;assert.throws(()=>normalizeInventory(bad),/规则/)
console.log('Released inventory: versioned server policy, api-ready IDs, study/formal separation, no raw OCR union, per-topic floor and duplicate membership protection passed.')
