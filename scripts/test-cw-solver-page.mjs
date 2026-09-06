import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const r=miniRuntime(),p=r.page('pages/calculator/index')
p.onLoad();p.append('7+8')
p.openMenu('home');p.executeMenu('app-equation')
assert.ok(p.data.menuItems.some(item=>item.id==='work-solver'),'Equation must expose Solver')
p.executeMenu('work-solver');assert.equal(p.data.solverPhase,'equation');assert.equal(p.data.workbench,'','Solver stays inside the LCD')
p.append('x');p.append('^2');p.append('-2');p.openMenu('catalog');p.executeMenu('catalog-equation');p.executeMenu('insert-=');p.append('0')
const enteredEquation=p.data.expression
p.runAction('equals');assert.equal(p.data.solverPhase,'target')
p.runAction('equals');assert.equal(p.data.solverPhase,'initial')
p.append('1');p.runAction('equals');assert.equal(p.data.solverInitialIndex,1)
p.runAction('equals');await p.__solverPromise
assert.equal(p.data.solverPhase,'result');assert.ok(Math.abs(p.data.solverResult.value-Math.sqrt(2))<1e-9)
assert.ok(Math.abs(p.data.variables.x-Math.sqrt(2))<1e-9)
const ans=p.data.answer
p.runAction('back');assert.equal(p.data.solverPhase,'initial');assert.equal(p.data.solverInitialText,'1')
p.append('-1');p.runAction('equals');p.runAction('equals');await p.__solverPromise
assert.ok(p.data.solverResult.value<0,'a different initial value can choose another root')
assert.equal(p.data.answer,ans,'Solver does not overwrite Calculate Ans')
p.runAction('equals');assert.equal(p.data.expression,enteredEquation)
p.onUnload()
const reopened=r.page('pages/calculator/index');reopened.onLoad();assert.equal(reopened.data.solverPhase,'equation');assert.equal(reopened.data.expression,enteredEquation)
reopened.openMenu('home');reopened.executeMenu('app-calculate');assert.equal(reopened.data.expression,'7+8','Calculate and Solver drafts are separate')
reopened.openMenu('equation');reopened.executeMenu('work-solver');assert.equal(reopened.data.expression,enteredEquation)
reopened.runAction('clear');reopened.append('x^2+1=0');reopened.runAction('equals');reopened.runAction('equals');reopened.append('0');reopened.runAction('equals');reopened.runAction('equals');await reopened.__solverPromise
assert.notEqual(reopened.data.solverPhase,'result');assert.equal(reopened.data.solverResult,null)
reopened.runAction('back');reopened.runAction('back');reopened.runAction('back')
reopened.runAction('clear');reopened.append('x^2=B/2');reopened.openMenu('variables');reopened.executeMenu('variable-B');reopened.executeMenu('store-variable')
assert.equal(reopened.data.solverPhase,'parameter');reopened.append('4');reopened.runAction('equals');assert.equal(reopened.data.variables.B,4);assert.equal(reopened.data.solverPhase,'equation')
reopened.runAction('equals');reopened.chooseSolverTarget({currentTarget:{dataset:{name:'x'}}});reopened.append('1');reopened.runAction('equals');reopened.runAction('equals');reopened.onUnload();await settle()
assert.equal(reopened.__solverTimer,null,'leaving cancels pending numerical work')
const ansCase=miniRuntime().page('pages/calculator/index');ansCase.onLoad();ansCase.append('4');ansCase.calculate();ansCase.append('+2');ansCase.calculate()
assert.equal(ansCase.data.answer,6)
ansCase.openMenu('equation');ansCase.executeMenu('work-solver');ansCase.openMenu('home');ansCase.executeMenu('app-calculate');ansCase.calculate()
assert.equal(ansCase.data.answer,6,'returning from Solver preserves the original Ans evaluation basis')
ansCase.onUnload()
console.log('CW Solver LCD: physical/menu equation input, target/initial/EXE, result/residual, different roots, variables, restoration and cancellation passed.')
