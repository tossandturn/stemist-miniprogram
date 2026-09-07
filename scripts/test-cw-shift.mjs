import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const runtime=miniRuntime(),keyboard=runtime.load('utils/cwKeypad')
const keys=[...keyboard.CONTROL_KEYS,...keyboard.SCIENTIFIC_ROWS.flatMap(row=>row.keys),...keyboard.NUMBER_ROWS.flatMap(row=>row.keys)]
const key=id=>{const k=keys.find(item=>item.id===id);assert.ok(k,id);return k}
const p=runtime.page('pages/calculator/index');p.onLoad()
const press=id=>p.press({currentTarget:{dataset:key(id)}})
const shifted=id=>{press('shift');assert.equal(p.data.shiftActive,true);press(id);assert.equal(p.data.shiftActive,false)}
const clear=()=>{p.setData({powerOff:false,solverPhase:'',shiftActive:false});p.closeMenu();press('ac')}

// The physical CW keyboard, not an ES/EX mapping: SHIFT + '(' enters '='.
assert.equal(key('open-paren').shiftLabel,'=')
clear();p.openSolver();press('x');press('square');shifted('open-paren');press('2')
assert.equal(p.data.expression,'x^(2)=2');press('exe');press('exe');press('1');press('exe');press('exe');await p.__solverPromise
assert.ok(Math.abs(p.data.solverResult.value-Math.sqrt(2))<1e-9)
for(const phase of ['equation','target','initial','parameter','running','continue','result','failed']){
 p.setData({powerOff:false,solverPhase:phase,shiftActive:false});shifted('ac');assert.equal(p.data.powerOff,true,'SHIFT OFF from '+phase);press('on')
}
clear();press('shift');press('shift');assert.equal(p.data.shiftActive,false,'SHIFT is a one-key prefix, not a sticky lock')
press('shift');press('multiply');assert.equal(p.data.shiftActive,false,'a non-shifted key also consumes the prefix')
for(const [id,expected] of [['sin','asin()'],['cos','acos()'],['tan','atan()'],['7','pi'],['8','e'],['4','A'],['5','B'],['6','C'],['1','D'],['2','E'],['3','F'],['0','x'],['dot','y'],['exponent','z'],['square','log()'],['log-base','ln()'],['sqrt','root(,)'],['fraction','mixed(,,)']]){
 clear();shifted(id);assert.equal(p.data.expression,expected,'SHIFT '+id);assert.equal(p.data.workbench,'','CW input stays in the LCD')
}
clear();shifted('sin');press('dot');press('5');press('exe');assert.ok(Math.abs(p.data.answer-30)<1e-10)
clear();press('2');shifted('power');press('exe');assert.equal(p.data.answer,0.5)
clear();shifted('minus');press('3');press('square');press('exe');assert.equal(p.data.answer,-9,'negative input remains distinct from subtraction and respects exponent precedence')
clear();press('fraction');press('1');press('down');press('3');shifted('exe');assert.equal(p.data.formatted.kind,'number');assert.equal(p.data.calculationFormat,'standard')
clear();for(const id of ['2','shift','plus','2','0','shift','plus','3','0','shift','plus','plus','0','shift','plus','9','shift','plus','3','0','shift','plus','exe'])press(id)
assert.equal(p.data.answer,2.5);assert.equal(p.data.display,'2°30′0″','the official SHIFT DMS sequence retains sexagesimal output')
press('format');p.executeMenu('format-decimal');assert.equal(p.data.display,'2.5')
press('format');p.executeMenu('format-sexagesimal');assert.equal(p.data.display,'2°30′0″')
clear();p.append('123+456');p.setData({cursor:3});press('settings');press('shift');press('right');assert.equal(p.data.menu,'angle');assert.equal(p.data.cursor,3,'SHIFT navigation must not move the hidden expression caret');press('left');assert.equal(p.data.menu,'settings')
press('shift');p.chooseMenu({currentTarget:{dataset:{id:'angle-menu'}}});assert.equal(p.data.shiftActive,false,'touching an LCD menu choice also clears SHIFT')
clear();press('shift');p.onHide();assert.equal(p.data.shiftActive,false,'leaving the app cannot leave a latent modifier')
clear();p.append('42');shifted('9');assert.equal(p.data.expression,'42');assert.match(p.data.error,/Complex|复数/,'imaginary input requires the Complex app, never an ordinary 9')
clear();p.append('42');shifted('x');assert.equal(p.data.expression,'42x');assert.equal(key('x').shiftLabel,undefined,'the user removed QR networking from the keyboard')
clear();shifted('ac');press('shift');assert.equal(p.data.shiftActive,false,'OFF ignores all keys except ON')
p.onUnload()
console.log('CW SHIFT: official key mappings, Solver equals/OFF, one-shot state, inverse functions, variables, templates, negative sign, menus and mode boundaries passed.')
