// Shared STEM scope metadata for the capture and Practice surfaces. Route IDs
// remain a client-side focus hint; the server owns eligibility and scoring.
const STEM_SUBJECTS = [
  { code: '9702', label: 'Physics', short: '物理' },
  { code: '9709', label: 'Mathematics', short: '数学' },
  { code: '9700', label: 'Biology', short: '生物' },
  { code: '9701', label: 'Chemistry', short: '化学' },
  { code: '9708', label: 'Economics', short: '经济' },
  { code: '9231', label: 'Further Mathematics', short: '高数' },
  { code: '0625', label: 'IGCSE Physics', short: 'IGCSE 物理' },
  { code: '0610', label: 'IGCSE Biology', short: 'IGCSE 生物' },
  { code: '0580', label: 'IGCSE Mathematics', short: 'IGCSE 数学' },
  { code: '0606', label: 'IGCSE Additional Mathematics', short: 'IGCSE 附加数学' },
  { code: 'bpho', label: 'BPhO', short: 'BPhO' },
  { code: 'esat', label: 'ESAT', short: 'ESAT' },
  { code: 'tmua', label: 'TMUA', short: 'TMUA' },
  { code: 'amc12', label: 'AMC 12', short: 'AMC 12' },
]

const STEM_STAGES = ['IGCSE', 'AS', 'A2', 'Competition', 'Admissions']
const STEM_ENTRY_CATEGORIES = Object.freeze({
  alevel: Object.freeze(['0580', '0606', '0610', '0625', '9231', '9700', '9701', '9702', '9708', '9709']),
  competition: Object.freeze(['amc12', 'bpho', 'esat', 'tmua']),
})

function subjectByCode(code) {
  return STEM_SUBJECTS.find((subject) => subject.code === String(code || '')) || null
}

function subjectsForCategory(category = 'alevel') {
  const codes = STEM_ENTRY_CATEGORIES[String(category || '').toLowerCase()] || STEM_ENTRY_CATEGORIES.alevel
  return STEM_SUBJECTS.filter((subject) => codes.includes(subject.code))
}

function categoryForSubject(code) {
  const value = String(code || '').toLowerCase()
  return Object.keys(STEM_ENTRY_CATEGORIES).find((category) => STEM_ENTRY_CATEGORIES[category].includes(value)) || 'alevel'
}

function firstRouteFor(subjectCode, stage) {
  return routesForSubjectStage(subjectCode, stage)[0] || null
}

const { routesForSubjectStage } = require('./stemRoutes')

module.exports = { STEM_ENTRY_CATEGORIES, STEM_SUBJECTS, STEM_STAGES, categoryForSubject, subjectByCode, subjectsForCategory, firstRouteFor, routesForSubjectStage }
