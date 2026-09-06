const {evaluateExpression,validateExpression,tokenize,FUNCTIONS}=require('./calculator')
const VARIABLES=['A','B','C','D','E','F','x','y','z']
const EPS=Number.EPSILON

function expandProducts(source){
 return source.replace(/[A-Za-z][A-Za-z0-9_]*/g,(name,index)=>{
  if(index>0&&/[0-9.]/.test(source[index-1])&&/^[eE]\d+$/.test(name))return name
  if(FUNCTIONS.has(name.toLowerCase())||['Ans','ans','pi','e'].includes(name)||VARIABLES.includes(name))return name
  return /^[A-Fxyz][A-Fxyz0-9]*$/.test(name)?name.match(/[A-Fxyz]|\d+/g).join('*'):name
 })
}
function parseEquation(equation,context={}){
 const source=String(equation||'').trim().replace(/＝/g,'=')
 if(!source||source.length>500)throw new Error('请输入不超过 500 字符的方程')
 const sides=source.split('=')
 if(sides.length>2||sides.some(side=>!side.trim()))throw new Error('方程只允许一个等号，左右两边都需要算式')
 const left=expandProducts(sides[0].replace(/\s+/g,'')),right=expandProducts((sides[1]||'0').replace(/\s+/g,''))
 validateExpression(left);validateExpression(right)
 const names=new Set(),visited=new Set()
 function collect(expression,inFunction=false){
  for(const token of tokenize(expression)){
   if(VARIABLES.includes(token.raw)&&!(inFunction&&token.raw==='x'))names.add(token.raw)
   if(['f','g'].includes(token.value)){
    if(visited.has(token.value))continue
    if(!context.functions?.[token.value])throw new Error(token.value+'(x) 尚未定义')
    visited.add(token.value);collect(context.functions[token.value],true)
   }
  }
 }
 collect(left);collect(right)
 if(!names.size)throw new Error('方程需要包含一个待求变量')
 return {source,left,right,variables:VARIABLES.filter(name=>names.has(name))}
}
function sample(state,x){
 if(!Number.isFinite(x)||Math.abs(x)>1e100)return null
 try{
  const context={...state.context,variables:{...state.context.variables,[state.variable]:x}}
  const left=evaluateExpression(state.equation.left,context),right=evaluateExpression(state.equation.right,context)
  const residual=left-right
  const f=residual/(state.scale||1)
  return Number.isFinite(f)&&Number.isFinite(residual)?{x,left,right,residual,f}:null
 }catch{return null}
}
function result(state,status,reason=''){
 const point=state.point
 state.status=status;state.reason=reason
 return {status,reason,value:point?.x??state.x,left:point?.left??null,right:point?.right??null,residual:point?.residual??null,relativeResidual:point?.f??null,iterations:state.iterations}
}
function bracket(state,a,b){
 if(!a||!b||a.f===0||b.f===0||Math.sign(a.f)===Math.sign(b.f))return
 const pair=a.x<b.x?[a,b]:[b,a]
 if(!state.bracket||pair[1].x-pair[0].x<state.bracket[1].x-state.bracket[0].x)state.bracket=pair
}
function updateBracket(state,point){
 if(!state.bracket)return
 const [a,b]=state.bracket
 if(point.x<=a.x||point.x>=b.x)return
 if(Math.sign(point.f)===Math.sign(a.f))state.bracket=[point,b]
 else state.bracket=[a,point]
}
function createSolver(equation,{variable='x',initial=0,context={},maxIterations=160}={}){
 const parsed=parseEquation(equation,context)
 if(!parsed.variables.includes(variable))throw new Error('所选变量不在方程中')
 if(!Number.isFinite(initial)||Math.abs(initial)>1e100)throw new Error('初值超出有效数值范围')
 const state={equation:parsed,variable,x:initial,initial,context:{...context,variables:{...context.variables},functions:{...context.functions}},iterations:0,maxIterations:Math.max(1,Math.min(320,Math.floor(maxIterations)||160)),status:'running',reason:'',bracket:null,stalls:0}
 state.point=sample(state,initial)
 if(state.point){state.scale=Math.max(1,Math.abs(state.point.left),Math.abs(state.point.right));state.point.f=state.point.residual/state.scale}
 if(!state.point)result(state,'cannot_solve','初值不在定义域内，请修改初值')
 return state
}
function iterate(state){
 const current=state.point
 if(!current)return result(state,'cannot_solve','当前数值不在定义域内')
 const h=Math.cbrt(EPS)*Math.max(1,Math.abs(current.x))
 const plus=sample(state,current.x+h),minus=sample(state,current.x-h)
 const central=plus&&minus?(plus.f-minus.f)/(2*h):NaN
 bracket(state,minus,plus);bracket(state,current,plus);bracket(state,minus,current)
 const isolated=(plus&&plus.f!==0)||(minus&&minus.f!==0)
 if(current.f===0){
  return isolated?result(state,'converged'):result(state,'cannot_solve','当前初值附近无法确定孤立解，请修改初值')
 }
 // Never accept a tiny residual alone: 1/x=0 and underflow have no root.
 // Nonzero approximate residuals also need a local sign bracket. Exact
 // isolated repeated roots remain valid even without a sign change.
 const localSignChange=plus&&minus&&Math.sign(plus.f)!==Math.sign(minus.f)
 if(localSignChange&&Number.isFinite(central)&&central!==0&&Math.abs(current.f)<1e-11&&Math.abs(current.f/central)<=1e-11*Math.max(1,Math.abs(current.x)))return result(state,'converged')
 let derivative=central
 if(!Number.isFinite(derivative)||derivative===0){
  const forward=plus?(plus.f-current.f)/h:NaN,backward=minus?(current.f-minus.f)/h:NaN
  derivative=Number.isFinite(forward)&&forward!==0?forward:backward
 }
 let step=Number.isFinite(derivative)&&derivative!==0?-current.f/derivative:NaN
 if(Number.isFinite(step))step=Math.sign(step)*Math.min(Math.abs(step),4*Math.max(1,Math.abs(current.x)))
 let candidateX=current.x+step
 if(state.bracket&&(!Number.isFinite(candidateX)||candidateX<=state.bracket[0].x||candidateX>=state.bracket[1].x))candidateX=(state.bracket[0].x+state.bracket[1].x)/2
 let next=null
 if(Number.isFinite(candidateX)){
  for(let i=0;i<14;i++){
   const candidate=sample(state,candidateX)
   if(candidate&&(Math.abs(candidate.f)<Math.abs(current.f)||candidate.f===0)){next=candidate;break}
   candidateX=current.x+(candidateX-current.x)/2
  }
 }
 if(!next&&state.bracket)next=sample(state,(state.bracket[0].x+state.bracket[1].x)/2)
 if(!next||next.x===current.x){state.stalls++;return result(state,'cannot_solve','Cannot Solve · 请修改初值后重试')}
 bracket(state,current,next);updateBracket(state,next)
 state.point=next;state.x=next.x;state.iterations++
 return result(state,'running')
}
function advanceSolver(state,{iterations=6,timeBudgetMs=6}={}){
 if(state.status!=='running')return result(state,state.status,state.reason)
 const started=Date.now(),limit=Math.max(1,Math.min(12,Math.floor(iterations)||6))
 for(let i=0;i<limit&&state.iterations<state.maxIterations;i++){
  iterate(state)
  if(state.status!=='running')break
  if(Date.now()-started>=Math.max(1,Math.min(100,timeBudgetMs)))break
 }
 if(state.status==='running'&&state.iterations>=state.maxIterations)return result(state,'continue','未收敛，可继续或修改初值')
 return result(state,state.status,state.reason)
}
function solveEquation(equation,options={}){
 const state=createSolver(equation,options)
 while(state.status==='running')advanceSolver(state,{iterations:12,timeBudgetMs:100})
 return result(state,state.status,state.reason)
}
module.exports={VARIABLES,parseEquation,createSolver,advanceSolver,solveEquation}
