// CW positions are transcribed from Casio's international product front view.
// The existing MIT upstream contributes scientific key values, not a ROM or
// expression executor. Its attribution/license stays with that data module.
const { SCIENTIFIC_KEYS, UPSTREAM } = require('../third_party/claxer-casio-fx-991-es-plus/keypad')
const from = label => ({ ...SCIENTIFIC_KEYS.find(key => key.label === label) })
const CONTROL_KEYS = [
  { id: 'on', label: 'ON', face: 'power', action: 'on', row: 1, col: 1 },
  { id: 'home', label: 'HOME', face: 'home', action: 'home', row: 1, col: 2 },
  { id: 'up', label: '', face: 'up', action: 'up', row: 1, col: 4 },
  { id: 'page-up', label: '', face: 'page-up', action: 'page-up', row: 1, col: 6 },
  { id: 'settings', label: 'SETTINGS', face: 'settings', action: 'settings', row: 2, col: 1 },
  { id: 'back', label: '', face: 'back', action: 'back', row: 2, col: 2 },
  { id: 'left', label: '', face: 'left', action: 'left', row: 2, col: 3 },
  { id: 'ok', label: '', text: 'OK', action: 'ok', row: 2, col: 4 },
  { id: 'right', label: '', face: 'right', action: 'right', row: 2, col: 5 },
  { id: 'page-down', label: '', face: 'page-down', action: 'page-down', row: 2, col: 6 },
  { id: 'shift', label: 'SHIFT', text: '⇧', action: 'shift', tone: 'shift', row: 3, col: 1 },
  { id: 'variable', label: 'VARIABLE', text: 'x↔', action: 'variables', row: 3, col: 2 },
  { id: 'function', label: 'FUNCTION', text: 'f(x)', action: 'functions', row: 3, col: 3 },
  { id: 'down', label: '', face: 'down', action: 'down', row: 3, col: 4 },
  { id: 'catalog', label: 'CATALOG', face: 'book', action: 'catalog', row: 3, col: 5 },
  { id: 'tools', label: 'TOOLS', text: '···', action: 'tools', row: 3, col: 6 },
]
const SCIENTIFIC_ROWS = [
  { id: 'powers', keys: [
    { id: 'x', label: 'x', value: 'x' },
    { id: 'fraction', label: '▱', face: 'fraction', action: 'fraction', shiftLabel: 'a b/c', shiftAction: 'mixed-input' },
    { id: 'sqrt', label: '√', value: 'sqrt(', shiftLabel: 'ⁿ√', shiftAction: 'root-input' },
    { id: 'power', label: 'xʸ', value: '^(', shiftLabel: 'x⁻¹', shiftValue: '^(-1)' },
    { id: 'square', label: 'x²', value: '^2', shiftLabel: 'log', shiftValue: 'log(' },
    { id: 'log-base', label: 'logₐ', action: 'log-input', shiftLabel: 'ln', shiftValue: 'ln(' },
  ] },
  { id: 'trig', keys: [
    { id: 'ans', label: 'Ans', action: 'ans' },
    { ...from('sin'), id: 'sin' }, { ...from('cos'), id: 'cos' }, { ...from('tan'), id: 'tan' },
    { id: 'open-paren', label: '(', value: '(' },
    { id: 'close-paren', label: ')', value: ')', shiftLabel: ',', shiftValue: ',' },
  ] },
]
const NUMBER_ROWS = [
  { id: 'top', keys: [
    { id: '7', label: '7', value: '7', shiftLabel: 'π', shiftValue: 'pi' },
    { id: '8', label: '8', value: '8', shiftLabel: 'e', shiftValue: 'e' },
    { id: '9', label: '9', value: '9' },
    { id: 'del', label: 'DEL', action: 'delete', shiftLabel: 'INS', shiftAction: 'insert-mode' },
    { id: 'ac', label: 'AC', action: 'clear', shiftLabel: 'OFF', shiftAction: 'power-off' },
  ] },
  { id: 'mid', keys: [
    { id: '4', label: '4', value: '4', shiftLabel: 'A', shiftValue: 'A' },
    { id: '5', label: '5', value: '5', shiftLabel: 'B', shiftValue: 'B' },
    { id: '6', label: '6', value: '6', shiftLabel: 'C', shiftValue: 'C' },
    { id: 'multiply', label: '×', value: '*' }, { id: 'divide', label: '÷', value: '/' },
  ] },
  { id: 'low', keys: [
    { id: '1', label: '1', value: '1', shiftLabel: 'D', shiftValue: 'D' },
    { id: '2', label: '2', value: '2', shiftLabel: 'E', shiftValue: 'E' },
    { id: '3', label: '3', value: '3', shiftLabel: 'F', shiftValue: 'F' },
    { id: 'plus', label: '+', value: '+', shiftLabel: '° ′ ″', shiftAction: 'dms-input' },
    { id: 'minus', label: '−', value: '-', shiftLabel: '(−)', shiftValue: '-' },
  ] },
  { id: 'bottom', keys: [
    { id: '0', label: '0', value: '0', shiftLabel: 'x', shiftValue: 'x' },
    { id: 'dot', label: '.', value: '.', shiftLabel: 'y', shiftValue: 'y' },
    { id: 'exponent', label: '×10ˣ', value: '*10^(', shiftLabel: 'z', shiftValue: 'z' },
    { id: 'format', label: 'FORMAT', action: 'format', tone: 'format' },
    { id: 'exe', label: 'EXE', action: 'equals', shiftLabel: '≈', shiftAction: 'equals-decimal', tone: 'execute' },
  ] },
]
const HOME_APPS = [
  { id: 'app-calculate', label: 'Calculate', icon: '+ −' },
  { id: 'app-statistics', label: 'Statistics', icon: 'x̄' },
  { id: 'app-table', label: 'Table', icon: 'f(x)' },
  { id: 'app-equation', label: 'Equation', icon: 'x = ?' },
  { id: 'app-ratio', label: 'Ratio', icon: 'a : b' },
  { id: 'app-base', label: 'Base-N', icon: '₂ ₁₆' },
]
module.exports = { CONTROL_KEYS, SCIENTIFIC_ROWS, NUMBER_ROWS, HOME_APPS, UPSTREAM }
