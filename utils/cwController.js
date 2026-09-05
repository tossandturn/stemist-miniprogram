const { resultFormat, quadratic, linearSystem, statistics, numberTable, baseConvert } = require('./cwMath')
const { evaluateExpression, formatNumber } = require('./calculator')
const { HOME_APPS } = require('./cwKeypad')
const VARIABLES = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z']
const item = (id, label, detail = '') => ({ id, label, detail })
const MENUS = {
  home: HOME_APPS,
  settings: [item('angle-menu', 'Angle Unit'), item('output-menu', 'Number Format')],
  angle: [item('angle-DEG', 'Degree'), item('angle-RAD', 'Radian'), item('angle-GRAD', 'Gradian')],
  output: [item('format-decimal', 'Norm'), item('format-fixed', 'Fix · 6 decimal places'), item('format-scientific', 'Sci · 6 significant digits')],
  format: [item('format-decimal', 'Decimal'), item('format-fraction', 'Improper Fraction'), item('format-mixed', 'Mixed Fraction'), item('format-engineering', 'ENG Notation')],
  catalog: [item('catalog-analysis', 'Function Analysis'), item('catalog-probability', 'Probability'), item('catalog-trig', 'Trigonometric'), item('catalog-numeric', 'Numeric Calculations')],
  'catalog-analysis': [item('insert-sqrt(', 'Square root'), item('insert-cbrt(', 'Cube root'), item('action-root-input', 'Nth root'), item('insert-log(', 'log'), item('insert-ln(', 'ln'), item('insert-exp(', 'eˣ'), item('action-log-input', 'Logarithm base a')],
  'catalog-probability': [item('action-ncr-input', 'Combination · nCr'), item('action-npr-input', 'Permutation · nPr'), item('insert-!', 'Factorial · x!'), item('insert-%', 'Percent · %')],
  'catalog-trig': ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh'].map(f => item(`insert-${f}(`, f)),
  'catalog-numeric': [item('insert-abs(', 'Absolute value'), item('insert-floor(', 'Floor'), item('insert-ceil(', 'Ceiling'), item('insert-pi', 'π'), item('insert-e', 'e'), item('action-dms-input', 'Degree · minute · second')],
  functions: [item('define-f', 'Define f(x)'), item('define-g', 'Define g(x)'), item('insert-f(', 'Use f(x)'), item('insert-g(', 'Use g(x)')],
  tools: [item('history', 'Calculation history'), item('keyboard', 'Keyboard input'), item('copy', 'Copy result'), item('memory-menu', 'Memory'), item('about', 'About this calculator')],
  memory: [item('memoryAdd', 'M+'), item('memorySub', 'M−'), item('memoryRecall', 'MR'), item('memoryClear', 'MC')],
  equation: [item('work-quadratic', 'Polynomial · degree 2'), item('work-linear', 'Simultaneous · 2 unknowns')],
  'variable-actions': [item('recall-variable', 'Recall'), item('store-variable', 'Store current result')],
}
const TITLES = { home: 'HOME', settings: 'SETTINGS', angle: 'Angle Unit', output: 'Number Format', format: 'FORMAT', catalog: 'CATALOG', variables: 'VARIABLE', tools: 'TOOLS', functions: 'FUNCTION', memory: 'Memory', equation: 'Equation' }
const field = (id, label, value = '') => ({ id, label, value: String(value) })

