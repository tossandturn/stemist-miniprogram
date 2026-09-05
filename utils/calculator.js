// A small, deterministic scientific-expression engine for the mini-program.
// It is intentionally parser-based: calculator input must never reach eval,
// Function(), a WebView, or a remote service.

const FUNCTIONS = new Set(['abs', 'acos', 'asin', 'atan', 'acosh', 'asinh', 'atanh', 'cbrt', 'cos', 'cosh', 'exp', 'ln', 'log', 'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'frac', 'root', 'logb', 'ncr', 'npr', 'dms', 'floor', 'ceil', 'f', 'g'])
const VARIABLE_NAMES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z'])

function fail(message) { throw new Error(message) }

function factorial(value) {
  if (!Number.isInteger(value) || value < 0 || value > 170) fail('阶乘只支持 0–170 的整数')
  let result = 1
  for (let index = 2; index <= value; index += 1) result *= index
  return result
}

function tokenize(expression) {
  if (String(expression || '').length > 500) fail('算式最多 500 个字符')
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
      tokens.push({ type: 'identifier', value: identifier[0].toLowerCase(), raw: identifier[0] })
      index += identifier[0].length
      continue
    }
    const symbol = source[index]
    if ('+-*/^!%(),'.includes(symbol)) {
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
  return token && (token.type === 'number' || VARIABLE_NAMES.has(token.raw) || token.value === 'pi' || token.value === 'e' || token.value === 'ans' || token.value === ')' || token.value === '!' || token.value === '%')
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
    if (canEndValue(current) && canStartValue(next) && !(current.type === 'identifier' && FUNCTIONS.has(current.value) && !VARIABLE_NAMES.has(current.raw) && next.value === '(')) {
      result.push({ type: 'symbol', value: '*', implicit: true })
    }
  }
  return result
}

function evaluateExpression(expression, { angleMode = 'DEG', answer = 0, variables = {}, functions = {}, functionDepth = 0, syntaxOnly = false } = {}) {
  if (functionDepth > 8) fail('函数递归层数过多')
  const tokens = tokenize(expression)
  let cursor = 0
  const mode = String(angleMode || 'DEG').toUpperCase()
  const scale = mode === 'RAD' ? 1 : mode === 'GRAD' ? Math.PI / 200 : Math.PI / 180
  const toRadians = value => value * scale
  const fromRadians = value => value / scale

  const peek = () => tokens[cursor]
  const take = () => tokens[cursor++]

  function parseAddSub() {
    let value = parseMulDiv()
    while (peek()?.value === '+' || peek()?.value === '-') {
      const operator = take().value
      const right = parseMulDiv()
      value = syntaxOnly ? 1 : operator === '+' ? value + right : value - right
    }
    return value
  }

  function parseMulDiv() {
    let value = parseImplicitProduct()
    while ((peek()?.value === '*' && !peek()?.implicit) || peek()?.value === '/') {
      const operator = take().value
      const right = parseImplicitProduct()
      if (!syntaxOnly && operator === '/' && right === 0) fail('不能除以 0')
      value = syntaxOnly ? 1 : operator === '*' ? value * right : value / right
    }
    return value
  }

  // CW groups omitted multiplication in a divisor, e.g. 6/2π = 6/(2π).
  // Explicit multiplication stays left-associative: 6/2*3 = 9.
  function parseImplicitProduct() {
    let value = parseUnary()
    while (peek()?.value === '*' && peek()?.implicit) {
      take()
      const right = parseUnary()
      value = syntaxOnly ? 1 : value * right
    }
    return value
  }

  function parsePower() {
    const value = parsePostfix()
    if (peek()?.value !== '^') return value
    take()
    const exponent = parseUnary()
    return syntaxOnly ? 1 : Math.pow(value, exponent)
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
      value = syntaxOnly ? 1 : operator === '!' ? factorial(value) : value / 100
    }
    return value
  }

  function parsePrimary() {
    const token = take()
    if (!token) fail('算式不完整')
    if (token.type === 'number') return syntaxOnly ? 1 : token.value
    if (token.value === '(') {
      const value = parseAddSub()
      if (take()?.value !== ')') fail('括号不匹配')
      return value
    }
    if (token.type === 'identifier') {
      if (VARIABLE_NAMES.has(token.raw)) {
        if(syntaxOnly) return 1
        const value = variables[token.raw] === undefined ? 0 : Number(variables[token.raw])
        if (!Number.isFinite(value)) fail('变量数值无效')
        return value
      }
      if (token.value === 'pi') return Math.PI
      if (token.value === 'e') return Math.E
      if (token.value === 'ans') return Number(answer) || 0
      if (!FUNCTIONS.has(token.value)) fail(`不支持的函数：${token.value}`)
      if (take()?.value !== '(') fail(`${token.value} 后需要括号`)
      const args = [parseAddSub()]
      while (peek()?.value === ',') { take(); args.push(parseAddSub()); if (args.length > 3) fail('函数参数过多') }
      if (take()?.value !== ')') fail('函数括号不匹配')
      if (token.value === 'f' || token.value === 'g') {
        if(syntaxOnly) { if(args.length!==1) fail('函数需要一个参数');return 1 }
        if (args.length !== 1 || typeof functions[token.value] !== 'string' || !functions[token.value].trim()) fail(`${token.value}(x) 尚未定义`)
        return evaluateExpression(functions[token.value], { angleMode, answer, variables: { ...variables, x: args[0] }, functions, functionDepth: functionDepth + 1 })
      }
      if (['frac', 'root', 'logb', 'ncr', 'npr'].includes(token.value)) {
        if (args.length !== 2) fail('这个函数需要两个参数')
        if(syntaxOnly) return 1
        const [a, b] = args
        if (token.value === 'frac') { if (!b) fail('不能除以 0'); return a / b }
        if (token.value === 'root') { if (!Number.isInteger(a) || a < 1 || a > 100 || (b < 0 && a % 2 === 0)) fail('根式不在定义域内'); return Math.sign(b) * Math.pow(Math.abs(b), 1 / a) }
        if (token.value === 'logb') { if (a <= 0 || a === 1 || b <= 0) fail('对数不在定义域内'); return Math.log(b) / Math.log(a) }
        if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || a > 1000 || b < 0 || b > a) fail('排列组合需要 0 ≤ r ≤ n ≤ 1000 的整数')
        const k = token.value === 'ncr' ? Math.min(b, a - b) : b
        let result = 1
        for (let i = 0; i < k; i++) result = result * (a - i) / (token.value === 'ncr' ? i + 1 : 1)
        return result
      }
      if (token.value === 'dms') {
        if(syntaxOnly) { if(args.length!==3) fail('度分秒需要三个参数');return 1 }
        if (args.length !== 3 || args[1] < 0 || args[1] >= 60 || args[2] < 0 || args[2] >= 60) fail('度分秒参数无效')
        return (args[0] < 0 ? -1 : 1) * (Math.abs(args[0]) + args[1] / 60 + args[2] / 3600)
      }
      if (args.length !== 1) fail('这个函数需要一个参数')
      if(syntaxOnly) return 1
      return applyFunction(token.value, args[0], { toRadians, fromRadians })
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
    acosh: Math.acosh,
    asin: (input) => fromRadians(Math.asin(input)),
    asinh: Math.asinh,
    atan: (input) => fromRadians(Math.atan(input)),
    atanh: Math.atanh,
    cbrt: Math.cbrt,
    cos: (input) => Math.cos(toRadians(input)),
    cosh: Math.cosh,
    exp: Math.exp,
    floor: Math.floor,
    ceil: Math.ceil,
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

function validateExpression(expression) { evaluateExpression(expression,{syntaxOnly:true}); return true }

module.exports = { FUNCTIONS, evaluateExpression, validateExpression, factorial, formatNumber, tokenize }
