import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const failures=[]
function test(name,run){try{run();console.log('PASS '+name)}catch(error){failures.push(name);console.error('FAIL '+name+': '+error.message)}}
const setup=()=>{const runtime=miniRuntime();const page=runtime.page('pages/calculator/index');page.onLoad();return{runtime,page}}
const input=(page,value,cursor=value.length)=>page.onInput({detail:{value,cursor}})
test('keypad inserts and deletes at the editor cursor',()=>{const{page}=setup();input(page,'12+34',2);page.append('0');assert.equal(page.data.expression,'120+34');page.runAction('delete');assert.equal(page.data.expression,'12+34')})
test('result retains the editable original expression',()=>{const{page}=setup();input(page,'2+3*4');page.calculate();assert.equal(page.data.expression,'2+3*4');assert.equal(page.data.display,'14')})
test('continuation uses the precise answer, not rounded display',()=>{const{page}=setup();input(page,'1/3');page.calculate();page.append('*');page.append('3');page.calculate();assert.equal(page.data.answer,1)})
test('entering a digit after equals starts a new calculation',()=>{const{page}=setup();input(page,'2+3');page.calculate();page.append('7');assert.equal(page.data.expression,'7')})
test('memory add evaluates the entered expression',()=>{const{page}=setup();input(page,'2+3');page.runAction('memoryAdd');assert.equal(page.data.memory,5);input(page,'7');page.runAction('memorySub');assert.equal(page.data.memory,-2)})
test('memory ignores an invalid expression',()=>{const{page}=setup();page.setData({memory:4});input(page,'1/0');page.runAction('memoryAdd');assert.equal(page.data.memory,4);assert.ok(page.data.error)})
test('history replay retains the Ans value used by the original expression',()=>{const{page}=setup();input(page,'2');page.calculate();input(page,'ans+3');page.calculate();input(page,'100');page.calculate();page.restoreHistory({currentTarget:{dataset:{index:1}}});page.calculate();assert.equal(page.data.answer,5)})
test('custom keypad obeys the same input length limit',()=>{const{page}=setup();input(page,'1'.repeat(500));page.append('2');assert.equal(page.data.expression.length,500);assert.ok(page.data.error)})
test('shift is consumed once and enters the alternate function',()=>{const{page}=setup();page.runAction('shift');page.press({currentTarget:{dataset:{value:'sin(',shiftValue:'asin('}}});assert.equal(page.data.expression,'asin(');assert.equal(page.data.shiftActive,false)})
test('numeric state, not history alone, restores across page visits',()=>{const{runtime,page}=setup();input(page,'8');page.calculate();page.runAction('memoryAdd');page.runAction('angle');page.onUnload();const next=runtime.page('pages/calculator/index');next.onLoad();assert.equal(next.data.answer,8);assert.equal(next.data.memory,8);assert.equal(next.data.angleMode,'RAD')})
if(failures.length)process.exitCode=1
