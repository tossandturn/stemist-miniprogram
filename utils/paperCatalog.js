const { getJson } = require('./api')

const PAPER_SUBJECTS = [
  { code: '9702', label: 'A-Level Physics' },
  { code: '9709', label: 'A-Level Mathematics' },
  { code: '9231', label: 'A-Level Further Mathematics' },
  { code: '9708', label: 'A-Level Economics' },
  { code: '0625', label: 'IGCSE Physics' },
  { code: '0580', label: 'IGCSE Mathematics' },
  { code: '0606', label: 'IGCSE Additional Mathematics' },
  { code: '0610', label: 'IGCSE Biology' },
  { code: '9700', label: 'A-Level Biology' },
  { code: '9701', label: 'A-Level Chemistry' },
  { code: 'bpho', label: 'BPhO' },
  { code: 'amc12', label: 'AMC 12' },
  { code: 'esat', label: 'ESAT' },
  { code: 'tmua', label: 'TMUA' },
]
const catalogCache = new Map()

const IGCSE_SUBJECTS = new Set(['0580', '0606', '0610', '0625'])
const A_LEVEL_SUBJECTS = new Set(['9231', '9700', '9701', '9702', '9708', '9709'])
const COMPETITION_SUBJECTS = new Set(['amc12', 'bpho'])
const ADMISSIONS_SUBJECTS = new Set(['esat', 'tmua'])

// Catalog profiles use source-specific labels (for example `core`, `r1` or
// `prep`). The mini-program filter is intentionally product-level: students
// should see IGCSE / AS / A2 / Competition / Admissions consistently across
// all subjects. Keep the raw labels separately for diagnostics, but expose
// only canonical stage IDs to the UI.
function canonicalStages(subject, rawStages = []) {
  const code = String(subject || '').trim().toLowerCase()
  const raw = Array.isArray(rawStages) ? rawStages.map((stage) => String(stage || '').trim().toLowerCase()).filter(Boolean) : []
  const stages = new Set(raw.filter((stage) => ['igcse', 'as', 'a2', 'competition', 'admissions'].includes(stage)))
  if (IGCSE_SUBJECTS.has(code) && raw.some((stage) => ['core', 'extended', 'igcse'].includes(stage))) stages.add('igcse')
  if (A_LEVEL_SUBJECTS.has(code)) {
    if (raw.includes('as')) stages.add('as')
    if (raw.includes('a2')) stages.add('a2')
  }
  if (COMPETITION_SUBJECTS.has(code) && raw.length) stages.add('competition')
  if (ADMISSIONS_SUBJECTS.has(code) && raw.length) stages.add('admissions')
  return [...stages]
}

function normalizePaperItem(item = {}) {
  const profile = item.examProfile || {}
  const routes = Array.isArray(profile.courseRouteIds) ? profile.courseRouteIds : (Array.isArray(profile.routeIds) ? profile.routeIds : [])
  const subject = String(item.subject || '').trim().toLowerCase()
  const rawStages = Array.isArray(profile.stages) ? profile.stages.map((stage) => String(stage).toLowerCase()) : []
  return {
    id: String(item.id || ''),
    subject,
    year: Number.isFinite(Number(item.year)) ? Number(item.year) : null,
    season: String(item.season || ''),
    kind: String(item.kind || ''),
    file: String(item.file || ''),
    pairKey: item.pairKey ? String(item.pairKey) : '',
    markSchemeId: String(item.markSchemeId || ''),
    paperNumber: profile.code ? String(profile.code) : '',
    title: String(profile.title || ''),
    mode: String(profile.mode || ''),
    stages: canonicalStages(subject, rawStages),
    rawStages,
    routeIds: routes.map((route) => String(route)),
    localUrl: String(item.localUrl || ''),
    governanceState: String(item.governance?.state || '').toLowerCase(),
  }
}

function isQuestionPaper(item) {
  return item.kind === 'qp' && item.governanceState === 'active' && Boolean(item.file)
}

async function fetchPaperCatalog(subject) {
  const code = String(subject || '').trim().toLowerCase()
  if (!PAPER_SUBJECTS.some((item) => item.code === code)) throw new Error('暂不支持这条学科目录')
  const cached = catalogCache.get(code)
  if (cached && cached.items) return cached
  if (cached && cached.promise) return cached.promise
  const promise = getJson(`/data/papers/${encodeURIComponent(code)}.json`, { timeout: 30000 }).then((payload) => {
    if (!payload || payload.schemaVersion !== 2 || !Array.isArray(payload.items)) throw new Error('真题目录响应无效')
    const records = payload.items.map(normalizePaperItem).filter(item => item.subject === code && item.governanceState === 'active')
    const byId = new Map(records.map(item => [item.id, item]))
    const items = records.filter(item => Boolean(item.id) && isQuestionPaper(item)).map(item => {
      const markScheme = byId.get(item.markSchemeId)
      return { ...item, markScheme: markScheme && markScheme.kind === 'ms' && markScheme.pairKey === item.pairKey ? markScheme : null }
    })
    const normalized = {
      subject: code,
      totals: payload.totals || {},
      paperGovernance: payload.paperGovernance || null,
      items,
    }
    catalogCache.set(code, normalized)
    return normalized
  }).finally(() => {
    const current = catalogCache.get(code)
    if (current && current.promise) catalogCache.delete(code)
  })
  catalogCache.set(code, { promise })
  return promise
}

module.exports = { A_LEVEL_SUBJECTS, ADMISSIONS_SUBJECTS, COMPETITION_SUBJECTS, IGCSE_SUBJECTS, PAPER_SUBJECTS, canonicalStages, fetchPaperCatalog, isQuestionPaper, normalizePaperItem }
