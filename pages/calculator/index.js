const { deviceState, syncDevice } = require('../../utils/page')
const { evaluateExpression, formatNumber } = require('../../utils/calculator')
const { CONTROL_KEYS, NUMBER_ROWS, SCIENTIFIC_ROWS, UPSTREAM } = require('../../utils/cwKeypad')
const { cwMethods, VARIABLES } = require('../../utils/cwController')
const {solverMethods}=require('../../utils/cwSolverController')
const {touchCursorMethods}=require('../../utils/cwTouchCursor')
const { resultFormat } = require('../../utils/cwMath')
const {evaluateComplex,formatComplex,isScalar,storedScalar,scalar,add:complexAdd,subtract:complexSubtract,scalarExpression}=require('../../utils/cwComplex')
const { insertKey, moveCursor, snapCursor, removeBackward, insertTemplate, keyTemplate, firstEmptySlot, jumpTemplate } = require('../../utils/cwEditor')
const HISTORY_KEY = 'stemistCalculatorHistory'
const STATE_KEY = 'stemistCalculatorState'
const MAX_HISTORY = 20
const MAX_INPUT = 500
const MEMORY_KEYS = [
  { label: 'M+', action: 'memoryAdd' }, { label: 'M−', action: 'memorySub' },
  { label: 'MR', action: 'memoryRecall' }, { label: 'MC', action: 'memoryClear' },
]
const valueText=value=>typeof value==='number'?formatNumber(value):formatComplex(value).text
const cursorIn = (value, text) => Number.isInteger(value) ? Math.max(0, Math.min(value, text.length)) : text.length
function readHistory() {
  const value = wx.getStorageSync(HISTORY_KEY)
  return Array.isArray(value) ? value.filter(item => item && typeof item.expression === 'string' && item.expression.length <= MAX_INPUT && item.result !== undefined).slice(0, MAX_HISTORY) : []
}
const appHistory=(items,app)=>items.filter(item=>(item.calculatorApp||'calculate')===app)
const sameValue=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
function editorDraft(page){
 const {expression,cursor,display,hasResult,resultValue,formatMode}=page.data
 return {expression,cursor,display,hasResult,resultValue,formatMode,justEvaluated:Boolean(page.__justEvaluated),replayAnswer:page.__replayAnswer,replayContext:page.__replayContext,lastAnswerBasis:page.__lastAnswerBasis,historyDraft:page.__historyDraft,historyIndex:page.__historyIndex}
}
const validHistoryDraft=draft=>draft&&typeof draft.expression==='string'&&draft.expression.length<=MAX_INPUT?draft:null

