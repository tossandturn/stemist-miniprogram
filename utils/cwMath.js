const { evaluateExpression, formatNumber } = require('./calculator')

function fraction(value) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e9) return null
  if(value === 0) return {numerator:0,denominator:1}
  const sign = value < 0 ? -1 : 1, target = Math.abs(value)
  let x = target, h0 = 0, h1 = 1, k0 = 1, k1 = 0
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(x), h = a * h1 + h0, k = a * k1 + k0
    if (k > 1000000 || !Number.isSafeInteger(h)) break
    if (h > 0 && Math.abs(h / k - target) <= 2 * Number.EPSILON * target) return { numerator: sign * h, denominator: k }
    h0 = h1; h1 = h; k0 = k1; k1 = k
    if (x === a) break
    x = 1 / (x - a)
  }
  return null
}

function resultFormat(value, mode = 'decimal', digits = 6) {
  if (!Number.isFinite(value)) throw new Error('没有可转换的结果')
  const precision = Math.max(0, Math.min(9, Number(digits) || 0))
  if (mode === 'fraction' || mode === 'mixed') {
    const f = fraction(value)
    if (!f) throw new Error('这个结果不能在当前精度下转为简单分数')
    if (f.denominator === 1) return { text: String(f.numerator), kind: 'number' }
    const absolute = Math.abs(f.numerator), whole = Math.floor(absolute / f.denominator)
    if (mode === 'mixed' && whole) return { text: `${value < 0 ? '−' : ''}${whole} ${absolute % f.denominator}/${f.denominator}`, kind: 'fraction', whole: `${value < 0 ? '−' : ''}${whole}`, numerator: String(absolute % f.denominator), denominator: String(f.denominator) }
    return { text: `${f.numerator}/${f.denominator}`, kind: 'fraction', whole: '', numerator: String(f.numerator), denominator: String(f.denominator) }
  }
  if (mode === 'engineering') {
    const [coefficient,power] = value.toExponential(12).split('e')
    const exponent = value ? Math.floor(Number(power) / 3) * 3 : 0
    const mantissa = Number(coefficient) * Math.pow(10, Number(power) - exponent)
    return { text: `${formatNumber(mantissa)}×10^${exponent}`, kind: 'number' }
  }
  if (mode === 'scientific') return { text: value.toExponential(Math.max(0, precision - 1)), kind: 'number' }
  if (mode === 'fixed') return { text: value.toFixed(precision), kind: 'number' }
  return { text: formatNumber(value), kind: 'number' }
}

function quadratic(a, b, c) {
  if (![a, b, c].every(Number.isFinite) || a === 0) throw new Error('二次项系数不能为 0')
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c))
  a /= scale; b /= scale; c /= scale
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) throw new Error('该方程没有实数根')
  if(!a) throw new Error('系数差距超出当前数值精度')
  if (discriminant === 0) { const root=-b/(2*a); if(!Number.isFinite(root))throw new Error('结果超出数值范围'); return [root] }
  const q = -.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant))
  const roots=[q/a,c/q]
  if(!roots.every(Number.isFinite))throw new Error('结果超出数值范围')
  return roots.sort((x, y) => x - y)
}

function linearSystem(rows) {
  const n = rows.length
  if (n < 2 || n > 4 || rows.some(r => r.length !== n + 1 || !r.every(Number.isFinite))) throw new Error('联立方程的系数不完整')
  const a = rows.map(row => { const scale = Math.max(...row.slice(0, n).map(Math.abs)); return scale ? row.map(v => v / scale) : row.slice() })
  for (let i = 0; i < n; i++) {
    let pivot = i
    for (let j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j
    if (Math.abs(a[pivot][i]) < 1e-12) throw new Error('方程没有稳定的唯一解')
    ;[a[i], a[pivot]] = [a[pivot], a[i]]
    const divisor = a[i][i]
    for (let k = i; k <= n; k++) a[i][k] /= divisor
    for (let j = 0; j < n; j++) if (j !== i) { const factor = a[j][i]; for (let k = i; k <= n; k++) a[j][k] -= factor * a[i][k] }
  }
  const solution = a.map(row => row[n])
  if (!solution.every(Number.isFinite)) throw new Error('结果超出数值范围')
  return solution
}

function statistics(values) {
  if (!Array.isArray(values) || !values.length || values.length > 500 || !values.every(Number.isFinite)) throw new Error('请输入 1–500 个有效数据')
  let mean = 0, m2 = 0, sum = 0
  values.forEach((x, i) => { const delta = x - mean; mean += delta / (i + 1); m2 += delta * (x - mean); sum += x })
  if (![sum, mean, m2].every(Number.isFinite)) throw new Error('数据超出数值范围')
  return { n: values.length, mean, sum, populationSd: Math.sqrt(Math.max(0, m2 / values.length)), sampleSd: values.length > 1 ? Math.sqrt(Math.max(0, m2 / (values.length - 1))) : null, min: Math.min(...values), max: Math.max(...values) }
}

function numberTable(expression, start, end, step, context = {}) {
  if (![start, end, step].every(Number.isFinite) || step === 0 || (end - start) * step < 0) throw new Error('起点、终点和步长不匹配')
  const count = Math.floor((end - start) / step + 1e-10) + 1
  if (count < 1 || count > 45) throw new Error('数表最多 45 行，请增大步长')
  return Array.from({ length: count }, (_, i) => {
    const x = start + step * i
    return { x, y: evaluateExpression(expression, { ...context, variables: { ...context.variables, x } }) }
  })
}

function baseConvert(input, from, to) {
  if (![2, 8, 10, 16].includes(from) || ![2, 8, 10, 16].includes(to)) throw new Error('请选择有效进制')
  const text = String(input).trim().toUpperCase()
  const patterns = { 2: /^-?[01]+$/, 8: /^-?[0-7]+$/, 10: /^-?\d+$/, 16: /^-?[\dA-F]+$/ }
  if (!patterns[from].test(text)) throw new Error('数值包含当前进制不允许的字符')
  let value = parseInt(text, from)
  const upper = from === 10 ? 2147483647 : 4294967295
  if (!Number.isInteger(value) || value < -2147483648 || value > upper) throw new Error('数值超出 CW 的 32 位范围')
  // Casio's Base-N guide specifies signed 32-bit values, with two's-complement
  // bit patterns in hexadecimal, binary and octal (not a prefixed minus).
  if(from !== 10 && value > 2147483647) value -= 4294967296
  if(to === 10) return String(value)
  return (value < 0 ? value + 4294967296 : value).toString(to).toUpperCase()
}

module.exports = { fraction, resultFormat, quadratic, linearSystem, statistics, numberTable, baseConvert }
