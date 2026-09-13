const {
  CONTROL_KEYS: CW_CONTROL_KEYS,
  SCIENTIFIC_ROWS: CW_SCIENTIFIC_ROWS,
  NUMBER_ROWS: CW_NUMBER_ROWS,
  HOME_APPS: CW_HOME_APPS,
  UPSTREAM,
} = require('./cwKeypad')

const unsupported = message => `unsupported:${message}`

// fx-991CN X key positions and coloured legends are transcribed from Casio's
// Chinese product front view and Chinese user guide. Unsupported firmware
// functions stay explicit instead of being wired to an unrelated operation.
const CNX_CONTROL_KEYS = [
  { id: 'shift', label: 'SHIFT', text: '', action: 'shift', tone: 'shift', row: 1, col: 1 },
  { id: 'alpha', label: 'ALPHA', text: '', action: 'alpha', tone: 'alpha', row: 1, col: 2 },
  { id: 'up', label: '', face: 'up', action: 'up', pad: true, row: 1, col: 3 },
  { id: 'down', label: '', face: 'down', action: 'down', pad: true, row: 1, col: 4 },
  { id: 'menu', label: '菜单', text: '菜单', action: 'home', shiftLabel: '设置', shiftAction: 'settings', row: 1, col: 5 },
  { id: 'on', label: '开机', text: 'ON', action: 'on', row: 1, col: 6 },
  { id: 'optn', label: 'OPTN', text: 'OPTN', action: 'catalog', row: 2, col: 1 },
  { id: 'calc', label: 'CALC', text: 'CALC', action: 'cnx-calc', shiftLabel: 'SOLVE', shiftAction: 'cnx-solve', alphaLabel: '=', alphaAction: 'cnx-equation-equals', row: 2, col: 2 },
  { id: 'left', label: '', face: 'left', action: 'left', pad: true, row: 2, col: 3 },
  { id: 'right', label: '', face: 'right', action: 'right', pad: true, row: 2, col: 4 },
  { id: 'integral', label: '∫', text: '∫', action: unsupported('暂不支持积分/微分。'), shiftLabel: 'd/dx', row: 2, col: 5, unavailable: true },
  { id: 'x-key', label: 'x', text: 'x', value: 'x', shiftLabel: 'Σ', shiftAction: unsupported('暂不支持求和模板。'), row: 2, col: 6 },
]

const CNX_SCIENTIFIC_ROWS = [
  { id: 'templates', keys: [
    { id: 'fraction', label: '▱', face: 'fraction', action: 'fraction', shiftLabel: 'a b/c', shiftAction: 'mixed-input' },
    { id: 'sqrt', label: '√', face: 'root-slot', value: 'sqrt(', shiftLabel: '∛', shiftValue: 'cbrt(' },
    { id: 'square', label: 'x²', face: 'square-slot', value: '^2', shiftLabel: 'x³', shiftValue: '^3' },
    { id: 'power', label: 'x□', face: 'power-slots', value: '^(', shiftLabel: 'ⁿ√', shiftAction: 'root-input' },
    { id: 'log-base', label: 'log□', face: 'log-slots', action: 'log-input', shiftLabel: '10ˣ', shiftValue: '10^(' },
    { id: 'ln', label: 'ln', value: 'ln(', shiftLabel: 'eˣ', shiftValue: 'exp(' },
  ] },
  { id: 'scientific', keys: [
    { id: 'negative', label: '(−)', value: '⁻', shiftLabel: 'log', shiftValue: 'log(', alphaLabel: 'A', alphaValue: 'A' },
    { id: 'dms', label: '°′″', action: 'dms-input', shiftLabel: 'FACT', shiftAction: unsupported('暂不支持质因数分解。'), alphaLabel: 'B', alphaValue: 'B' },
    { id: 'reciprocal', label: 'x⁻¹', value: '^(-1)', shiftLabel: 'x!', shiftValue: '!', alphaLabel: 'C', alphaValue: 'C' },
    { id: 'sin', label: 'sin', value: 'sin(', shiftLabel: 'sin⁻¹', shiftValue: 'asin(', alphaLabel: 'D', alphaValue: 'D' },
    { id: 'cos', label: 'cos', value: 'cos(', shiftLabel: 'cos⁻¹', shiftValue: 'acos(', alphaLabel: 'E', alphaValue: 'E' },
    { id: 'tan', label: 'tan', value: 'tan(', shiftLabel: 'tan⁻¹', shiftValue: 'atan(', alphaLabel: 'F', alphaValue: 'F' },
  ] },
  { id: 'memory', keys: [
    { id: 'sto', label: 'STO', action: 'variables', shiftLabel: '调用', shiftAction: 'variables' },
    { id: 'eng', label: 'ENG', action: 'engineering-format', shiftLabel: '∠', shiftValue: '∠', alphaLabel: 'i', alphaAction: 'complex-i' },
    { id: 'open-paren', label: '(', value: '(', shiftLabel: 'Abs', shiftValue: 'abs(', alphaLabel: ',', alphaValue: ',' },
    { id: 'close-paren', label: ')', value: ')', shiftLabel: ',', shiftValue: ',', alphaLabel: 'x', alphaValue: 'x' },
    { id: 'standard-decimal', label: 'S⇔D', action: 'standard-decimal', shiftLabel: 'a b/c⇔d/c', shiftAction: 'fraction-cycle', alphaLabel: 'y', alphaValue: 'y' },
    { id: 'm-plus', label: 'M+', action: 'memoryAdd', shiftLabel: 'M−', shiftAction: 'memorySub', alphaLabel: 'M', alphaAction: 'memoryRecall' },
  ] },
]

