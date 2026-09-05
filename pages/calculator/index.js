const { deviceState, syncDevice } = require('../../utils/page')
const { evaluateExpression, formatNumber } = require('../../utils/calculator')
const { MODE_KEYS, NUMBER_KEYS, SCIENTIFIC_KEYS, UPSTREAM } = require('../../third_party/claxer-casio-fx-991-es-plus/keypad')
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
  data: deviceState({
    expression: '', cursor: 0, display: '0', answer: 0, angleMode: 'DEG',
    shiftActive: false, memory: 0, memoryDisplay: '0', error: '', hasResult: false,
    history: [], showHistory: false, showScientific: false, showMemory: false,
    modeKeys: MODE_KEYS, memoryKeys: MEMORY_KEYS, scientificKeys: SCIENTIFIC_KEYS,
    numberKeys: NUMBER_KEYS.slice(4), calculatorSource: UPSTREAM.repository,
  }),
  onLoad() {
    const saved = wx.getStorageSync(STATE_KEY)
    const state = saved && typeof saved === 'object' ? saved : {}
    const expression = typeof state.expression === 'string' ? state.expression.slice(0, MAX_INPUT) : ''
    this.__justEvaluated = Boolean(state.justEvaluated)
    this.__replayAnswer = typeof state.replayAnswer === 'number' ? finite(state.replayAnswer) : undefined
    this.setData({ expression, cursor: cursorIn(state.cursor, expression), answer: finite(state.answer), memory: finite(state.memory), memoryDisplay: formatNumber(finite(state.memory)), angleMode: state.angleMode === 'RAD' ? 'RAD' : 'DEG', hasResult: Boolean(state.hasResult), display: typeof state.display === 'string' ? state.display.slice(0, 40) : '0', history: readHistory() })
  },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  onUnload() { this.persistState() },
  goBack() { wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/index/index' }) }) },
  persistState() {
    try {
      const { expression, cursor, display, answer, memory, angleMode, hasResult } = this.data
      wx.setStorageSync(STATE_KEY, { expression, cursor, display, answer, memory, angleMode, hasResult, justEvaluated: Boolean(this.__justEvaluated), replayAnswer: this.__replayAnswer })
    } catch { this.setData({ error: '无法保存到本机，请检查存储空间。' }) }
  },
  onInput(event) {
    const expression = String(event.detail.value || '').slice(0, MAX_INPUT)
    if (this.__justEvaluated) this.__replayAnswer = undefined
    this.__justEvaluated = false
    this.setData({ expression, cursor: cursorIn(event.detail.cursor, expression), display: expression ? '' : '0', hasResult: false, error: '' })
    this.persistState()
  },
  onEditorFocus() { this.__justEvaluated = false },
  onEditorBlur(event) { this.setData({ cursor: cursorIn(event.detail.cursor, this.data.expression) }) },
  onConfirm() { this.runAction('equals') },
  append(value) {
    const text = String(value || '')
    if (!text) return
    let current = this.data.expression || ''
    let cursor = cursorIn(this.data.cursor, current)
    if (this.__justEvaluated) {
      current = /^[+*/^!%\-]/.test(text) ? 'ans' : ''
      cursor = current.length
      this.__replayAnswer = undefined
    }
    const expression = current.slice(0, cursor) + text + current.slice(cursor)
    if (expression.length > MAX_INPUT) return this.setData({ error: '算式最多 500 个字符。' })
    this.__justEvaluated = false
    this.setData({ expression, cursor: cursor + text.length, display: '', hasResult: false, error: '' })
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
    if (action === 'shift') return this.setData({ shiftActive: !this.data.shiftActive, showScientific: true, error: '' })
    if (action === 'clear') {
      this.__justEvaluated = false; this.__replayAnswer = undefined
      this.setData({ expression: '', cursor: 0, display: '0', hasResult: false, error: '', shiftActive: false })
      return this.persistState()
    }
    if (action === 'delete') {
      const current = String(this.data.expression || '')
      const cursor = cursorIn(this.data.cursor, current)
      if (!cursor) return
      const expression = current.slice(0, cursor - 1) + current.slice(cursor)
      this.__justEvaluated = false
      this.setData({ expression, cursor: cursor - 1, display: expression ? '' : '0', hasResult: false, error: '' })
      return this.persistState()
    }
    if (action === 'left' || action === 'right') {
      this.__justEvaluated = false
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
      const result = evaluateExpression(expression, { angleMode: this.data.angleMode, answer: answerBasis })
      const display = formatNumber(result)
      const entry = { expression, result: display, answerBasis, angleMode: this.data.angleMode, at: Date.now() }
      const previous = this.data.history[0]
      const same = previous && previous.expression === expression && previous.result === display && previous.answerBasis === answerBasis && previous.angleMode === entry.angleMode
      const history = same ? this.data.history : [entry, ...this.data.history].slice(0, MAX_HISTORY)
      this.__justEvaluated = true; this.__lastAnswerBasis = answerBasis; this.__replayAnswer = answerBasis
      this.setData({ expression, cursor: expression.length, display, answer: result, history, hasResult: true, error: '' })
      try { wx.setStorageSync(HISTORY_KEY, history) } catch { this.setData({ error: '结果已计算，但历史未能保存。' }) }
      this.persistState()
      return result
    } catch (error) {
      this.__justEvaluated = false
      this.setData({ hasResult: false, display: '', error: error.message || '算式无法计算，请检查输入。' })
    }
  },
  toggleScientific() { this.setData({ showScientific: !this.data.showScientific, shiftActive: false }) },
  toggleMemory() { this.setData({ showMemory: !this.data.showMemory }) },
  toggleHistory() { this.runAction('history') },
  restoreHistory(event) {
    const item = this.data.history[Number(event.currentTarget.dataset.index)]
    if (!item) return
    if (/ans/i.test(item.expression) && !Number.isFinite(item.answerBasis)) return this.setData({ error: '这条旧记录缺少 Ans 数值，请重新输入。' })
    this.__justEvaluated = false; this.__replayAnswer = Number.isFinite(item.answerBasis) ? item.answerBasis : undefined
    this.setData({ expression: item.expression, cursor: item.expression.length, display: '', hasResult: false, error: '', showHistory: false, angleMode: item.angleMode === 'RAD' ? 'RAD' : 'DEG' })
    this.persistState()
  },
  clearHistory() {
    wx.showModal({ title: '清空计算历史？', confirmText: '清空', success: ({ confirm }) => {
      if (!confirm) return
      try { wx.removeStorageSync(HISTORY_KEY); this.setData({ history: [], showHistory: false }) } catch { this.setData({ error: '历史未能清空，请重试。' }) }
    } })
  },
})
