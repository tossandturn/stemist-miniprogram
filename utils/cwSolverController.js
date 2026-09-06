const {parseEquation,createSolver,advanceSolver}=require('./cwSolver')
const {evaluateExpression,formatNumber}=require('./calculator')
const {insertKey,insertTemplate,keyTemplate,removeBackward,moveCursor,verticalCursor}=require('./cwEditor')
const copyDraft=data=>({expression:data.expression,cursor:data.cursor,hasResult:data.hasResult,display:data.display,formatted:data.formatted})
const cleanText=value=>typeof value==='string'?value.slice(0,500):''

const solverMethods={
 renderSolverInput(){if(!this.__disposed&&['initial','parameter'].includes(this.data.solverPhase)){const value=this.data.solverInitialText,cursor=this.data.solverInitialCursor;this.setData({solverInitialDisplay:this.data.solverInputFresh?value:value.slice(0,cursor)+'▏'+value.slice(cursor)})}},
 solverContext(){return {angleMode:this.data.angleMode,answer:this.data.answer,variables:{...this.data.variables},functions:{...this.data.functions}}},
 solverSnapshot(){
  return {active:Boolean(this.data.solverPhase),phase:this.data.solverPhase,equation:this.data.solverPhase==='equation'?this.data.expression:this.data.solverEquation,target:this.data.solverTarget,initialText:this.data.solverInitialText,initialCursor:this.data.solverInitialCursor,initialIndex:this.data.solverInitialIndex,result:this.data.solverResult,calculate:this.__solverCalculateDraft}
 },
 restoreSolver(saved){
  if(!saved||typeof saved!=='object')return
  const equation=cleanText(saved.equation),target=['A','B','C','D','E','F','x','y','z'].includes(saved.target)?saved.target:'x'
  this.__solverCalculateDraft=saved.calculate&&typeof saved.calculate.expression==='string'?{...saved.calculate,expression:cleanText(saved.calculate.expression)}:null
  this.setData({solverEquation:equation,solverTarget:target,solverInitialText:cleanText(saved.initialText)||'0'})
  if(saved.active){
   this.openSolver()
   try{
    const parsed=parseEquation(equation,this.solverContext())
    if(!parsed.variables.includes(target))return
    this.setData({solverTargets:parsed.variables,solverTargetIndex:parsed.variables.indexOf(target)})
    if(saved.phase==='result'&&Number.isFinite(saved.result?.value)&&Number.isFinite(saved.result?.residual))this.setData({solverPhase:'result',solverResult:saved.result,solverValueText:formatNumber(saved.result.value),solverResidualText:formatNumber(saved.result.residual)})
    else if(['initial','target','running','continue','failed'].includes(saved.phase))this.setData({solverPhase:saved.phase==='target'?'target':'initial',solverInitialCursor:Math.min(this.data.solverInitialText.length,Math.max(0,Number(saved.initialCursor)||0)),solverInitialIndex:saved.initialIndex===1?1:0,solverInputFresh:false})
    this.persistState()
   }catch{/* An incomplete saved equation remains editable in the LCD. */}
  }
 },
 openSolver(){
  if(this.__disposed)return
  this.cancelSolver(false)
  if(!this.data.solverPhase&&!this.__solverCalculateDraft)this.__solverCalculateDraft={...copyDraft(this.data),replayAnswer:this.__replayAnswer,replayContext:this.__replayContext,justEvaluated:this.__justEvaluated}
  const equation=this.data.solverPhase==='equation'?this.data.expression:this.data.solverEquation||''
  this.finishNativeEditor();this.closeMenu();this.__justEvaluated=false;this.invalidateReplay()
  this.setData({solverPhase:'equation',solverEquation:equation,expression:equation,cursor:equation.length,solverResult:null,hasResult:false,display:'',error:'',workbench:'',shiftActive:false})
  this.persistState()
 },
 leaveSolver(){
  if(!this.data.solverPhase)return
  const equation=this.data.solverPhase==='equation'?this.data.expression:this.data.solverEquation
  this.cancelSolver(false)
  const draft=this.__solverCalculateDraft||{expression:'',cursor:0,hasResult:false,display:'0',formatted:{kind:'number',text:'0'}}
  this.setData({...copyDraft(draft),solverEquation:equation,solverPhase:'',solverResult:null,error:''});this.__solverCalculateDraft=null;this.__justEvaluated=Boolean(draft.justEvaluated??draft.hasResult);this.__replayAnswer=Number.isFinite(draft.replayAnswer)?draft.replayAnswer:undefined;this.__replayContext=draft.replayContext;this.persistState()
 },
 solverEquationScreen(){
  this.cancelSolver(false)
  const equation=this.data.solverEquation||''
  this.setData({solverPhase:'equation',expression:equation,cursor:equation.length,solverResult:null,error:'',hasResult:false});this.__justEvaluated=false;this.persistState()
 },
 registerSolverEquation(){
  try{
   const parsed=parseEquation(this.data.expression,this.solverContext())
   const target=parsed.variables.includes(this.data.solverTarget)?this.data.solverTarget:parsed.variables.includes('x')?'x':parsed.variables[0]
   this.setData({solverEquation:this.data.expression,solverPhase:'target',solverTargets:parsed.variables,solverTarget:target,solverTargetIndex:parsed.variables.indexOf(target),solverResult:null,error:''});this.persistState()
  }catch(error){this.setData({error:error.message})}
 },
 chooseSolverTarget(event){
  const name=String(event.currentTarget.dataset.name||'')
  if(this.__disposed||this.data.solverPhase!=='target'||!this.data.solverTargets.includes(name))return
  const initialText=name===this.data.solverTarget?this.data.solverInitialText:String(this.data.variables[name]||0)
  this.setData({solverTarget:name,solverPhase:'initial',solverInitialText:initialText||'0',solverInitialCursor:(initialText||'0').length,solverInitialIndex:0,solverInputFresh:true,error:''});this.persistState()
 },
 solverEditParameter(name){
  this.closeMenu()
  this.setData({solverEquation:this.data.expression,solverPhase:'parameter',solverParameter:name,solverInitialText:String(this.data.variables[name]||0),solverInitialCursor:String(this.data.variables[name]||0).length,solverInitialIndex:0,solverInputFresh:true,error:''})
 },
 solverAppend(value,template){
  if(this.__disposed||!['initial','parameter'].includes(this.data.solverPhase))return false
  if(this.data.solverInitialIndex===1&&!template&&value==='')return true
  const text=this.data.solverInputFresh?'':this.data.solverInitialText,cursor=this.data.solverInputFresh?0:this.data.solverInitialCursor
  const inserted=template?insertTemplate(text,cursor,template):insertKey(text,cursor,String(value))
  if(inserted.expression.length>500){this.setData({error:'初值最多 500 个字符'});return true}
  this.setData({solverInitialText:inserted.expression,solverInitialCursor:inserted.cursor,solverInputFresh:false,solverInitialIndex:0,error:''});this.persistState();return true
 },
 solverCommitInitial(){
  try{
   const value=evaluateExpression(this.data.solverInitialText,this.solverContext())
   if(Math.abs(value)>1e100)throw new Error('初值超出有效数值范围')
   if(this.data.solverPhase==='parameter'){
    this.setData({variables:{...this.data.variables,[this.data.solverParameter]:value},solverInitialText:this.__solverPreviousInitial||'0'})
    this.solverEquationScreen();return null
   }
   this.setData({solverInitialIndex:1,error:''});this.__solverInitialValue=value;this.persistState();return value
  }catch(error){this.setData({error:error.message,solverInitialIndex:0});return null}
 },
 solverExecute(){
  if(this.__disposed||this.data.solverPhase!=='initial')return
  const value=this.solverCommitInitial();if(value===null)return
  try{this.__solverJob=createSolver(this.data.solverEquation,{variable:this.data.solverTarget,initial:value,context:this.solverContext(),maxIterations:40})}
  catch(error){this.setData({error:error.message});return}
  this.startSolverChunks()
 },
 startSolverChunks(){
  this.cancelSolver(false)
  const generation=this.__solverGeneration
  this.setData({solverPhase:'running',solverResult:null,solverIterations:this.__solverJob.iterations,error:''})
  this.__solverPromise=new Promise(resolve=>{this.__solverResolve=resolve})
  const work=()=>{
   this.__solverTimer=null
   if(this.__disposed||generation!==this.__solverGeneration)return
   const answer=advanceSolver(this.__solverJob,{iterations:6,timeBudgetMs:6})
   if(answer.status==='running'){
    if(answer.iterations!==this.data.solverIterations)this.setData({solverIterations:answer.iterations})
    this.__solverTimer=setTimeout(work,0);return
   }
   const success=answer.status==='converged'
    this.setData({solverPhase:success?'result':answer.status==='continue'?'continue':'failed',solverContinueIndex:0,solverIterations:answer.iterations,solverResult:success?answer:null,solverValueText:success?formatNumber(answer.value):'',solverResidualText:success?formatNumber(answer.residual):'',error:success?'':answer.reason,...(success?{variables:{...this.data.variables,[this.data.solverTarget]:answer.value}}:{})})
   this.persistState();this.__solverResolve?.(answer);this.__solverResolve=null
  }
  this.__solverTimer=setTimeout(work,0)
  return this.__solverPromise
 },
 continueSolver(){
  if(this.data.solverPhase!=='continue'||!this.__solverJob||this.__disposed)return
  if(this.__solverJob.maxIterations>=320){this.setData({solverPhase:'failed',error:'Cannot Solve · 请修改初值'});return}
  this.__solverJob.maxIterations+=40;this.__solverJob.status='running';return this.startSolverChunks()
 },
 cancelSolver(returnToInput=true){
  this.__solverGeneration=(this.__solverGeneration||0)+1
  clearTimeout(this.__solverTimer);this.__solverTimer=null;this.__solverResolve?.({status:'cancelled'});this.__solverResolve=null
  if(returnToInput&&this.data.solverPhase==='running'&&!this.__disposed){this.setData({solverPhase:'initial',solverInitialIndex:0,solverInputFresh:true,error:''});this.persistState()}
 },
 solverChangeInitial(){if(this.__disposed)return;this.cancelSolver(false);this.setData({solverPhase:'initial',solverInitialIndex:0,solverInputFresh:true,solverResult:null,error:''});this.persistState()},
 selectSolverInitial(){if(!this.__disposed){this.setData({solverInitialIndex:0,solverInputFresh:true,error:''});this.renderSolverInput()}},
 solverDismissError(){if(['initial','parameter'].includes(this.data.solverPhase))this.selectSolverInitial();else this.solverChangeInitial()},
 handleSolverAction(action){
  if(!this.data.solverPhase||this.data.menu||this.data.powerOff)return false
  const phase=this.data.solverPhase
  if(['home','power-off','on'].includes(action)){this.cancelSolver();return false}
  if(phase==='running'){if(['clear','back'].includes(action))this.cancelSolver();return true}
  if(action==='format'&&phase!=='equation'){this.setData({error:'Solver 结果使用小数显示'});return true}
  if(['result','failed','continue'].includes(phase)){
   if(phase==='continue'&&['up','down','left','right'].includes(action)){this.setData({solverContinueIndex:['up','left'].includes(action)?0:1});return true}
   if(action==='back'||action==='left'){this.solverChangeInitial();return true}
   if(action==='clear'||action==='equals'||action==='ok'||action==='equals-decimal'){
    if(phase==='continue'&&action!=='clear'){if(this.data.solverContinueIndex===0)this.continueSolver();else this.solverChangeInitial()}else this.solverEquationScreen();return true
   }
   return !['home','settings','variables','tools'].includes(action)
  }
  if(phase==='equation'){
   if(['equals','ok','equals-decimal'].includes(action)){this.registerSolverEquation();return true}
   if(action==='back'){this.openMenu('equation',{reset:true});return true}
   if(['up','down'].includes(action)&&verticalCursor(this.data.expression,this.data.cursor,action)===null)return true
   return false
  }
  if(phase==='target'){
   if(['up','down','left','right'].includes(action)){const delta=['up','left'].includes(action)?-1:1;this.setData({solverTargetIndex:Math.max(0,Math.min(this.data.solverTargets.length-1,this.data.solverTargetIndex+delta))});return true}
   if(['equals','ok','equals-decimal'].includes(action)){this.chooseSolverTarget({currentTarget:{dataset:{name:this.data.solverTargets[this.data.solverTargetIndex]}}});return true}
   if(['back','clear'].includes(action)){this.solverEquationScreen();return true}
   return !['home','settings'].includes(action)
  }
  if(['initial','parameter'].includes(phase)){
   if(['equals','ok','equals-decimal'].includes(action)){if(this.data.solverInitialIndex===0||phase==='parameter')this.solverCommitInitial();else this.solverExecute();return true}
   if(action==='back'){if(phase==='parameter')this.solverEquationScreen();else this.setData({solverPhase:'target',error:''});return true}
   if(action==='clear'){this.setData({solverInitialText:'0',solverInitialCursor:1,solverInitialIndex:0,solverInputFresh:true,error:''});this.persistState();return true}
   if(action==='delete'){const next=removeBackward(this.data.solverInitialText,this.data.solverInitialCursor);this.setData({solverInitialText:next.expression,solverInitialCursor:next.cursor,solverInputFresh:false,solverInitialIndex:0});this.persistState();return true}
   if(action==='left'||action==='right'){this.setData({solverInitialCursor:moveCursor(this.data.solverInitialText,this.data.solverInitialCursor,action==='left'?-1:1),solverInputFresh:false});this.renderSolverInput();return true}
   if(action==='up'||action==='down'){const cursor=verticalCursor(this.data.solverInitialText,this.data.solverInitialCursor,action);if(cursor!==null)this.setData({solverInitialCursor:cursor});else this.setData({solverInitialIndex:action==='up'?0:1});this.renderSolverInput();return true}
   const templates={fraction:'frac','mixed-input':'mixed','root-input':'root','log-input':'logb','ncr-input':'ncr','npr-input':'npr','dms-input':'dms'}
   if(templates[action])return this.solverAppend('',templates[action])
   if(action==='ans')return this.solverAppend('ans')
   return !['shift','home','settings','catalog','variables'].includes(action)
  }
  return false
 }
}
module.exports={solverMethods}
