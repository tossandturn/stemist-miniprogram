import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const requested=[]
const r=miniRuntime({modules:{'utils/inventory':{fetchRouteInventory:async route=>{requested.push(route);return{topics:[{id:'mechanics',code:'1',name:'Mechanics',availableQuestionCount:8}]}}}}})
const p=r.page('pages/practice/index');p.onLoad({category:'alevel'});await settle()
assert.deepEqual(Array.from(p.data.stemTools,x=>x.id),['papers','topics','current','exams'])
assert.deepEqual(Array.from(p.data.examBoards,x=>x.id),['cie','edexcel','oxfordaqa'])
p.chooseBoard({currentTarget:{dataset:{board:'oxfordaqa'}}});const before=requested.length
p.chooseBoardSubject({currentTarget:{dataset:{subject:'maths'}}})
p.openStemTool({currentTarget:{dataset:{tool:'papers'}}})
assert.match(r.calls.at(-1).url,/board=oxfordaqa/);assert.match(r.calls.at(-1).url,/course=oxfordaqa-ial-maths/)
p.route='pages/practice/index';assert.match(p.onShareAppMessage().path,/board=oxfordaqa&boardSubject=maths/)
const shared=r.page('pages/practice/index');shared.onLoad({category:'alevel',board:'edexcel',boardSubject:'further-maths'});assert.equal(shared.data.examBoard,'edexcel');assert.equal(shared.data.boardSubject,'further-maths');assert.equal(shared.data.routeId,'')
assert.equal(requested.length,before,'new boards must not query or borrow CIE topic inventory')
const calls=r.calls.length;p.openStemTool({currentTarget:{dataset:{tool:'photo'}}});p.openStemTool({currentTarget:{dataset:{tool:'notebook'}}});assert.equal(r.calls.length,calls)
p.chooseBoard({currentTarget:{dataset:{board:'cie'}}});await settle();p.openStemTool({currentTarget:{dataset:{tool:'current'}}});assert.match(r.calls.at(-1).url,/pages\/stem\/topics/)
p.onUnload()
console.log('PASS parallel A-Level boards, exact four actions, removed entry actions and no CIE cross-board leakage')