const CNX_NUMBER_ROWS = [
  { id: 'top', keys: [
    { id: '7', label: '7', value: '7', shiftLabel: '科学常数', shiftAction: 'cnx-constants' },
    { id: '8', label: '8', value: '8', shiftLabel: '单位换算', shiftAction: unsupported('暂不支持单位换算。') },
    { id: '9', label: '9', value: '9', shiftLabel: '复位', shiftAction: unsupported('暂不支持整机复位。') },
    { id: 'del', label: 'DEL', action: 'delete', shiftLabel: '插入', shiftAction: 'insert-mode' },
    { id: 'ac', label: 'AC', action: 'clear', shiftLabel: '关机', shiftAction: 'power-off' },
  ] },
  { id: 'mid', keys: [
    { id: '4', label: '4', value: '4' },
    { id: '5', label: '5', value: '5' },
    { id: '6', label: '6', value: '6' },
    { id: 'multiply', label: '×', value: '*', shiftLabel: 'nPr', shiftAction: 'npr-input' },
    { id: 'divide', label: '÷', value: '/', shiftLabel: 'nCr', shiftAction: 'ncr-input' },
  ] },
  { id: 'low', keys: [
    { id: '1', label: '1', value: '1' },
    { id: '2', label: '2', value: '2' },
    { id: '3', label: '3', value: '3' },
    { id: 'plus', label: '+', value: '+', shiftLabel: 'Pol', shiftAction: unsupported('暂不支持 Pol 坐标转换。') },
    { id: 'minus', label: '−', value: '-', shiftLabel: 'Rec', shiftAction: unsupported('暂不支持 Rec 坐标转换。') },
  ] },
  { id: 'bottom', keys: [
    { id: '0', label: '0', value: '0', shiftLabel: 'Rnd', shiftAction: unsupported('暂不支持 Rnd 舍入。') },
    { id: 'dot', label: '.', value: '.', shiftLabel: 'Ran#', shiftAction: unsupported('暂不支持随机数。') },
    { id: 'exponent', label: '×10ˣ', value: '*10^(', shiftLabel: 'π', shiftValue: 'pi', alphaLabel: 'e', alphaValue: 'e' },
    { id: 'ans', label: 'Ans', action: 'ans', shiftLabel: '%', shiftValue: '%' },
    { id: 'equals', label: '=', action: 'equals', shiftLabel: '≈', shiftAction: 'equals-decimal', tone: 'execute' },
  ] },
]

const CNX_HOME_APPS = [
  { id: 'app-calculate', label: '计算', icon: '+ −', available: true },
  { id: 'app-complex', label: '复数', icon: 'a+bi', available: true },
  { id: 'app-base', label: '基数', icon: '₂ ₁₆', available: true },
  { id: 'app-matrix', label: '矩阵', icon: '[ ]', detail: '未开放', available: false },
  { id: 'app-vector', label: '向量', icon: '↗', detail: '未开放', available: false },
  { id: 'app-statistics', label: '统计', icon: 'x̄', available: true },
  { id: 'app-table', label: '表格', icon: 'f(x)', available: true },
  { id: 'app-equation', label: '方程/函数', icon: 'x=?', available: true },
  { id: 'app-inequality', label: '不等式', icon: 'x≷0', detail: '未开放', available: false },
  { id: 'app-ratio', label: '比例', icon: 'a:b', available: true },
]

const MODELS = {
  cw: {
    id: 'cw',
    title: 'fx-991CW',
    selectorLabel: 'fx-991CW',
    instrumentLabel: 'fx-991CW 键位',
    seriesLabel: 'CW · LEARNING',
    aboutTitle: 'fx-991CW 学习计算器',
    controlKeys: CW_CONTROL_KEYS,
    scientificRows: CW_SCIENTIFIC_ROWS,
    numberRows: CW_NUMBER_ROWS,
    homeApps: CW_HOME_APPS,
    source: UPSTREAM.repository,
  },
  cnx: {
    id: 'cnx',
    title: 'fx-991CN X',
    selectorLabel: 'fx-991CN X 中文版',
    instrumentLabel: 'fx-991CN X 键位',
    seriesLabel: 'CN X · LEARNING',
    aboutTitle: 'fx-991CN X 学习计算器',
    controlKeys: CNX_CONTROL_KEYS,
    scientificRows: CNX_SCIENTIFIC_ROWS,
    numberRows: CNX_NUMBER_ROWS,
    homeApps: CNX_HOME_APPS,
    source: 'https://www.casio.com.cn/scientific-calculators/product.FX-991CNX-BU/',
    manual: 'https://www.casio.com/content/dam/casio/global/support/manuals/calculators/pdf/004-zh-cn/f/fx-991CN_X_B_CN.pdf',
  },
}

const CALCULATOR_MODELS = [MODELS.cw, MODELS.cnx].map(({ id, selectorLabel, title }) => ({ id, selectorLabel, title }))
const getCalculatorModel = id => id === 'cnx' ? MODELS.cnx : MODELS.cw

module.exports = { CALCULATOR_MODELS, getCalculatorModel, CNX_CONTROL_KEYS, CNX_SCIENTIFIC_ROWS, CNX_NUMBER_ROWS, CNX_HOME_APPS }
