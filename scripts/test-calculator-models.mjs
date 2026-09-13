import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime } from './helpers/mini-runtime.mjs'

const navigationTitles = []
const runtime = miniRuntime({ wx: { setNavigationBarTitle: ({ title }) => navigationTitles.push(title) } })
const models = runtime.load('utils/calculatorModels')
const page = runtime.page('pages/calculator/index')
page.onLoad()

const keys = () => [
  ...page.data.controlKeys,
  ...page.data.scientificRows.flatMap(row => row.keys),
  ...page.data.numberRows.flatMap(row => row.keys),
]
const key = id => {
  const value = keys().find(item => item.id === id)
  assert.ok(value, `missing key ${id}`)
  return value
}
const press = id => page.press({ currentTarget: { dataset: key(id) } })
const chooseModel = model => page.selectCalculatorModel({ currentTarget: { dataset: { model } } })
const clear = () => {
  page.leaveCalc?.()
  page.leaveSolver?.()
  page.closeMenu()
  page.setData({ powerOff: false, shiftActive: false, alphaActive: false })
  page.runAction('clear')
}

assert.deepEqual(Array.from(models.CALCULATOR_MODELS, item => item.id), ['cw', 'cnx'])
assert.equal(models.getCalculatorModel('__proto__').id, 'cw')
assert.equal(models.getCalculatorModel('constructor').id, 'cw')
assert.equal(models.getCalculatorModel('unknown').id, 'cw')
assert.equal(page.data.calculatorModel, 'cw', 'existing users keep fx-991CW by default')
assert.equal(navigationTitles.at(-1), 'fx-991CW · 学习计算器')

const cnx = models.getCalculatorModel('cnx')
const cnxKeys = [
  ...cnx.controlKeys,
  ...cnx.scientificRows.flatMap(row => row.keys),
  ...cnx.numberRows.flatMap(row => row.keys),
]
const cnxKey = id => cnxKeys.find(item => item.id === id)

assert.equal(cnxKey('menu').action, 'home')
assert.equal(cnxKey('menu').shiftAction, 'settings')
assert.equal(cnxKey('calc').action, 'cnx-calc')
assert.equal(cnxKey('calc').shiftAction, 'cnx-solve')
assert.equal(cnxKey('calc').alphaAction, 'cnx-equation-equals')
assert.equal(cnxKey('eng').alphaAction, 'complex-i')
assert.deepEqual(
  Array.from(['negative', 'dms', 'reciprocal', 'sin', 'cos', 'tan', 'close-paren', 'standard-decimal', 'exponent'], id => cnxKey(id).alphaValue),
  ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'e'],
)
assert.deepEqual(Array.from(cnx.homeApps, item => item.label), ['计算', '复数', '基数', '矩阵', '向量', '统计', '表格', '方程/函数', '不等式', '比例'])
assert.deepEqual(Array.from(cnx.homeApps).filter(item => item.available === false).map(item => item.id), ['app-matrix', 'app-vector', 'app-inequality'])

page.setData({ expression: '2+A', cursor: 3, memory: 7, variables: { ...page.data.variables, A: 4 } })
page.calculate()
const historyLength = page.data.history.length
chooseModel('cnx')
assert.equal(page.data.calculatorModel, 'cnx')
assert.equal(navigationTitles.at(-1), 'fx-991CN X · 学习计算器')
assert.equal(page.data.expression, '2+A', 'switching models keeps the current input')
assert.equal(page.data.variables.A, 4, 'switching models keeps variables')
assert.equal(page.data.memory, 7, 'switching models keeps memory')
assert.equal(page.data.history.length, historyLength, 'switching models keeps history')
assert.equal(key('calc').label, 'CALC')
page.flushState()
const restored = runtime.page('pages/calculator/index')
restored.onLoad()
assert.equal(restored.data.calculatorModel, 'cnx', 'model selection persists')
assert.equal(restored.data.expression, '2+A')
assert.equal(restored.data.variables.A, 4)
assert.equal(restored.data.history.length, historyLength)

clear()
press('alpha')
assert.equal(page.data.alphaActive, true)
assert.equal(page.data.shiftActive, false)
press('negative')
assert.equal(page.data.expression, 'A')
assert.equal(page.data.alphaActive, false, 'ALPHA is consumed by one key')

clear()
press('shift')
press('sin')
assert.equal(page.data.expression, 'asin()')
assert.equal(page.data.shiftActive, false, 'SHIFT is consumed by one key')

clear()
press('alpha')
press('close-paren')
press('square')
press('alpha')
press('calc')
press('2')
assert.equal(page.data.expression, 'x^(2)=2', 'ALPHA + CALC enters the equation equals sign')

clear()
page.switchCalculatorApp('complex')
press('alpha')
press('eng')
assert.equal(page.data.expression, 'i', 'ALPHA + ENG enters i in Complex')

page.switchCalculatorApp('calculate')
clear()
page.onInput({ detail: { value: '3A+B', cursor: 4 } })
press('calc')
assert.equal(page.data.calcPhase, 'input')
assert.equal(page.data.calcVariable, 'A')
press('5')
press('equals')
assert.equal(page.data.calcVariable, 'B')
press('1')
press('0')
press('equals')
assert.equal(page.data.calcPhase, 'ready')
press('equals')
assert.equal(page.data.answer, 25)
assert.equal(page.data.expression, '3A+B')
assert.equal(page.data.variables.A, 5)
assert.equal(page.data.variables.B, 10)

clear()
page.onInput({ detail: { value: 'x^2-2', cursor: 5 } })
press('shift')
press('calc')
assert.equal(page.data.solverPhase, 'initial', 'SHIFT + CALC starts SOLVE from the current CN X expression')
press('1')
press('equals')
press('equals')
await page.__solverPromise
assert.equal(page.data.solverPhase, 'result')
assert.ok(Math.abs(page.data.solverResult.value - Math.sqrt(2)) < 1e-9)

page.leaveSolver()
press('menu')
assert.equal(page.data.menu, 'home')
assert.equal(page.data.menuTitle, '菜单')
assert.equal(page.data.menuItems.length, 10)
assert.equal(page.data.menuItems.find(item => item.id === 'app-matrix').available, false)

const markup = fs.readFileSync(new URL('../pages/calculator/index.wxml', import.meta.url), 'utf8')
const styles = fs.readFileSync(new URL('../pages/calculator/index.wxss', import.meta.url), 'utf8')
assert.match(markup, /calculator-model-switch/)
assert.match(markup, /data-alpha-action/)
assert.doesNotMatch(markup, /<web-view/)
assert.match(styles, /model-cnx/)
assert.match(styles, /device-tablet\.landscape[\s\S]*calculator-model-switch/)
assert.match(styles, /min-height:\s*44px/)
assert.match(styles, /\.model-cnx \.cw-direction-pad\s*\{[^}]*display:\s*none/)
assert.doesNotMatch(styles, /\.model-cnx \.cw-control-grid button\.cw-id-up[^}]*position:\s*absolute/)

page.onUnload()
console.log('Calculator models: CN X layout, one-shot modifiers, CALC/SOLVE, menu scope, persistence and responsive contracts passed.')
