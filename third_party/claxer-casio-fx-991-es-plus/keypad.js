// Adapted from the MIT-licensed keypad grouping in
// https://github.com/Claxer/CASIO-FX-991-ES-PLUS at revision
// c80addc72aa02fa7bb33104fff25cdc348fa5d05.
//
// Only declarative key metadata is carried into the mini program. The
// upstream expression executor is deliberately excluded; Stemist evaluates
// expressions with its own deterministic parser in utils/calculator.js.

const UPSTREAM = Object.freeze({
  repository: 'https://github.com/Claxer/CASIO-FX-991-ES-PLUS',
  revision: 'c80addc72aa02fa7bb33104fff25cdc348fa5d05',
  license: 'MIT',
})

const MODE_KEYS = Object.freeze([
  { label: 'SHIFT', action: 'shift', tone: 'shift' },
  { label: 'DEG / RAD', action: 'angle', tone: 'mode' },
  { label: 'DEL', action: 'delete', tone: 'danger' },
  { label: 'AC', action: 'clear', tone: 'danger' },
])

const SCIENTIFIC_KEYS = Object.freeze([
  { label: 'x²', value: '^2', shiftLabel: 'x³', shiftValue: '^3', tone: 'function' },
  { label: '√', value: 'sqrt(', shiftLabel: '∛', shiftValue: 'cbrt(', tone: 'function' },
  { label: 'xʸ', value: '^', shiftLabel: '1/x', shiftValue: '^-1', tone: 'function' },
  { label: 'x!', value: '!', shiftLabel: '|x|', shiftValue: 'abs(', tone: 'function' },
  { label: 'sin', value: 'sin(', shiftLabel: 'sin⁻¹', shiftValue: 'asin(', tone: 'function' },
  { label: 'cos', value: 'cos(', shiftLabel: 'cos⁻¹', shiftValue: 'acos(', tone: 'function' },
  { label: 'tan', value: 'tan(', shiftLabel: 'tan⁻¹', shiftValue: 'atan(', tone: 'function' },
  { label: 'log', value: 'log(', shiftLabel: '10ˣ', shiftValue: '10^(', tone: 'function' },
  { label: 'ln', value: 'ln(', shiftLabel: 'eˣ', shiftValue: 'exp(', tone: 'function' },
  { label: '%', value: '%', shiftLabel: 'π', shiftValue: 'pi', tone: 'function' },
  { label: 'π', value: 'pi', shiftLabel: 'e', shiftValue: 'e', tone: 'constant' },
  { label: 'Ans', action: 'ans', shiftLabel: 'MR', shiftAction: 'memoryRecall', tone: 'constant' },
])

const NUMBER_KEYS = Object.freeze([
  { label: '(', value: '(', tone: 'operator' },
  { label: ')', value: ')', tone: 'operator' },
  { label: 'π', value: 'pi', tone: 'constant' },
  { label: 'e', value: 'e', tone: 'constant' },
  { label: '7', value: '7' },
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '÷', value: '/', tone: 'operator' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
  { label: '×', value: '*', tone: 'operator' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '−', value: '-', tone: 'operator' },
  { label: '0', value: '0' },
  { label: '.', value: '.' },
  { label: 'Ans', action: 'ans', tone: 'constant' },
  { label: '+', value: '+', tone: 'operator' },
])

module.exports = { MODE_KEYS, NUMBER_KEYS, SCIENTIFIC_KEYS, UPSTREAM }
