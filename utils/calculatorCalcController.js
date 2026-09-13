const { evaluateExpression, formatNumber, tokenize } = require('./calculator')
const { insertKey, insertTemplate, removeBackward, moveCursor, verticalCursor } = require('./cwEditor')

const VARIABLE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z']

function expressionVariables(expression, complex = false) {
  const seen = new Set()
  return tokenize(expression, { complex })
    .filter(token => token.type === 'identifier' && VARIABLE_NAMES.includes(token.raw) && !seen.has(token.raw) && seen.add(token.raw))
    .map(token => token.raw)
}

const initialText = value => typeof value === 'number' && Number.isFinite(value) ? formatNumber(value) : '0'

const calcMethods = {
  renderCalcInput() {
    if (this.__disposed || this.data.calcPhase !== 'input') return
    const value = this.data.calcInputText
    const cursor = this.data.calcInputCursor
    this.setData({ calcInputDisplay: this.data.calcInputFresh ? value : value.slice(0, cursor) + '▏' + value.slice(cursor) })
  },
  startCalcInput() {
    if (this.__disposed || this.data.calculatorModel !== 'cnx' || this.data.powerOff) return
    if (this.data.solverPhase) this.leaveSolver()
    const expression = String(this.data.expression || '').trim()
    if (!expression) { this.setData({ error: '先输入含变量的算式。' }); return }
    if (expression.includes('=')) { this.setData({ error: 'CALC 用于代入变量；含等号的方程请按 SHIFT + CALC 使用 SOLVE。' }); return }
    let variables
    try { variables = expressionVariables(expression, this.data.calculatorApp === 'complex') }
    catch (error) { this.setData({ error: error.message || '算式无法读取。' }); return }
    if (!variables.length) { this.calculate(); return }
    this.finishNativeEditor()
    this.closeMenu()
    const name = variables[0]
    const value = initialText(this.data.variables[name])
    this.setData({
      calcPhase: 'input', calcExpression: expression, calcVariables: variables,
      calcVariableIndex: 0, calcVariable: name, calcInputText: value,
      calcInputCursor: value.length, calcInputDisplay: value, calcInputFresh: true,
      hasResult: false, display: '', error: '', shiftActive: false, alphaActive: false,
    })
    this.persistState()
  },
  leaveCalc() {
    if (!this.data.calcPhase) return
    this.setData({ calcPhase: '', calcExpression: '', calcVariables: [], calcVariableIndex: 0, calcVariable: '', calcInputText: '0', calcInputCursor: 1, calcInputDisplay: '0', calcInputFresh: true, error: '' })
    this.persistState()
  },
  calcAppend(value, template) {
    if (this.__disposed || this.data.calcPhase !== 'input') return false
    const text = this.data.calcInputFresh ? '' : this.data.calcInputText
    const cursor = this.data.calcInputFresh ? 0 : this.data.calcInputCursor
    const inserted = template ? insertTemplate(text, cursor, template) : insertKey(text, cursor, String(value))
    if (inserted.expression.length > 500) { this.setData({ error: '变量值最多 500 个字符。' }); return true }
    this.setData({ calcInputText: inserted.expression, calcInputCursor: inserted.cursor, calcInputFresh: false, error: '' })
    this.renderCalcInput()
    this.persistState()
    return true
  },
  commitCalcValue() {
    if (this.data.calcPhase !== 'input') return
    try {
      const value = evaluateExpression(this.data.calcInputText, { angleMode: this.data.angleMode, answer: this.data.answer, variables: this.data.variables, functions: this.data.functions })
      const variables = { ...this.data.variables, [this.data.calcVariable]: value }
      const nextIndex = this.data.calcVariableIndex + 1
      if (nextIndex >= this.data.calcVariables.length) {
        this.setData({ variables, calcPhase: 'ready', calcVariableIndex: nextIndex, calcVariable: '', calcInputFresh: true, error: '' })
      } else {
        const name = this.data.calcVariables[nextIndex]
        const text = initialText(variables[name])
        this.setData({ variables, calcVariableIndex: nextIndex, calcVariable: name, calcInputText: text, calcInputCursor: text.length, calcInputDisplay: text, calcInputFresh: true, error: '' })
      }
      this.persistState()
    } catch (error) { this.setData({ error: error.message || '变量值无法计算。' }) }
  },
  executeCalc() {
    if (this.data.calcPhase !== 'ready') return
    this.setData({ calcPhase: '', error: '' })
    this.calculate()
  },
  startCnxSolver() {
    if (this.__disposed || this.data.calculatorModel !== 'cnx' || this.data.powerOff) return
    if (this.data.calculatorApp !== 'calculate') { this.setData({ error: 'SOLVE 仅在 CN X 的计算模式中使用。' }); return }
    if (this.data.calcPhase) this.leaveCalc()
    const equation = String(this.data.expression || '').trim()
    if (!equation) { this.setData({ error: '先输入含变量的方程或算式。' }); return }
    this.setData({ solverEquation: equation })
    this.openSolver()
    this.registerSolverEquation()
    if (this.data.solverPhase === 'target' && this.data.solverTargets.length === 1) {
      this.chooseSolverTarget({ currentTarget: { dataset: { name: this.data.solverTargets[0] } } })
    }
  },
  handleCalcAction(action) {
    if (!this.data.calcPhase || this.data.powerOff) return false
    if (['home', 'power-off', 'on'].includes(action)) { this.leaveCalc(); return false }
    if (this.data.calcPhase === 'ready') {
      if (['equals', 'ok', 'equals-decimal'].includes(action)) { this.executeCalc(); return true }
      if (action === 'back' || action === 'left') {
        const index = Math.max(0, this.data.calcVariables.length - 1)
        const name = this.data.calcVariables[index]
        const text = initialText(this.data.variables[name])
        this.setData({ calcPhase: 'input', calcVariableIndex: index, calcVariable: name, calcInputText: text, calcInputCursor: text.length, calcInputDisplay: text, calcInputFresh: true, error: '' })
        return true
      }
      if (action === 'clear') { this.leaveCalc(); return true }
      return !['shift', 'alpha', 'settings', 'catalog', 'variables'].includes(action)
    }
    if (['equals', 'ok', 'equals-decimal'].includes(action)) { this.commitCalcValue(); return true }
    if (action === 'back' || action === 'clear') { this.leaveCalc(); return true }
    if (action === 'delete') {
      const next = removeBackward(this.data.calcInputText, this.data.calcInputCursor)
      this.setData({ calcInputText: next.expression, calcInputCursor: next.cursor, calcInputFresh: false, error: '' })
      this.renderCalcInput(); this.persistState(); return true
    }
    if (action === 'left' || action === 'right') {
      this.setData({ calcInputCursor: moveCursor(this.data.calcInputText, this.data.calcInputCursor, action === 'left' ? -1 : 1), calcInputFresh: false })
      this.renderCalcInput(); return true
    }
    if (action === 'up' || action === 'down') {
      const cursor = verticalCursor(this.data.calcInputText, this.data.calcInputCursor, action)
      if (cursor !== null) this.setData({ calcInputCursor: cursor, calcInputFresh: false })
      this.renderCalcInput(); return true
    }
    const templates = { fraction: 'frac', 'mixed-input': 'mixed', 'root-input': 'root', 'log-input': 'logb', 'ncr-input': 'ncr', 'npr-input': 'npr', 'dms-input': 'dms' }
    if (templates[action]) return this.calcAppend('', templates[action])
    if (action === 'ans') return this.calcAppend('ans')
    return !['shift', 'alpha', 'settings', 'catalog', 'variables'].includes(action)
  },
}

module.exports = { calcMethods, expressionVariables }
