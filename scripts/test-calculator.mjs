import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'utils/calculator.js'), 'utf8')
const keypadSource = fs.readFileSync(path.join(root, 'third_party/claxer-casio-fx-991-es-plus/keypad.js'), 'utf8')
const executableSource = source.replace(/\/\/.*$/gm, '')
assert.doesNotMatch(executableSource, /\beval\s*\(|\bFunction\s*\(/, 'calculator engine must not execute arbitrary code')
assert.doesNotMatch(keypadSource.replace(/\/\/.*$/gm, ''), /\beval\s*\(|\bFunction\s*\(/, 'ported keypad metadata must stay declarative')
const module = { exports: {} }
vm.runInNewContext(source, { module, exports: module.exports, Set, Math, Number, String, Error })
const { evaluateExpression, formatNumber, tokenize } = module.exports
const keypadModule = { exports: {} }
vm.runInNewContext(keypadSource, { module: keypadModule, exports: keypadModule.exports, Object })
assert.equal(keypadModule.exports.UPSTREAM.license, 'MIT')
assert.equal(keypadModule.exports.UPSTREAM.revision, 'c80addc72aa02fa7bb33104fff25cdc348fa5d05')
assert.ok(keypadModule.exports.SCIENTIFIC_KEYS.some((key) => key.shiftValue === 'asin('))
const pageSource = fs.readFileSync(path.join(root, 'pages/calculator/index.js'), 'utf8')
const pageMarkup = fs.readFileSync(path.join(root, 'pages/calculator/index.wxml'), 'utf8')
assert.match(pageSource, /onConfirm\(\)\s*\{\s*this\.runAction\('equals'\)/, 'calculator input confirm must evaluate')
assert.match(pageMarkup, /bindconfirm="onConfirm"/, 'calculator input must use the explicit confirm handler')
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual}`)
close(evaluateExpression('2+3*4'), 14, 'operator precedence')
close(evaluateExpression('2(3+4)'), 14, 'implicit multiplication')
close(evaluateExpression('sin(30)'), 0.5, 'degree trigonometry')
close(evaluateExpression('sin(pi/2)', { angleMode: 'RAD' }), 1, 'radian trigonometry')
close(evaluateExpression('sqrt(9)+5!'), 123, 'scientific functions')
close(evaluateExpression('cbrt(27)+abs(-2)'), 5, 'ported secondary scientific functions')
close(evaluateExpression('10^(2)'), 100, 'shifted base-ten exponent')
close(evaluateExpression('-2^2'), -4, 'unary minus follows scientific-calculator exponent precedence')
close(evaluateExpression('2^-2'), 0.25, 'negative exponent')
close(evaluateExpression('50%'), 0.5, 'percentage')
close(evaluateExpression('ans+2', { answer: 3 }), 5, 'answer memory')
assert.equal(formatNumber(12), '12')
assert.notEqual(formatNumber(1e-13), '0', 'small nonzero physics values must not become zero')
assert.equal(JSON.stringify(keypadModule.exports.NUMBER_KEYS.slice(4, 8).map(key=>key.label)), JSON.stringify(['7', '8', '9', '÷']))
assert.equal(tokenize('2×π').length, 3)
assert.throws(() => evaluateExpression('1/0'), /不能除以 0/)
assert.throws(() => evaluateExpression('unknown(2)'), /不支持的函数/)
assert.throws(() => evaluateExpression('tan(90)'), /定义域/)
console.log('Safe scientific calculator engine passed.')