const cwMethods = {
  renderExpression() {
    const text = this.data.expression
    // Fractions inserted by the template remain structured on the LCD. The
    // editable source expression is retained for precise cursor/history work.
    const parts = []; let from = 0, at = 0
    const pretty = text => text.replace(/ans/g, 'Ans').replace(/pi/g, 'π').replace(/sqrt\(/g, '√(').replace(/\*/g, '×').replace(/\//g, '÷').replace(/\^2\b/g, '²')
    while ((at = text.indexOf('frac(', from)) >= 0) {
      let depth = 1, comma = -1, end = at + 5
      for (; end < text.length && depth; end++) {
        if (text[end] === '(') depth++
        if (text[end] === ')') depth--
        if (text[end] === ',' && depth === 1) comma = end
      }
      if (depth || comma < 0) break
      if (at > from) parts.push({ kind: 'text', text: pretty(text.slice(from, at)) })
      parts.push({ kind: 'fraction', numerator: pretty(text.slice(at + 5, comma)), denominator: pretty(text.slice(comma + 1, end - 1)) })
      from = end
    }
    if (from < text.length || !parts.length) parts.push({ kind: 'text', text: pretty(text.slice(from)) || '0' })
    this.setData({ expressionParts: parts })
  },
  openMenu(menu, { reset = false } = {}) {
    if (reset) this.__menuStack = []
    else if (this.data.menu && this.data.menu !== menu) (this.__menuStack ||= []).push(this.data.menu)
    const entries = menu === 'variables' ? VARIABLES.map(name => item(`variable-${name}`, name, formatNumber(Number(this.data.variables[name]) || 0))) : menu === 'history' ? this.data.history.map((h,i)=>item(`history-${i}`,h.expression,'= '+h.result)) : MENUS[menu] || []
    this.setData({ menu, menuTitle: TITLES[menu] || menu.replace('catalog-', ''), menuItems: entries, menuIndex: 0, typing: false, error: '' })
  },
  closeMenu() { this.__menuStack = []; this.setData({ menu: '', menuItems: [], menuIndex: 0 }) },
  chooseMenu(event) { this.executeMenu(String(event.currentTarget.dataset.id || '')) },
  executeMenu(id) {
    if (!this.data.menuItems.some(entry => entry.id === id)) return
    if (['angle-menu', 'output-menu', 'memory-menu'].includes(id)) return this.openMenu(id.replace('-menu', ''))
    if (id.startsWith('catalog-')) return this.openMenu(id)
    if (id.startsWith('angle-')) { this.setData({ angleMode: id.slice(6) }); this.closeMenu(); return this.persistState() }
    if (id.startsWith('format-')) {
      const formatMode = id.slice(7)
      try {
        const formatted = this.data.hasResult ? resultFormat(this.data.answer, formatMode) : null
        this.setData({ formatMode, ...(formatted ? { display: formatted.text, formatted } : {}) })
        this.closeMenu(); this.persistState()
      } catch (error) { this.closeMenu(); this.setData({ error: error.message }) }
      return
    }
    if (id.startsWith('insert-')) { this.closeMenu(); this.append(id.slice(7)); return }
    if (id.startsWith('action-')) { this.closeMenu(); this.runAction(id.slice(7)); return }
    if (id.startsWith('app-')) {
      this.closeMenu()
      const app = id.slice(4)
      if (app === 'calculate') return
      if (app === 'equation') return this.openMenu('equation')
      return this.openWorkbench(app)
    }
    if (id.startsWith('work-')) { this.closeMenu(); this.openWorkbench(id.slice(5)); return }
    if (id.startsWith('define-')) { this.closeMenu(); this.openWorkbench(id); return }
    if (id.startsWith('variable-')) { this.__variable = id.slice(9); return this.openMenu('variable-actions') }
    if(id.startsWith('history-')) { this.closeMenu(); this.restoreHistory({currentTarget:{dataset:{index:Number(id.slice(8))}}}); return }
    if (id === 'recall-variable') { this.closeMenu(); this.append(this.__variable); return }
    if (id === 'store-variable') {
      const value = this.data.hasResult ? this.data.answer : this.calculate()
      if (!Number.isFinite(value) || !VARIABLES.includes(this.__variable)) { this.closeMenu(); return }
      this.setData({ variables: { ...this.data.variables, [this.__variable]: value } }); this.persistState(); return this.openMenu('variables', { reset: true })
    }
    this.closeMenu()
    if (id === 'history') { this.openMenu('history'); return }
    if (id === 'keyboard') { this.setData({ typing: true }); return }
    if (id === 'about') { this.setData({ workbench: 'about', workTitle: 'fx-991CW 学习计算器', workFields: [], workResults: [], workError: '' }); return }
    this.runAction(id)
  },
  handleCwAction(action) {
    if (this.data.powerOff && action !== 'on') return true
    if (action === 'on' || action === 'power-off') { this.closeMenu(); this.setData({ powerOff: action === 'power-off', shiftActive: false, error: '' }); return true }
    if (['home', 'settings', 'catalog', 'variables', 'tools', 'functions', 'format'].includes(action)) {
      if (action === 'format' && !this.data.hasResult) { this.setData({ error: '先按 EXE 得到结果，再选择显示格式。' }); return true }
      this.openMenu(action, { reset: true }); return true
    }
    if (action === 'back') {
      if (this.data.workbench) this.closeWorkbench()
      else if (this.__menuStack?.length) { const previous = this.__menuStack.pop(); this.setData({ menu: '' }); this.openMenu(previous) }
      else { this.closeMenu(); this.setData({ typing: false, error: '' }) }
      return true
    }
    if (this.data.menu && ['up', 'down', 'left', 'right', 'page-up', 'page-down'].includes(action)) {
      const count = this.data.menuItems.length
      const delta = action === 'page-up' ? -3 : action === 'page-down' ? 3 : ['up', 'left'].includes(action) ? -1 : 1
      const step = this.data.menu === 'home' && ['up', 'down'].includes(action) ? delta * 3 : delta
      this.setData({ menuIndex: Math.max(0, Math.min(count - 1, this.data.menuIndex + step)) }); return true
    }
    if (this.data.menu && ['equals', 'ok', 'equals-decimal'].includes(action)) { this.executeMenu(this.data.menuItems[this.data.menuIndex]?.id); return true }
    if (this.data.menu && action === 'clear') { this.closeMenu(); return true }
    if (['up', 'down', 'page-up', 'page-down'].includes(action)) {
      if (!this.data.history.length) return true
      const step = action === 'up' || action === 'page-up' ? 1 : -1
      this.__historyIndex = Math.max(0, Math.min(this.data.history.length - 1, (this.__historyIndex ?? -1) + step))
      this.restoreHistory({ currentTarget: { dataset: { index: this.__historyIndex } } }); return true
    }
    if (action === 'ok') { this.calculate(); return true }
    if (action === 'equals-decimal') { this.setData({ formatMode: 'decimal' }); this.calculate(); return true }
    if (action === 'insert-mode') { this.setData({ overwrite: !this.data.overwrite }); return true }
    if (['fraction', 'mixed-input', 'root-input', 'log-input', 'ncr-input', 'npr-input', 'dms-input'].includes(action)) { this.openWorkbench(action); return true }
    return false
  },
  enableTyping() { if (!this.data.powerOff) this.setData({ typing: true }) },
  openWorkbench(kind) {
    const definitions = {
      fraction: ['Fraction', [field('numerator', '分子'), field('denominator', '分母')]],
      'mixed-input': ['Mixed fraction', [field('whole', '整数部分'), field('numerator', '分子'), field('denominator', '分母')]],
      'root-input': ['Nth root', [field('degree', '根指数 n', 3), field('value', '被开方数')]],
      'log-input': ['Logarithm', [field('base', '底数 a', 10), field('value', '真数')]],
      'ncr-input': ['Combination · nCr', [field('n', 'n'), field('r', 'r')]],
      'npr-input': ['Permutation · nPr', [field('n', 'n'), field('r', 'r')]],
      'dms-input': ['Degree · minute · second', [field('degrees', '度', 0), field('minutes', '分', 0), field('seconds', '秒', 0)]],
      statistics: ['Statistics · 1-Variable', [field('values', '数据（逗号或空格分隔）')]],
      table: ['Table', [field('expression', 'f(x)', this.data.functions.f || 'x^2'), field('start', 'Start', -1), field('end', 'End', 1), field('step', 'Step', 1)]],
      quadratic: ['ax² + bx + c = 0', [field('a', 'a', 1), field('b', 'b', -5), field('c', 'c', 6)]],
      linear: ['ax + by = c · dx + ey = f', [field('row1', 'a, b, c', '2,1,5'), field('row2', 'd, e, f', '1,-1,1')]],
      ratio: ['a : b = c : x', [field('a', 'a'), field('b', 'b'), field('c', 'c')]],
      base: ['Base-N · 32-bit', [field('value', '整数'), field('from', '原进制（2 / 8 / 10 / 16）', 10), field('to', '目标进制', 2)]],
      'define-f': ['Define f(x)', [field('expression', 'f(x) =', this.data.functions.f || '')]],
      'define-g': ['Define g(x)', [field('expression', 'g(x) =', this.data.functions.g || '')]],
    }
    const definition = definitions[kind]
    if (!definition) return
    this.closeMenu()
    this.setData({ workbench: kind, workTitle: definition[0], workFields: definition[1], workResults: [], workError: '', typing: false, keyboardHeight:0, workSubmitLabel: kind === 'fraction' || kind.endsWith('-input') ? '输入算式' : kind.startsWith('define-') ? '保存函数' : '计算' })
  },
  onFieldInput(event) {
    const id = String(event.currentTarget.dataset.id)
    this.setData({ workFields: this.data.workFields.map(f => f.id === id ? { ...f, value: String(event.detail.value).slice(0, 500) } : f), workError: '', workResults: [] })
  },
  closeWorkbench() { this.setData({ workbench: '', workFields: [], workResults: [], workError: '', keyboardHeight:0 }) },
  onWorkbenchKeyboard(event) { this.setData({keyboardHeight:Math.max(0,Number(event.detail.height)||0)}) },
  keepDrawer() {},
  submitWorkbench() {
    const kind = this.data.workbench
    const values = Object.fromEntries(this.data.workFields.map(f => [f.id, f.value.trim()]))
    const context = { angleMode: this.data.angleMode, answer: this.data.answer, variables: this.data.variables, functions: this.data.functions }
    const value = key => { if (!values[key]) throw new Error('请填写所有参数'); return evaluateExpression(values[key], context) }
    const list = text => String(text || '').trim().split(/[\s,，;；]+/).filter(Boolean).map(v => evaluateExpression(v, context))
    const show = rows => this.setData({ workResults: rows.map(([label, value]) => ({ label, value: typeof value === 'number' ? formatNumber(value) : String(value) })), workError: '' })
    try {
      let insertion = ''
      if (kind === 'fraction' || kind === 'mixed-input') {
        value('numerator'); if (!value('denominator')) throw new Error('分母不能为 0')
        insertion = `frac(${values.numerator},${values.denominator})`
        if (kind === 'mixed-input') { const whole = value('whole'); if(!Number.isInteger(whole)||value('numerator')<0||value('denominator')<=0||value('numerator')>=value('denominator'))throw new Error('带分数需要整数部分和非负真分数'); insertion = `(${values.whole}${whole < 0 ? '-' : '+'}${insertion})` }
      }
      if (kind === 'root-input') insertion = `root(${value('degree')},${value('value')})`
      if (kind === 'log-input') insertion = `logb(${value('base')},${value('value')})`
      if (kind === 'ncr-input' || kind === 'npr-input') insertion = `${kind.slice(0, 3)}(${value('n')},${value('r')})`
      if (kind === 'dms-input') insertion = `dms(${value('degrees')},${value('minutes')},${value('seconds')})`
      if (insertion) { evaluateExpression(insertion, context); this.closeWorkbench(); this.append(insertion); return }
      if (kind.startsWith('define-')) {
        if (!values.expression) throw new Error('请输入函数定义')
        // Parse the whole grammar without assuming f(0) is in the domain.
        const { validateExpression } = require('./calculator'); validateExpression(values.expression)
        const name = kind.slice(7)
        if (new RegExp(`\\b${name}\\s*\\(`).test(values.expression)) throw new Error('函数不能递归调用自身')
        this.setData({ functions: { ...this.data.functions, [name]: values.expression } }); this.persistState(); this.closeWorkbench(); return
      }
      if (kind === 'statistics') {
        const s = statistics(list(values.values))
        return show([['n', s.n], ['x̄', s.mean], ['Σx', s.sum], ['σx', s.populationSd], ['sx', s.sampleSd === null ? 'n < 2' : s.sampleSd], ['min', s.min], ['max', s.max]])
      }
      if (kind === 'table') return show(numberTable(values.expression, value('start'), value('end'), value('step'), context).map(r => [`x = ${formatNumber(r.x)}`, r.y]))
      if (kind === 'quadratic') return show(quadratic(value('a'), value('b'), value('c')).map((v, i) => [`x${i + 1}`, v]))
      if (kind === 'linear') return show(linearSystem([list(values.row1), list(values.row2)]).map((v, i) => [i ? 'y' : 'x', v]))
      if (kind === 'ratio') { const a = value('a'); if (!a) throw new Error('a 不能为 0'); const x = value('b') * value('c') / a; if (!Number.isFinite(x)) throw new Error('结果超出范围'); return show([['x', x]]) }
      if (kind === 'base') return show([['Result', baseConvert(values.value, value('from'), value('to'))]])
    } catch (error) { this.setData({ workError: error.message || '请检查输入', workResults: [] }) }
  },
}
module.exports = { cwMethods, VARIABLES }
