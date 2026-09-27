// Defensive display boundary for current and older persisted AI reports.
// This never promotes a provisional score into formal learning progress.
const text = value => typeof value === 'string' ? value.trim() : ''
const scorePair = (score, maximum) => Number.isFinite(score) && Number.isFinite(maximum) && maximum > 0 && score >= 0 && score <= maximum
function reportState(raw) {
 const sourceQuestions = Array.isArray(raw?.questionResults) ? raw.questionResults : []
 const valid = Boolean(raw && text(raw.summary) && sourceQuestions.length && sourceQuestions.every(q => q && text(q.questionLabel || q.questionId || q.label) && text(q.rationale || q.feedback || q.summary)))
 if (!valid) return { result:null, questions:[], valid:false }
 const missingPages = Array.isArray(raw.missingPages) ? raw.missingPages : []
 const missingQuestions = Array.isArray(raw.missingQuestions) ? raw.missingQuestions : []
 const incomplete = missingPages.length > 0 || missingQuestions.length > 0
 const scorable = raw.assessmentMode === 'ai-provisional' && raw.officialScore === false && !incomplete
 const questions = sourceQuestions.map(q => {
  const score = Object.prototype.hasOwnProperty.call(q,'provisionalScore') ? q.provisionalScore : q.score
  const evidence = (Array.isArray(q.evidence) ? q.evidence : []).map(text).filter(Boolean)
  const scoreReady = scorable && evidence.length > 0 && scorePair(score,q.maxScore)
  return {
   questionId:text(q.questionLabel || q.questionId || q.label),
   feedback:text(q.rationale || q.feedback || q.summary),
   evidence:evidence.join('\n'),
   criteria:(Array.isArray(q.criteria) ? q.criteria : []).filter(c=>c && typeof c === 'object').map(c=>[text(c.label),text(c.comment)].filter(Boolean).join('：')).filter(Boolean).join('\n'),
   reviewRequired:q.reviewRequired !== false || !scoreReady,
   scoreReady, score:scoreReady ? score : null, maxScore:scoreReady ? q.maxScore : null,
  }
 })
 const totalReady = scorable && scorePair(raw.provisionalScore,raw.maxScore) && questions.every(q=>q.scoreReady)
  && Math.abs(questions.reduce((sum,q)=>sum+q.score,0)-raw.provisionalScore)<1e-9
  && Math.abs(questions.reduce((sum,q)=>sum+q.maxScore,0)-raw.maxScore)<1e-9
 return { valid:true, questions, result:{
  summary:text(raw.summary),
  completeness:[missingPages.length ? '缺失或不清晰页面：'+missingPages.join('、') : '',missingQuestions.length ? '未完成核对的题目：'+missingQuestions.join('、') : ''].filter(Boolean).join('\n'),
  reviewRequired:raw.reviewRequired !== false || !totalReady,
  provisionalScore:totalReady ? raw.provisionalScore : null,
  maxScore:totalReady ? raw.maxScore : null,
  scoreReady:totalReady,
 } }
}
module.exports = { reportState }
