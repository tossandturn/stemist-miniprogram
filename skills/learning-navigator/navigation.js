const { resolveNavigation, destinationById } = require('./data/registry.generated')

const INPUT_KEYS = new Set(['destinationId', 'courseSystem', 'task', 'subjectCode', 'stage', 'routeId'])
const QUERY_KEYS = ['courseSystem', 'task', 'subjectCode', 'stage', 'routeId']

function clean(value, max = 96) { return String(value || '').trim().slice(0, max) }

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: '请求格式无效。' }
  if (Object.keys(input).some(key => !INPUT_KEYS.has(key))) return { error: '请求字段包含不支持的内容。' }
  const value = {}
  for (const key of INPUT_KEYS) if (input[key] !== undefined) value[key] = clean(input[key])
  if (value.destinationId && Object.keys(value).some(key => key !== 'destinationId' && value[key])) return { error: 'destinationId 必须单独使用，不能与课程、学科、阶段或路线条件混合。' }
  return { value }
}

function queryFrom(value) {
  if (value.destinationId) return `destinationId=${encodeURIComponent(value.destinationId)}`
  return QUERY_KEYS.filter(key => value[key]).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(value[key])}`).join('&')
}

function missingCopy(missing) {
  if (missing.includes('courseSystem')) return '还需要选择课程体系。'
  if (missing.includes('subjectCode')) return '还需要选择学科。'
  if (missing.includes('stage')) return '还需要选择阶段。'
  if (missing.includes('routeId')) return '还需要选择课程路线。'
  if (missing.includes('task')) return '还需要选择学习任务。'
  return '请选择一个学习入口。'
}

function safeChoice(item) {
  const filters = {}
  for (const key of ['courseSystem', 'task', 'subjectCode', 'stage', 'routeId']) if (item?.filters?.[key]) filters[key] = clean(item.filters[key])
  return {
    kind: item.kind === 'filter' ? 'filter' : 'destination',
    id: clean(item.id),
    title: clean(item.title, 120),
    detail: clean(item.detail, 180),
    courseSystem: clean(item.courseSystem),
    task: clean(item.task),
    subjectCode: clean(item.subjectCode),
    subjectLabel: clean(item.subjectLabel, 80),
    stage: clean(item.stage),
    routeId: clean(item.routeId),
    routeLabel: clean(item.routeLabel, 120),
    pagePath: clean(item.pagePath, 400),
    filters,
  }
}

function handoffResolver(fallbackQuery, expected) {
  return () => {
    if (expected.status === 'ready') {
      const destination = destinationById(expected.destination?.id)
      if (destination) return { query: `destinationId=${encodeURIComponent(destination.id)}`, payload: { status: 'ready', destinationId: destination.id } }
    }
    return { query: fallbackQuery, payload: { status: 'choose' } }
  }
}

function responseFor(input) {
  const validation = validateInput(input)
  if (validation.error) return { isError: true, content: [{ type: 'text', text: validation.error }] }
  const result = resolveNavigation(validation.value)
  if (result.status === 'unsupported') {
    return { isError: true, content: [{ type: 'text', text: '没有找到匹配的课程、阶段或路线。请换一个已支持的学习入口。' }] }
  }
  const choices = result.choices.map(safeChoice)
  const ready = result.status === 'ready' ? choices[0] : null
  const fallbackQuery = queryFrom(validation.value)
  const structuredContent = {
    status: result.status,
    choiceDimension: result.choiceDimension || '',
    missing: result.missing.slice(0, 5),
    choices,
    destinationId: ready?.id || '',
    navigationLabel: ready?.title || '选择 STEMist 学习入口',
    navigationPath: ready?.pagePath || `/bundles/ai-entry/index${fallbackQuery ? `?${fallbackQuery}` : ''}`,
  }
  const text = ready
    ? `已找到“${ready.title}”。请点击小程序入口进入，后续操作由你在页面内确认。`
    : `${missingCopy(result.missing)}请点击小程序入口查看真实可用项。`
  return { isError: false, content: [{ type: 'text', text }], structuredContent, handoff: handoffResolver(fallbackQuery, result) }
}

module.exports = { INPUT_KEYS, responseFor, validateInput }
