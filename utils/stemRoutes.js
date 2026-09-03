// Compact client-side mirror of the route IDs used by STEM Studio's
// src/data/routeRegistry.js. The server remains authoritative; this list only
// prevents the photo flow from losing the student's selected scope.
const STEM_ROUTES = [
  { routeId: 'cie-0580-igcse-mathematics', subjectCode: '0580', subjectLabel: 'IGCSE Mathematics', stage: 'IGCSE', qualification: 'IGCSE', components: 'P1 + P2 + P3 + P4' },
  { routeId: 'cie-0606-igcse-additional-mathematics', subjectCode: '0606', subjectLabel: 'IGCSE Additional Mathematics', stage: 'IGCSE', qualification: 'IGCSE', components: 'P1 + P2' },
  { routeId: 'cie-0625-igcse-physics', subjectCode: '0625', subjectLabel: 'IGCSE Physics', stage: 'IGCSE', qualification: 'IGCSE', components: 'P1–P6' },
  { routeId: 'cie-9700-as-biology', subjectCode: '9700', subjectLabel: 'Biology', stage: 'AS', qualification: 'A-Level', components: 'P1 + P2 + P3' },
  { routeId: 'cie-9700-a2-biology', subjectCode: '9700', subjectLabel: 'Biology', stage: 'A2', qualification: 'A-Level', components: 'P4 + P5' },
  { routeId: 'cie-9701-as-chemistry', subjectCode: '9701', subjectLabel: 'Chemistry', stage: 'AS', qualification: 'A-Level', components: 'P1 + P2 + P3' },
  { routeId: 'cie-9701-a2-chemistry', subjectCode: '9701', subjectLabel: 'Chemistry', stage: 'A2', qualification: 'A-Level', components: 'P4 + P5' },
  { routeId: 'cie-9702-as-physics', subjectCode: '9702', subjectLabel: 'Physics', stage: 'AS', qualification: 'A-Level', components: 'P1 + P2 + P3' },
  { routeId: 'cie-9702-a2-physics', subjectCode: '9702', subjectLabel: 'Physics', stage: 'A2', qualification: 'A-Level', components: 'P4 + P5' },
  { routeId: 'cie-9708-as-economics', subjectCode: '9708', subjectLabel: 'Economics', stage: 'AS', qualification: 'A-Level', components: 'P1 + P2' },
  { routeId: 'cie-9708-a2-economics', subjectCode: '9708', subjectLabel: 'Economics', stage: 'A2', qualification: 'A-Level', components: 'P3 + P4' },
  { routeId: 'cie-9709-as-p1-p2', subjectCode: '9709', subjectLabel: 'Mathematics', stage: 'AS', qualification: 'A-Level', components: 'P1 + P2' },
  { routeId: 'cie-9709-as-p1-p4', subjectCode: '9709', subjectLabel: 'Mathematics', stage: 'AS', qualification: 'A-Level', components: 'P1 + M1' },
  { routeId: 'cie-9709-as-p1-p5', subjectCode: '9709', subjectLabel: 'Mathematics', stage: 'AS', qualification: 'A-Level', components: 'P1 + S1' },
  { routeId: 'cie-9709-a2-after-p1-p5-p3-p4', subjectCode: '9709', subjectLabel: 'Mathematics', stage: 'A2', qualification: 'A-Level', components: 'P3 + M1' },
  { routeId: 'cie-9709-a2-after-p1-p5-p3-p6', subjectCode: '9709', subjectLabel: 'Mathematics', stage: 'A2', qualification: 'A-Level', components: 'P3 + S2' },
  { routeId: 'cie-9709-a2-after-p1-p4-p3-p5', subjectCode: '9709', subjectLabel: 'Mathematics', stage: 'A2', qualification: 'A-Level', components: 'P3 + S1' },
  { routeId: 'cie-9231-as-p1-p3', subjectCode: '9231', subjectLabel: 'Further Mathematics', stage: 'AS', qualification: 'A-Level', components: 'P1 + P3' },
  { routeId: 'cie-9231-as-p1-p4', subjectCode: '9231', subjectLabel: 'Further Mathematics', stage: 'AS', qualification: 'A-Level', components: 'P1 + P4' },
  { routeId: 'cie-9231-a2-after-p1-p3-p2-p4', subjectCode: '9231', subjectLabel: 'Further Mathematics', stage: 'A2', qualification: 'A-Level', components: 'P2 + P4' },
  { routeId: 'cie-9231-a2-after-p1-p4-p2-p3', subjectCode: '9231', subjectLabel: 'Further Mathematics', stage: 'A2', qualification: 'A-Level', components: 'P2 + P3' },
  { routeId: 'bpho-admissions-physics', subjectCode: 'bpho', subjectLabel: 'British Physics Olympiad', stage: 'Competition', qualification: 'Competition', components: 'Competition paper' },
  { routeId: 'maa-amc12-admissions-mathematics', subjectCode: 'amc12', subjectLabel: 'AMC 12', stage: 'Competition', qualification: 'Competition', components: 'Competition paper' },
  { routeId: 'uatuk-esat-admissions', subjectCode: 'esat', subjectLabel: 'ESAT', stage: 'Admissions', qualification: 'Admissions', components: 'Maths + science modules' },
  { routeId: 'uatuk-tmua-admissions', subjectCode: 'tmua', subjectLabel: 'TMUA', stage: 'Admissions', qualification: 'Admissions', components: 'Paper 1 + Paper 2' },
]

function routesForSubjectStage(subjectCode, stage) {
  return STEM_ROUTES.filter((route) => route.subjectCode === subjectCode && route.stage === stage)
}

function routeById(routeId) { return STEM_ROUTES.find((route) => route.routeId === routeId) || null }

module.exports = { STEM_ROUTES, routesForSubjectStage, routeById }
