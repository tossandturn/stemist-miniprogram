// A small, deterministic scientific-expression engine for the mini-program.
// It is intentionally parser-based: calculator input must never reach eval,
// Function(), a WebView, or a remote service.

const FUNCTIONS = new Set(['abs', 'acos', 'asin', 'atan', 'cbrt', 'cos', 'cosh', 'exp', 'ln', 'log', 'sin', 'sinh', 'sqrt', 'tan', 'tanh'])

function fail(message) { throw new Error(message) }

function factorial(value) {
  if (!Number.isInteger(value) || value < 0 || value > 170) fail('阶乘只支持 0–170 的整数')
  let result = 1
  for (let index = 2; index <= value; index += 1) result *= index
  return result
}

function tokenize(expression) {
  const source = String(expression || '')
    .replace(/[×✕]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/π/gi, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/\s+/g, '')
  const tokens = []
  let index = 0
  while (index < source.length) {
    const rest = source.slice(index)
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i)
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]) })
      if (!Number.isFinite(tokens[tokens.length - 1].value)) fail('数字超出范围')
      index += number[0].length
      continue
    }
    const identifier = rest.match(/^[a-zA-Z][a-zA-Z0-9_]*/)
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0].toLowerCase() })
      index += identifier[0].length
      continue
    }
    const symbol = source[index]
    if ('+-*/^!%()'.includes(symbol)) {
      tokens.push({ type: 'symbol', value: symbol })
      index += 1
      continue
    }
    fail(`无法识别的字符：${symbol}`)
  }
  if (!tokens.length) fail('请输入算式')
  return addImplicitMultiplication(tokens)
}

function canEndValue(token) {
  return token && (token.type === 'number' || token.value === 'pi' || token.value === 'e' || token.value === 'ans' || token.value === ')' || token.value === '!' || token.value === '%')
}

function canStartValue(token) {
  return token && (token.type === 'number' || token.type === 'identifier' || token.value === '(')
}

function addImplicitMultiplication(tokens) {
  const result = []
  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index]
    const next = tokens[index + 1]
    result.push(current)
    // `sin(` is a function call, while `2(`, `2pi`, `)sin(` and `2e`
    // are multiplication. Unknown identifiers are left for the parser to
    // reject with a useful message.
    if (canEndValue(current) && canStartValue(next) && !(current.type === 'identifier' && FUNCTIONS.has(current.value) && next.value === '(')) {
      result.push({ type: 'symbol', value: '*' })
    }
  }
  return result
}

function evaluateExpression(expression, { angleMode = 'DEG', answer = 0 } = {}) {
  const tokens = tokenize(expression)
  let cursor = 0
  const mode = String(angleMode || 'DEG').toUpperCase() === 'RAD' ? 'RAD' : 'DEG'
  const toRadians = (value) => mode === 'DEG' ? value * Math.PI / 180 : value
  const fromRadians = (value) => mode === 'DEG' ? value * 180 / Math.PI : value

  const peek = () => tokens[cursor]
  const take = () => tokens[cursor++]

  function parseAddSub() {
    let value = parseMulDiv()
    while (peek()?.value === '+' || peek()?.value === '-') {
      const operator = take().value
      const right = parseMulDiv()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  function parseMulDiv() {
    let value = parseUnary()
    while (peek()?.value === '*' || peek()?.value === '/') {
      const operator = take().value
      const right = parseUnary()
      if (operator === '/' && right === 0) fail('不能除以 0')
      value = operator === '*' ? value * right : value / right
    }
    return value
  }

  function parsePower() {
    const value = parsePostfix()
    if (peek()?.value !== '^') return value
    take()
    const exponent = parseUnary()
    return Math.pow(value, exponent)
  }

  function parseUnary() {
    if (peek()?.value === '+') { take(); return parseUnary() }
    if (peek()?.value === '-') { take(); return -parseUnary() }
    return parsePower()
  }

  function parsePostfix() {
    let value = parsePrimary()
    while (peek()?.value === '!' || peek()?.value === '%') {
      const operator = take().value
      value = operator === '!' ? factorial(value) : value / 100
    }
    return value
  }

  function parsePrimary() {
    const token = take()
    if (!token) fail('算式不完整')
    if (token.type === 'number') return token.value
    if (token.value === '(') {
      const value = parseAddSub()
      if (take()?.value !== ')') fail('括号不匹配')
      return value
    }
    if (token.type === 'identifier') {
      if (token.value === 'pi') return Math.PI
      if (token.value === 'e') return Math.E
      if (token.value === 'ans') return Number(answer) || 0
      if (!FUNCTIONS.has(token.value)) fail(`不支持的函数：${token.value}`)
      if (take()?.value !== '(') fail(`${token.value} 后需要括号`)
      const argument = parseAddSub()
      if (take()?.value !== ')') fail('函数括号不匹配')
      return applyFunction(token.value, argument, { toRadians, fromRadians })
    }
    fail('算式不完整')
  }

  const result = parseAddSub()
  if (cursor !== tokens.length) fail('算式中还有未处理的内容')
  if (!Number.isFinite(result)) fail('结果超出范围或不在定义域内')
  return result
}

function applyFunction(name, value, { toRadians, fromRadians }) {
  const functions = {
    abs: Math.abs,
    acos: (input) => fromRadians(Math.acos(input)),
    asin: (input) => fromRadians(Math.asin(input)),
    atan: (input) => fromRadians(Math.atan(input)),
    cbrt: Math.cbrt,
    cos: (input) => Math.cos(toRadians(input)),
    cosh: Math.cosh,
    exp: Math.exp,
    ln: Math.log,
    log: Math.log10,
    sin: (input) => Math.sin(toRadians(input)),
    sinh: Math.sinh,
    sqrt: Math.sqrt,
    tan: (input) => { const radians = toRadians(input); if (Math.abs(Math.cos(radians)) < 1e-14) fail('tan 的输入不在定义域内'); return Math.tan(radians) },
    tanh: Math.tanh,
  }
  const result = functions[name](value)
  if (!Number.isFinite(result)) fail(`${name} 的输入不在定义域内`)
  return result
}

function formatNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Error'
  if (number === 0) return '0'
  if (Number.isInteger(number) && Math.abs(number) < 1e15) return String(number)
  if (Math.abs(number) >= 1e12 || Math.abs(number) < 1e-8) return number.toExponential(8).replace(/\.?(?:0+)(?=e)/, '')
  return Number(number.toPrecision(12)).toString()
}

module.exports = { FUNCTIONS, evaluateExpression, factorial, formatNumber, tokenize }
