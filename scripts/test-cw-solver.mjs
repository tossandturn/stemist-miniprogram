import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const {parseEquation,solveEquation,createSolver,advanceSolver}=miniRuntime().load('utils/cwSolver')
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`)
const root=(equation,initial,expected,options={})=>{const result=solveEquation(equation,{initial,...options});assert.equal(result.status,'converged',equation+': '+result.reason);near(result.value,expected);assert.ok(Math.abs(result.relativeResidual)<1e-9);return result}
root('2x+3=7',0,2)
root('x=2E3',1,2000)
root('x y + C=0',1,-3,{context:{variables:{y:2,C:6}}})
root('x^2=2',0,Math.sqrt(2))
root('x^2-2',1,Math.sqrt(2))
root('x^2=2',-1,-Math.sqrt(2))
root('x^3-x-2=0',1,1.521379706804568)
root('sin(x)=0.5',20,30,{context:{angleMode:'DEG'}})
root('sin(x)=0.5',2,5*Math.PI/6,{context:{angleMode:'RAD'}})
root('exp(x)=3',1,Math.log(3))
root('ln(x)=2',1,Math.exp(2))
root('sqrt(x)=3',1,9)
root('frac(x,3)=2',1,6)
root('y=x+5',1,7,{variable:'y',context:{variables:{x:2}}})
root('Ax+B=0',1,-3,{context:{variables:{A:2,B:6}}})
root('xy+C=0',1,-3,{context:{variables:{y:2,C:6}}})
root('(x-2)^2=0',3,2,{maxIterations:160})
root('abs(x)=0',0,0)
root('f(x)=9',2,3,{context:{functions:{f:'x^2'}}})
root('x^2=B/2',1,Math.sqrt(2),{context:{variables:{B:4}}})
for(const scale of [1e-9,1,1e9])for(const first of [-12,-2,.25,7]){
 const second=first+5
 root(`${scale}*(x-(${first}))*(x-(${second}))=0`,first+.2,first)
 root(`${scale}*(x-(${first}))*(x-(${second}))=0`,second-.2,second)
}
for(const equation of ['1/x=0','x^2+1=0','exp(x)=0','(x-1)^2+1e-30=0','x=x','floor(x)=1']){
 const result=solveEquation(equation,{initial:equation.includes('1e-30')?1:equation.includes('floor')?1.5:1,maxIterations:100})
 assert.notEqual(result.status,'converged',equation+' must not receive a false root')
}
for(const equation of ['x=1=2','x=','x+','x+globalThis','x;fetch(1)','sqrt(x=2)','x^□'])assert.throws(()=>parseEquation(equation))
assert.throws(()=>createSolver('x=2',{variable:'y',initial:1}))
const failed=solveEquation('ln(x)=1',{initial:-2});assert.notEqual(failed.status,'converged')
const state=createSolver('x^3=2',{initial:20})
advanceSolver(state,{iterations:1,timeBudgetMs:100});assert.ok(state.iterations<=1,'iteration slices are bounded')
const started=Date.now()
for(let i=0;i<50;i++)root('x^2=2',i%2?1:-1,i%2?Math.sqrt(2):-Math.sqrt(2))
assert.ok(Date.now()-started<1500,'bounded local solving must not lock the mini program')
console.log('CW SOLVE: equations, variables, initial-value branches, trig/log/roots, false-root rejection and bounded work passed.')
