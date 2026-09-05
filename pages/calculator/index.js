const { deviceState, syncDevice } = require('../../utils/page')
const { evaluateExpression, formatNumber } = require('../../utils/calculator')
const { CONTROL_KEYS, NUMBER_ROWS, SCIENTIFIC_ROWS, UPSTREAM } = require('../../utils/cwKeypad')
const { cwMethods, VARIABLES } = require('../../utils/cwController')
const { resultFormat } = require('../../utils/cwMath')
const HISTORY_KEY = 'stemistCalculatorHistory'
const STATE_KEY = 'stemistCalculatorState'
const MAX_HISTORY = 20
const MAX_INPUT = 500
const MEMORY_KEYS = [
  { label: 'M+', action: 'memoryAdd' }, { label: 'M−', action: 'memorySub' },
  { label: 'MR', action: 'memoryRecall' }, { label: 'MC', action: 'memoryClear' },
]
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const cursorIn = (value, text) => Number.isInteger(value) ? Math.max(0, Math.min(value, text.length)) : text.length
function readHistory() {
  const value = wx.getStorageSync(HISTORY_KEY)
  return Array.isArray(value) ? value.filter(item => item && typeof item.expression === 'string' && item.expression.length <= MAX_INPUT && item.result !== undefined).slice(0, MAX_HISTORY) : []
}