Page({
  ...cwMethods,
  ...solverMethods,
  ...touchCursorMethods,
  data: deviceState({
    expression: '', cursor: 0, display: '0', answer: 0, angleMode: 'DEG',
    calculatorApp:'calculate',complexResult:'rectangular',resultValue:0,
    shiftActive: false, memory: 0, memoryDisplay: '0', error: '', hasResult: false,
    history: [], showHistory: false, showScientific: false, showMemory: false,
    memoryKeys: MEMORY_KEYS, controlKeys: CONTROL_KEYS, scientificRows: SCIENTIFIC_ROWS, numberRows: NUMBER_ROWS, calculatorSource: UPSTREAM.repository,
    menu: '', menuTitle: '', menuItems: [], menuIndex: 0, workbench: '', workTitle: '', workFields: [], workResults: [], workError: '', workSubmitLabel:'计算', keyboardHeight:0,
    workScrollHeight:120, workSheetHeight:286, workCompact:false, workFieldTarget:'', workGeneration:0, safeBottom:0, workDrafts:{},
    powerOff: false, overwrite: false, argumentMode:false, typing: false, editorGeneration:0, calculationFormat:'standard',formatMode: 'standard', formatted: {kind:'number',text:'0'}, expressionParts: [{kind:'text',text:'0'}], expressionLayout:{width:24,height:42,items:[]},
    variables: Object.fromEntries(VARIABLES.map(name=>[name,0])), functions: {},
    solverPhase:'',solverEquation:'',solverTarget:'x',solverTargets:[],solverTargetIndex:0,solverInitialText:'0',solverInitialDisplay:'0',solverInitialCursor:1,solverInitialIndex:0,solverContinueIndex:0,solverInputFresh:true,solverParameter:'',solverResult:null,solverValueText:'',solverResidualText:'',solverIterations:0,
  }),
  onLoad() {
    this.__disposed = false
    this.__expressionVisible = true
    this.__closedEditorGeneration = -1
    this.__savePending = false
    const saved = wx.getStorageSync(STATE_KEY)
    const state = saved && typeof saved === 'object' ? saved : {}
    const expression = typeof state.expression === 'string' ? state.expression.slice(0, MAX_INPUT) : ''
    const calculatorApp=state.calculatorApp==='complex'?'complex':'calculate'
    this.__calculatorDrafts=Object.fromEntries(['calculate','complex'].filter(app=>state.calculatorDrafts?.[app]&&typeof state.calculatorDrafts[app]==='object'&&!Array.isArray(state.calculatorDrafts[app])).map(app=>[app,state.calculatorDrafts[app]]))
    this.__justEvaluated = Boolean(state.justEvaluated)
    this.__replayAnswer = isScalar(state.replayAnswer) ? storedScalar(state.replayAnswer) : undefined
    this.__replayContext = state.replayContext
    this.__historyDraft = validHistoryDraft(state.historyDraft)
    this.__historyIndex = this.__historyDraft && Number.isInteger(state.historyIndex) ? Math.max(-1,Math.min(MAX_HISTORY-1,state.historyIndex)) : -1
    this.setData({ expression, cursor: cursorIn(state.cursor, expression), answer: storedScalar(state.answer),resultValue:storedScalar(state.resultValue,storedScalar(state.answer)),calculatorApp,complexResult:state.complexResult==='polar'?'polar':'rectangular', memory: storedScalar(state.memory), memoryDisplay: valueText(storedScalar(state.memory)), angleMode: ['DEG','RAD','GRAD'].includes(state.angleMode) ? state.angleMode : 'DEG', hasResult: Boolean(state.hasResult), display: typeof state.display === 'string' ? state.display.slice(0, 120) : '0', history: appHistory(readHistory(),calculatorApp),
      variables: Object.fromEntries(VARIABLES.map(name=>[name,storedScalar(state.variables?.[name])])),
      functions: Object.fromEntries(['f','g'].filter(name=>typeof state.functions?.[name]==='string').map(name=>[name,state.functions[name].slice(0,500)])),
      formatMode: ['standard','decimal','fraction','mixed','engineering','fixed','scientific','sexagesimal','polar','rectangular'].includes(state.formatMode) ? state.formatMode : 'standard',
      calculationFormat: ['standard','fixed','scientific'].includes(state.calculationFormat)?state.calculationFormat:['fixed','scientific'].includes(state.formatMode)?state.formatMode:'standard',
      workDrafts: state.workDrafts && typeof state.workDrafts === 'object' && !Array.isArray(state.workDrafts) ? state.workDrafts : {},
    })
    this.restoreDisplayResult()
    this.renderExpression()
    if(calculatorApp!=='complex')this.restoreSolver(state.solver)
  },
  onShow() { this.__expressionVisible=true;this.__expressionGesture=null;syncDevice(this);this.updateWorkbenchLayout() },
  onResize(event={}) { this.onExpressionScroll();if((!this.data.keyboardHeight&&!this.data.typing)||event.size?.windowWidth&&event.size.windowWidth!==this.data.windowWidth)syncDevice(this);this.updateWorkbenchLayout() },
  onHide() { this.__expressionVisible=false;this.cancelExpressionTouch();this.setData({shiftActive:false});this.cancelSolver();this.saveWorkbenchDraft();this.flushState() },
  onUnload() { this.__expressionVisible=false;this.cancelExpressionTouch();this.cancelSolver();this.saveWorkbenchDraft();this.__disposed=true;this.flushState() },
  goBack() { if(!this.__disposed)wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/index/index' }) }) },
  persistState() {
    if(this.__disposed)return
    this.renderExpression()
    this.renderSolverInput()
    this.__savePending = true
    if(this.__saveTimer)clearTimeout(this.__saveTimer)
    this.__saveTimer=setTimeout(()=>this.flushState(),180)
  },
  flushState() {
    if(this.__saveTimer)clearTimeout(this.__saveTimer)
    this.__saveTimer=null
    if(!this.__savePending)return
    try {
      const { expression, cursor, display, answer, resultValue,calculatorApp,complexResult,memory, angleMode, hasResult, variables, functions, formatMode, calculationFormat, workDrafts } = this.data
      wx.setStorageSync(STATE_KEY, { expression, cursor, display, answer,resultValue,calculatorApp,complexResult,calculatorDrafts:this.__calculatorDrafts, memory, angleMode, hasResult, variables, functions, formatMode, calculationFormat, workDrafts, solver:this.solverSnapshot(),justEvaluated: Boolean(this.__justEvaluated), replayAnswer: this.__replayAnswer, replayContext:this.__replayContext, historyDraft:this.__historyDraft, historyIndex:this.__historyIndex })
      this.__savePending=false
    } catch { if(!this.__disposed)this.setData({ error: '无法保存到本机，请检查存储空间。' }) }
  },
  invalidateReplay() {
    this.__replayAnswer=undefined
    this.__replayContext=undefined
    this.__lastAnswerBasis=undefined
    this.__historyIndex=-1
    this.__historyDraft=null
  },
  formatResultValue(value,formatMode){return this.data.calculatorApp==='complex'?formatComplex(value,formatMode,this.data.angleMode,this.data.calculationFormat):resultFormat(value,formatMode)},
  restoreDisplayResult(){
    if(!this.data.hasResult)return
    try{const formatted=this.formatResultValue(this.data.resultValue,this.data.formatMode);this.setData({formatted,display:formatted.text})}
    catch{this.setData({hasResult:false,display:'',error:'保存的结果无法在当前模式显示，请重新计算。'})}
  },
  switchCalculatorApp(app){
    if(this.__disposed||!['calculate','complex'].includes(app)||app===this.data.calculatorApp)return
    this.leaveSolver();this.finishNativeEditor();this.closeMenu()
    this.__calculatorDrafts[this.data.calculatorApp]=editorDraft(this)
    const saved=this.__calculatorDrafts[app]||{},expression=typeof saved.expression==='string'?saved.expression.slice(0,MAX_INPUT):''
    this.invalidateReplay();this.__justEvaluated=Boolean(saved.justEvaluated)
    this.__replayAnswer=isScalar(saved.replayAnswer)?storedScalar(saved.replayAnswer):undefined;this.__replayContext=saved.replayContext;this.__lastAnswerBasis=isScalar(saved.lastAnswerBasis)?storedScalar(saved.lastAnswerBasis):undefined
    this.__historyDraft=validHistoryDraft(saved.historyDraft);this.__historyIndex=this.__historyDraft&&Number.isInteger(saved.historyIndex)?Math.max(-1,Math.min(MAX_HISTORY-1,saved.historyIndex)):-1
    const formatMode=app==='complex'?(saved.formatMode==='polar'?'polar':'rectangular'):(['standard','decimal','fraction','mixed','engineering','fixed','scientific','sexagesimal'].includes(saved.formatMode)?saved.formatMode:'standard')
    this.setData({calculatorApp:app,expression,cursor:cursorIn(saved.cursor,expression),display:typeof saved.display==='string'?saved.display.slice(0,120):'0',hasResult:Boolean(saved.hasResult),resultValue:storedScalar(saved.resultValue),formatMode,history:appHistory(readHistory(),app),shiftActive:false,error:'',showHistory:false,workbench:''})
    this.restoreDisplayResult()
    this.persistState()
  },
  onInput(event) {
    if(this.__disposed)return
    const generation=event.currentTarget?.dataset?.editorGeneration
    if(generation!==undefined&&(Number(generation)!==this.data.editorGeneration||Number(generation)<=this.__closedEditorGeneration))return
    const expression = String(event.detail.value || '').slice(0, MAX_INPUT)
    if(expression !== this.data.expression)this.invalidateReplay()
    this.__justEvaluated = false
    this.setData({ expression, cursor: cursorIn(event.detail.cursor, expression), display: expression ? '' : '0', hasResult: false, error: '' })
    this.persistState()
  },
  onEditorFocus() { if(!this.__disposed)this.__justEvaluated = false },
  onEditorBlur(event) {
    if(this.__disposed)return
    const generation=Number(event.currentTarget?.dataset?.editorGeneration ?? this.data.editorGeneration)
    if(generation!==this.data.editorGeneration||generation<=this.__closedEditorGeneration)return
    this.setData({ cursor: snapCursor(this.data.expression,cursorIn(event.detail.cursor,this.data.expression)), typing:false });this.persistState()
  },
  finishNativeEditor() {
    if(!this.data.typing)return
    this.__closedEditorGeneration=this.data.editorGeneration
    this.setData({typing:false})
    if(typeof wx.hideKeyboard==='function')wx.hideKeyboard({})
  },
  onConfirm() { this.finishNativeEditor();this.runAction('equals') },
  append(value) {
    if(this.__disposed||this.data.powerOff)return
    if(!this.data.menu&&this.solverAppend(value))return
    if(this.data.solverPhase&&!['equation','initial','parameter'].includes(this.data.solverPhase))return
    this.finishNativeEditor()
    if(this.data.powerOff || this.data.menu) return
    let text = String(value || '')
    if (!text) return
    let current = this.data.expression || ''
    let cursor = cursorIn(this.data.cursor, current)
    if (this.__justEvaluated) {
      current = /^[+*/^!%\-]/.test(text) ? 'ans' : ''
      cursor = current.length
      this.__replayAnswer = undefined
      this.__replayContext = undefined
    }
    const template=keyTemplate(text)
    const inserted=this.data.argumentMode&&template?insertTemplate(current,cursor,template,{captureRight:true}):insertKey(current,cursor,text,this.data.overwrite)
    const {expression}=inserted
    if (expression.length > MAX_INPUT) return this.setData({ error: '算式最多 500 个字符。' })
    this.__justEvaluated = false
    this.invalidateReplay()
    this.setData({ expression, cursor: inserted.cursor, display: '', hasResult: false, error: '', typing:false,argumentMode:false })
    this.persistState()
  },
  insertMathTemplate(kind) {
    if(this.__disposed||this.data.powerOff)return
    this.finishNativeEditor();this.closeMenu()
    const current=this.__justEvaluated?'ans':this.data.expression
    const inserted=insertTemplate(current,this.__justEvaluated?current.length:this.data.cursor,kind,{captureRight:this.data.argumentMode})
    if(inserted.expression.length>MAX_INPUT)return this.setData({error:'算式最多 500 个字符。'})
    this.__justEvaluated=false;this.invalidateReplay()
    this.setData({...inserted,hasResult:false,display:'',error:'',typing:false,argumentMode:false})
    this.persistState()
  },
  press(event) {
    if(this.__disposed)return
    const item = event.currentTarget.dataset || {}
    const useShift = Boolean(this.data.shiftActive && (item.shiftAction || item.shiftValue))
    const action = String(useShift ? item.shiftAction || '' : item.action || '')
    const value = String(useShift ? item.shiftValue || '' : item.value || '')
    if (action === 'shift') return this.runAction(action)
    if (this.data.shiftActive) this.setData({ shiftActive: false })
    if (action) return this.runAction(action)
    this.append(value)
  },
  runAction(action) {
    if(this.__disposed)return
    // SHIFT belongs to the instrument, including every Solver screen. A mode
    // handler must never swallow the prefix before OFF or another second key.
    if(action==='shift'){if(!this.data.powerOff)this.setData({shiftActive:!this.data.shiftActive,error:''});return}
    if(this.data.powerOff&&action!=='on')return
    if(this.data.menu&&action==='template-start')action='left'
    if(this.data.menu&&action==='template-end')action='right'
    if(action==='complex-i'){if(this.data.calculatorApp==='complex')return this.append('i');this.setData({error:'请先在 HOME 中选择 Complex 复数模式。'});return}
    if(action==='equation-equals'){
      if(this.data.solverPhase==='equation'&&!this.data.menu)return this.append('=')
      this.setData({error:'等号用于 Equation → Solver。'});return
    }
    this.finishNativeEditor()
    if(this.handleSolverAction(action))return
    if(this.handleCwAction(action)) return
    if (action === 'clear') {
      this.__justEvaluated = false; this.__replayAnswer = undefined; this.__replayContext = undefined; this.__historyIndex = -1
      this.setData({ expression: '', cursor: 0, display: '0', hasResult: false, error: '', shiftActive: false, typing:false,argumentMode:false })
      return this.persistState()
    }
    if (action === 'delete') {
      const current = String(this.data.expression || '')
      const cursor = cursorIn(this.data.cursor, current)
      if (!cursor) return
      const removed=removeBackward(current,cursor)
      const {expression}=removed
      this.__justEvaluated = false
      this.invalidateReplay()
      this.setData({ expression, cursor: removed.cursor, display: expression ? '' : '0', hasResult: false, error: '' })
      return this.persistState()
    }
    if (action === 'template-start' || action === 'template-end') {
      this.__justEvaluated=false
      this.setData({cursor:jumpTemplate(this.data.expression,this.data.cursor,action==='template-start'?-1:1),hasResult:false,argumentMode:false})
      return this.persistState()
    }
    if (action === 'left' || action === 'right') {
      this.__justEvaluated = false
      if(action==='right' && this.data.cursor===this.data.expression.length && (this.data.expression.match(/\(/g)||[]).length > (this.data.expression.match(/\)/g)||[]).length) return this.append(')')
      this.setData({ cursor: moveCursor(this.data.expression,this.data.cursor,action==='left'?-1:1), hasResult:false })
      return this.persistState()
    }
    if (action === 'angle') { this.setData({ angleMode: this.data.angleMode === 'DEG' ? 'RAD' : 'DEG', error: '' }); return this.persistState() }
    if (action === 'ans') return this.append('ans')
    if (action === 'memoryAdd' || action === 'memorySub') {
      let delta = this.data.hasResult?this.data.resultValue:this.data.answer
      if (!this.__justEvaluated) { delta = this.data.expression.trim() ? this.calculate() : 0; if (!isScalar(delta)) return }
      let memory
      try{memory=scalar((action==='memoryAdd'?complexAdd:complexSubtract)(this.data.memory,delta))}catch{return this.setData({error:'记忆数值超出范围。'})}
      this.setData({ memory, memoryDisplay: valueText(memory), error: '' })
      return this.persistState()
    }
    if (action === 'memoryRecall') return this.append('(' + scalarExpression(this.data.memory) + ')')
    if (action === 'memoryClear') { this.setData({ memory: 0, memoryDisplay: '0', error: '' }); return this.persistState() }
    if (action === 'history') return this.setData({ showHistory: !this.data.showHistory })
    if (action === 'copy') { if (this.data.hasResult && wx.setClipboardData) wx.setClipboardData({ data: this.data.display }); return }
    if (action === 'equals') return this.calculate()
  },
  calculate(formatOverride) {
    if(this.__disposed)return
    const expression = String(this.data.expression || '').trim()
    if (!expression) { this.setData({ error: '先输入一个算式。' }); return }
    try {
      const empty=firstEmptySlot(expression)
      if(empty!==null){this.setData({cursor:empty,hasResult:false,error:'请填写光标所在的空格。',display:''});this.persistState();return}
      const answerBasis = this.__justEvaluated && isScalar(this.__lastAnswerBasis) ? this.__lastAnswerBasis : (this.__replayAnswer === undefined ? this.data.answer : this.__replayAnswer)
      const open = (expression.match(/\(/g)||[]).length - (expression.match(/\)/g)||[]).length
      const calculation = expression + ')'.repeat(Math.max(0,open))
      const storedContext = this.__replayContext || {}
      const context = {variables:storedContext.variables || this.data.variables,functions:storedContext.functions || this.data.functions}
      const complex=this.data.calculatorApp==='complex'
      const result = complex?scalar(evaluateComplex(calculation,{angleMode:this.data.angleMode,answer:answerBasis,...context})):evaluateExpression(calculation, { angleMode: this.data.angleMode, answer: answerBasis, ...context })
      const formatMode=complex?this.data.complexResult:formatOverride==='decimal'?'decimal':this.data.calculationFormat==='standard'&&/\bdms\(/.test(calculation)?'sexagesimal':this.data.calculationFormat
      const formatted=this.formatResultValue(result,formatMode)
      const display = formatted.text
      const entry = { calculatorApp:this.data.calculatorApp,expression, result: display,answerBasis, angleMode: this.data.angleMode, variables:{...context.variables},functions:{...context.functions},at: Date.now() }
      const previous = this.data.history[0]
      const same = previous && previous.expression === expression && previous.result === display && sameValue(previous.answerBasis,answerBasis) && previous.angleMode === entry.angleMode && JSON.stringify(previous.variables)===JSON.stringify(entry.variables) && JSON.stringify(previous.functions)===JSON.stringify(entry.functions)
      const allHistory=same?readHistory():[entry,...readHistory()].slice(0,MAX_HISTORY)
      const history = appHistory(allHistory,this.data.calculatorApp)
      this.__justEvaluated = true; this.__lastAnswerBasis = answerBasis; this.__replayAnswer = answerBasis
      this.__historyIndex = -1
      this.__historyDraft = null
      this.setData({ expression, cursor: expression.length, display, formatted,formatMode, answer: result,resultValue:result, history, hasResult: true, error: '',typing:false })
      try { wx.setStorageSync(HISTORY_KEY, allHistory) } catch { this.setData({ error: '结果已计算，但历史未能保存。' }) }
      this.persistState()
      return result
    } catch (error) {
      this.__justEvaluated = false
      this.setData({ hasResult: false, display: '', error: error.message || '算式无法计算，请检查输入。' })
    }
  },
  toggleScientific() { this.openMenu('catalog') },
  toggleMemory() { this.openMenu('memory') },
  toggleHistory() { this.runAction('history') },
  restoreHistory(event) {
    if(this.__disposed)return
    const item = this.data.history[Number(event.currentTarget.dataset.index)]
    if (!item) return
    this.closeMenu()
    if (/ans/i.test(item.expression) && !isScalar(item.answerBasis)) return this.setData({ error: '这条旧记录缺少 Ans 数值，请重新输入。' })
    this.__justEvaluated = false; this.__replayAnswer = isScalar(item.answerBasis) ? storedScalar(item.answerBasis) : undefined
    this.__replayContext = item.variables || item.functions ? {variables:item.variables||{},functions:item.functions||{}} : undefined
    this.setData({ expression: item.expression, cursor: item.expression.length, display: '', hasResult: false, error: '', showHistory: false, angleMode: ['DEG','RAD','GRAD'].includes(item.angleMode) ? item.angleMode : 'DEG' })
    this.persistState()
  },
  clearHistory() {
    if(this.__disposed)return
    wx.showModal({ title: '清空当前模式的计算历史？', confirmText: '清空', success: ({ confirm }) => {
      if (!confirm || this.__disposed) return
      try { const keep=readHistory().filter(item=>(item.calculatorApp||'calculate')!==this.data.calculatorApp);if(keep.length)wx.setStorageSync(HISTORY_KEY,keep);else wx.removeStorageSync(HISTORY_KEY);this.setData({ history: [], showHistory: false }) } catch { this.setData({ error: '历史未能清空，请重试。' }) }
    } })
  },
})
