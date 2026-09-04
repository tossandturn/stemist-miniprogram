// A small, explicit map of the IELTSist production workspace. Native pages
// handle the low-friction mobile flows; the full IELTSist WebView remains the
// source of truth for Cambridge papers, reports, realtime speaking, account,
// vocabulary and membership.

const IELTS_WEB_ORIGIN = 'https://ieltsist.com'

const IELTS_FEATURE_GROUPS = Object.freeze([
  Object.freeze({
    id: 'start',
    label: '开始学习',
    detail: '先看今日计划，再进入对应技能',
    features: Object.freeze([
      Object.freeze({ id: 'dashboard', title: '今日计划', detail: 'Dashboard、目标、薄弱项和最近记录', tone: 'dashboard', kind: 'web', hash: '#home' }),
      Object.freeze({ id: 'coach', title: 'AI Coach', detail: '随时提问、解释答案、安排下一步', tone: 'coach', kind: 'native', nativePage: '/pages/coach/index?source=ielts&category=ielts' }),
    ]),
  }),
  Object.freeze({
    id: 'skills',
    label: '四项技能',
    detail: '每项技能独立记录，不混用题型和评分',
    features: Object.freeze([
      Object.freeze({ id: 'listening', title: 'Listening', detail: '音频、字幕、答案检查和复盘', tone: 'listening', kind: 'native', nativePage: '/pages/ielts/listening', module: 'listening', hash: '#single' }),
      Object.freeze({ id: 'reading', title: 'Reading', detail: '文章定位、证据链和题目复盘', tone: 'reading', kind: 'native', nativePage: '/pages/ielts/reading', module: 'reading', hash: '#single' }),
      Object.freeze({ id: 'writing', title: 'Writing', detail: 'Task 1 / Task 2，打字或拍手写稿', tone: 'writing', kind: 'native', nativePage: '/pages/ielts/writing', module: 'writing', hash: '#writing-upload' }),
      Object.freeze({ id: 'speaking', title: 'Speaking', detail: '实时 examiner、录音、评分和重测', tone: 'speaking', kind: 'embedded', nativePage: '/pages/ielts/speaking', module: 'speaking', hash: '#bank' }),
    ]),
  }),
  Object.freeze({
    id: 'simulation',
    label: '整套模拟',
    detail: '沿用 IELTSist 的计时、提交和报告',
    features: Object.freeze([
      Object.freeze({ id: 'same-test', title: 'Same‑Test Practice', detail: '选择 Cambridge 书册和 Test，按完整顺序练习', tone: 'sequence', kind: 'web', hash: '#sequence' }),
      Object.freeze({ id: 'random-exam', title: 'Random Full Exam', detail: '随机组合四项技能，完成整套模拟', tone: 'exam', kind: 'web', hash: '#exam' }),
    ]),
  }),
  Object.freeze({
    id: 'library',
    label: '词汇与账号',
    detail: '学习资产、词汇复习和会员状态',
    features: Object.freeze([
      Object.freeze({ id: 'vocabulary', title: 'Vocabulary', detail: '按主题、阶段和来源复习词汇', tone: 'vocabulary', kind: 'web', hash: '#vocabulary' }),
      Object.freeze({ id: 'mine', title: 'Mine / Account', detail: '草稿、报告、词汇本和学习记录', tone: 'mine', kind: 'web', hash: '#mine' }),
      Object.freeze({ id: 'subscription', title: 'Subscription', detail: '查看会员方案和兑换状态', tone: 'subscription', kind: 'web', hash: '#subscription' }),
    ]),
  }),
  Object.freeze({
    id: 'full',
    label: '完整工作区',
    detail: '打开 IELTSist 网页端的全部能力和沉浸式布局',
    features: Object.freeze([
      Object.freeze({ id: 'full-workspace', title: '打开完整 IELTSist', detail: '保留桌面端全部控制、PDF 和沉浸模式', tone: 'full', kind: 'web', hash: '#home' }),
    ]),
  }),
])

const IELTS_FEATURES = Object.freeze(IELTS_FEATURE_GROUPS.reduce((all, group) => all.concat(group.features), []))

function getIeltsFeature(id) {
  const key = String(id || '').trim().toLowerCase()
  return IELTS_FEATURES.find((feature) => feature.id === key) || null
}

function ieltsWebUrl(id, context = {}) {
  const feature = getIeltsFeature(id)
  if (!feature || !feature.hash) return ''
  const params = [`from=${encodeURIComponent('stemist')}`]
  if (feature.module) params.push(`module=${encodeURIComponent(feature.module)}`)
  const source = String(context.source || '').trim()
  if (source) params.push(`source=${encodeURIComponent(source)}`)
  return `${IELTS_WEB_ORIGIN}/?${params.join('&')}${feature.hash || '#home'}`
}

function ieltsFeatureGroups() { return IELTS_FEATURE_GROUPS }

function ieltsFeatures() { return IELTS_FEATURES }

module.exports = { IELTS_FEATURE_GROUPS, IELTS_FEATURES, IELTS_WEB_ORIGIN, getIeltsFeature, ieltsFeatureGroups, ieltsFeatures, ieltsWebUrl }