Page({
  ...cwMethods,
  data: deviceState({
    expression: '', cursor: 0, display: '0', answer: 0, angleMode: 'DEG',
    shiftActive: false, memory: 0, memoryDisplay: '0', error: '', hasResult: false,
    history: [], showHistory: false, showScientific: false, showMemory: false,
    memoryKeys: MEMORY_KEYS, controlKeys: CONTROL_KEYS, scientificRows: SCIENTIFIC_ROWS, numberRows: NUMBER_ROWS, calculatorSource: UPSTREAM.repository,
    menu: '', menuTitle: '', menuItems: [], menuIndex: 0, workbench: '', workTitle: '', workFields: [], workResults: [], workError: '', workSubmitLabel:'计算', keyboardHeight:0,
    powerOff: false, overwrite: false, typing: false, formatMode: 'decimal', formatted: {kind:'number',text:'0'}, expressionParts: [{kind:'text',text:'0'}],
    variables: Object.fromEntries(VARIABLES.map(name=>[name,0])), functions: {},
  }),
  onLoad() {
    const saved = wx.getStorageSync(STATE_KEY)
    const state = saved && typeof saved === 'object' ? saved : {}
    const expression = typeof state.expression === 'string' ? state.expression.slice(0, MAX_INPUT) : ''
    this.__justEvaluated = Boolean(state.justEvaluated)
    this.__replayAnswer = typeof state.replayAnswer === 'number' ? finite(state.replayAnswer) : undefined
    this.__replayContext = state.replayContext
    this.setData({ expression, cursor: cursorIn(state.cursor, expression), answer: finite(state.answer), memory: finite(state.memory), memoryDisplay: formatNumber(finite(state.memory)), angleMode: ['DEG','RAD','GRAD'].includes(state.angleMode) ? state.angleMode : 'DEG', hasResult: Boolean(state.hasResult), display: typeof state.display === 'string' ? state.display.slice(0, 60) : '0', history: readHistory(),
      variables: Object.fromEntries(VARIABLES.map(name=>[name,finite(state.variables?.[name])])),
      functions: Object.fromEntries(['f','g'].filter(name=>typeof state.functions?.[name]==='string').map(name=>[name,state.functions[name].slice(0,500)])),
      formatMode: ['decimal','fraction','mixed','engineering','fixed','scientific'].includes(state.formatMode) ? state.formatMode : 'decimal',
    })
    if(this.data.hasResult) { try { this.setData({formatted:resultFormat(this.data.answer,this.data.formatMode)}) } catch { this.setData({formatMode:'decimal',formatted:resultFormat(this.data.answer)}) } }
    this.renderExpression()
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onUnload() { this.persistState() },
  goBack() { wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/index/index' }) }) },
  persistState() {
    try {
      const { expression, cursor, display, answer, memory, angleMode, hasResult, variables, functions, formatMode } = this.data
      wx.setStorageSync(STATE_KEY, { expression, cursor, display, answer, memory, angleMode, hasResult, variables, functions, formatMode, justEvaluated: Boolean(this.__justEvaluated), replayAnswer: this.__replayAnswer, replayContext:this.__replayContext })
    } catch { this.setData({ error: '无法保存到本机，请检查存储空间。' }) }
    this.renderExpression()
  },
  onInput(event) {
    const expression = String(event.detail.value || '').slice(0, MAX_INPUT)
    if (this.__justEvaluated) { this.__replayAnswer = undefined; this.__replayContext = undefined }
    this.__justEvaluated = false
    this.setData({ expression, cursor: cursorIn(event.detail.cursor, expression), display: expression ? '' : '0', hasResult: false, error: '' })
    this.persistState()
  },
  onEditorFocus() { this.__justEvaluated = false },
  onEditorBlur(event) { this.setData({ cursor: cursorIn(event.detail.cursor, this.data.expression), typing:false }) },
  onConfirm() { this.runAction('equals') },
  append(value) {
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
    if (/(?:ans|pi|[ABCDEFexyz])$/.test(current.slice(0,cursor)) && /^[a-zA-Z]/.test(text)) text = '*' + text
    const expression = current.slice(0, cursor) + text + current.slice(cursor + (this.data.overwrite && text.length === 1 ? 1 : 0))
    if (expression.length > MAX_INPUT) return this.setData({ error: '算式最多 500 个字符。' })
    this.__justEvaluated = false
    this.setData({ expression, cursor: cursor + text.length, display: '', hasResult: false, error: '', typing:false })
    this.persistState()
  },
  press(event) {
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
    if(this.handleCwAction(action)) return
    if (action === 'shift') return this.setData({ shiftActive: !this.data.shiftActive, error: '' })
    if (action === 'clear') {
      this.__justEvaluated = false; this.__replayAnswer = undefined; this.__replayContext = undefined; this.__historyIndex = -1
      this.setData({ expression: '', cursor: 0, display: '0', hasResult: false, error: '', shiftActive: false, typing:false })
      return this.persistState()
    }
    if (action === 'delete') {
      const current = String(this.data.expression || '')
      const cursor = cursorIn(this.data.cursor, current)
      if (!cursor) return
      const token = current.slice(0,cursor).match(/(?:sqrt|cbrt|asin|acos|atan|sin|cos|tan|logb|log|ln|exp|frac|root|abs|ncr|npr)\($|(?:ans|pi)$/)
      const removed = token ? token[0].length : 1
      const expression = current.slice(0, cursor - removed) + current.slice(cursor)
      this.__justEvaluated = false
      this.setData({ expression, cursor: cursor - removed, display: expression ? '' : '0', hasResult: false, error: '' })
      return this.persistState()
    }
    if (action === 'left' || action === 'right') {
      this.__justEvaluated = false
      if(action==='right' && this.data.cursor===this.data.expression.length && (this.data.expression.match(/\(/g)||[]).length > (this.data.expression.match(/\)/g)||[]).length) return this.append(')')
      return this.setData({ cursor: cursorIn(this.data.cursor + (action === 'left' ? -1 : 1), this.data.expression) })
    }
    if (action === 'angle') { this.setData({ angleMode: this.data.angleMode === 'DEG' ? 'RAD' : 'DEG', error: '' }); return this.persistState() }
    if (action === 'ans') return this.append('ans')
    if (action === 'memoryAdd' || action === 'memorySub') {
      let delta = this.data.answer
      if (!this.__justEvaluated) { delta = this.data.expression.trim() ? this.calculate() : 0; if (typeof delta !== 'number') return }
      const memory = this.data.memory + (action === 'memoryAdd' ? delta : -delta)
      if (!Number.isFinite(memory)) return this.setData({ error: '记忆数值超出范围。' })
      this.setData({ memory, memoryDisplay: formatNumber(memory), error: '' })
      return this.persistState()
    }
    if (action === 'memoryRecall') return this.append('(' + String(this.data.memory) + ')')
    if (action === 'memoryClear') { this.setData({ memory: 0, memoryDisplay: '0', error: '' }); return this.persistState() }
    if (action === 'history') return this.setData({ showHistory: !this.data.showHistory })
    if (action === 'copy') { if (this.data.hasResult && wx.setClipboardData) wx.setClipboardData({ data: this.data.display }); return }
    if (action === 'equals') return this.calculate()
  },
  calculate() {
    const expression = String(this.data.expression || '').trim()
    if (!expression) { this.setData({ error: '先输入一个算式。' }); return }
    try {
      const answerBasis = this.__justEvaluated && Number.isFinite(this.__lastAnswerBasis) ? this.__lastAnswerBasis : (this.__replayAnswer === undefined ? this.data.answer : this.__replayAnswer)
      const open = (expression.match(/\(/g)||[]).length - (expression.match(/\)/g)||[]).length
      const calculation = expression + ')'.repeat(Math.max(0,open))
      const storedContext = this.__replayContext || {}
      const context = {variables:storedContext.variables || this.data.variables,functions:storedContext.functions || this.data.functions}
      const result = evaluateExpression(calculation, { angleMode: this.data.angleMode, answer: answerBasis, ...context })
      let formatted
      try { formatted = resultFormat(result,this.data.formatMode) } catch { formatted = resultFormat(result); this.setData({formatMode:'decimal'}) }
      const display = formatted.text
      const entry = { expression, result: display, answerBasis, angleMode: this.data.angleMode, variables:{...context.variables},functions:{...context.functions},at: Date.now() }
      const previous = this.data.history[0]
      const same = previous && previous.expression === expression && previous.result === display && previous.answerBasis === answerBasis && previous.angleMode === entry.angleMode && JSON.stringify(previous.variables)===JSON.stringify(entry.variables) && JSON.stringify(previous.functions)===JSON.stringify(entry.functions)
      const history = same ? this.data.history : [entry, ...this.data.history].slice(0, MAX_HISTORY)
      this.__justEvaluated = true; this.__lastAnswerBasis = answerBasis; this.__replayAnswer = answerBasis
      this.__historyIndex = -1
      this.setData({ expression, cursor: expression.length, display, formatted, answer: result, history, hasResult: true, error: '',typing:false })
      try { wx.setStorageSync(HISTORY_KEY, history) } catch { this.setData({ error: '结果已计算，但历史未能保存。' }) }
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
    const item = this.data.history[Number(event.currentTarget.dataset.index)]
    if (!item) return
    this.closeMenu()
    if (/ans/i.test(item.expression) && !Number.isFinite(item.answerBasis)) return this.setData({ error: '这条旧记录缺少 Ans 数值，请重新输入。' })
    this.__justEvaluated = false; this.__replayAnswer = Number.isFinite(item.answerBasis) ? item.answerBasis : undefined
    this.__replayContext = item.variables || item.functions ? {variables:item.variables||{},functions:item.functions||{}} : undefined
    this.setData({ expression: item.expression, cursor: item.expression.length, display: '', hasResult: false, error: '', showHistory: false, angleMode: ['DEG','RAD','GRAD'].includes(item.angleMode) ? item.angleMode : 'DEG' })
    this.persistState()
  },
  clearHistory() {
    wx.showModal({ title: '清空计算历史？', confirmText: '清空', success: ({ confirm }) => {
      if (!confirm) return
      try { wx.removeStorageSync(HISTORY_KEY); this.setData({ history: [], showHistory: false }) } catch { this.setData({ error: '历史未能清空，请重试。' }) }
    } })
  },
})
