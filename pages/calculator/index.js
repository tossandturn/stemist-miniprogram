const { deviceState, syncDevice } = require('../../utils/page')
const { evaluateExpression, formatNumber } = require('../../utils/calculator')
const {
  MODE_KEYS,
  NUMBER_KEYS,
  SCIENTIFIC_KEYS,
  UPSTREAM,
} = require('../../third_party/claxer-casio-fx-991-es-plus/keypad')

const HISTORY_KEY = 'stemistCalculatorHistory'
const MAX_HISTORY = 20

const MEMORY_KEYS = [
  { label: 'M+', action: 'memoryAdd', tone: 'memory' },
  { label: 'M−', action: 'memorySub', tone: 'memory' },
  { label: 'MR', action: 'memoryRecall', tone: 'memory' },
  { label: 'MC', action: 'memoryClear', tone: 'memory' },
  { label: '复制结果', action: 'copy', tone: 'memory' },
]

function readHistory() {
  const value = wx.getStorageSync(HISTORY_KEY)
  return Array.isArray(value) ? value.filter((item) => item && item.expression && item.result !== undefined).slice(0, MAX_HISTORY) : []
}

function saveHistory(history) { wx.setStorageSync(HISTORY_KEY, history.slice(0, MAX_HISTORY)) }

Page({
  data: deviceState({
    expression: '',
    display: '0',
    answer: 0,
    angleMode: 'DEG',
    shiftActive: false,
    memory: 0,
    error: '',
    history: [],
    showHistory: false,
    modeKeys: MODE_KEYS,
    memoryKeys: MEMORY_KEYS,
    scientificKeys: SCIENTIFIC_KEYS,
    numberKeys: NUMBER_KEYS,
    calculatorSource: UPSTREAM.repository,
  }),
  onLoad() { this.__justEvaluated = false; this.setData({ history: readHistory() }) },
  onShow() { syncDevice(this) },
  onResize() { syncDevice(this) },
  goBack() { wx.navigateBack() },
  onInput(event) {
    const expression = String(event.detail.value || '').slice(0, 500)
    this.__justEvaluated = false
    this.setData({ expression, display: expression || '0', error: '' })
  },
  onConfirm() { this.runAction('equals') },
  append(value) {
    const text = String(value || '')
    if (!text) return
    const replaceAfterResult = this.__justEvaluated && (/^[0-9.]$/.test(text) || /^[a-zA-Z]+$/.test(text) || text === 'pi' || text === 'e' || text.endsWith('('))
    const expression = replaceAfterResult ? text : `${this.data.expression || ''}${text}`
    this.__justEvaluated = false
    this.setData({ expression, display: expression || '0', error: '' })
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
    if (action === 'shift') return this.setData({ shiftActive: !this.data.shiftActive, error: '' })
    if (action === 'clear') { this.__justEvaluated = false; return this.setData({ expression: '', display: '0', error: '', shiftActive: false }) }
    if (action === 'delete') {
      const expression = String(this.data.expression || '').slice(0, -1)
      this.__justEvaluated = false
      return this.setData({ expression, display: expression || '0', error: '' })
    }
    if (action === 'angle') {
      const angleMode = this.data.angleMode === 'DEG' ? 'RAD' : 'DEG'
      return this.setData({ angleMode, error: '' })
    }
    if (action === 'ans') return this.append('ans')
    if (action === 'memoryAdd' || action === 'memorySub') {
      const delta = Number(this.data.answer) || 0
      const memory = (Number(this.data.memory) || 0) + (action === 'memoryAdd' ? delta : -delta)
      return this.setData({ memory, error: '' })
    }
    if (action === 'memoryRecall') return this.append(formatNumber(this.data.memory))
    if (action === 'memoryClear') return this.setData({ memory: 0, error: '' })
    if (action === 'history') return this.setData({ showHistory: !this.data.showHistory })
    if (action === 'copy') {
      if (wx.setClipboardData) wx.setClipboardData({ data: String(this.data.display || '0') })
      return
    }
    if (action === 'equals') return this.calculate()
  },
  calculate() {
    const expression = String(this.data.expression || '').trim()
    if (!expression) return this.setData({ error: '先输入一个算式。' })
    try {
      const result = evaluateExpression(expression, { angleMode: this.data.angleMode, answer: this.data.answer })
      const display = formatNumber(result)
      const history = [{ expression, result: display, angleMode: this.data.angleMode, at: Date.now() }, ...this.data.history].slice(0, MAX_HISTORY)
      saveHistory(history)
      this.__justEvaluated = true
      this.setData({ expression: display, display, answer: result, history, error: '' })
    } catch (error) {
      this.__justEvaluated = false
      this.setData({ error: error.message || '算式无法计算，请检查输入。' })
    }
  },
  toggleHistory() { this.runAction('history') },
  restoreHistory(event) {
    const index = Number(event.currentTarget.dataset.index)
    const item = this.data.history[index]
    if (!item) return
    this.__justEvaluated = false
    this.setData({ expression: item.expression, display: item.expression, error: '', showHistory: false, angleMode: item.angleMode || this.data.angleMode })
  },
  clearHistory() { saveHistory([]); this.setData({ history: [], showHistory: false }) },
})
