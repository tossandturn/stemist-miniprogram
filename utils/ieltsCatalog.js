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
      Object.freeze({ id: 'dashboard', title: '今日计划', detail: '目标与近期练习', tone: 'dashboard', kind: 'web', hash: '#home' }),
      Object.freeze({ id: 'coach', title: 'AI Coach', detail: '随时提问、解释答案、安排下一步', tone: 'coach', kind: 'native', nativePage: '/pages/coach/index?source=ielts&category=ielts' }),
    ]),
  }),
  Object.freeze({
    id: 'skills',
    label: '四项技能',
    detail: '听、说、读、写',
    features: Object.freeze([
      Object.freeze({ id: 'listening', title: 'Listening', detail: '听音频，做真题', tone: 'listening', kind: 'native', nativePage: '/pages/ielts/listening', module: 'listening', hash: '#single' }),
      Object.freeze({ id: 'reading', title: 'Reading', detail: '文章阅读与答题', tone: 'reading', kind: 'native', nativePage: '/pages/ielts/reading', module: 'reading', hash: '#single' }),
      Object.freeze({ id: 'writing', title: 'Writing', detail: '打字或拍照提交作文', tone: 'writing', kind: 'native', nativePage: '/pages/ielts/writing', module: 'writing', hash: '#writing-upload' }),
      Object.freeze({ id: 'speaking', title: 'Speaking', detail: 'AI 对话与口语评分', tone: 'speaking', kind: 'embedded', nativePage: '/pages/ielts/speaking', module: 'speaking', hash: '#bank' }),
    ]),
  }),
  Object.freeze({
    id: 'simulation',
    label: '整套模拟',
    detail: '剑桥套题与随机模考',
    features: Object.freeze([
      Object.freeze({ id: 'same-test', title: '剑桥套题', detail: '选择书册与 Test', tone: 'sequence', kind: 'web', hash: '#sequence' }),
      Object.freeze({ id: 'random-exam', title: '随机模考', detail: '计时完成整套试题', tone: 'exam', kind: 'web', hash: '#exam' }),
    ]),
  }),
  Object.freeze({
    id: 'library',
    label: '词汇与账号',
    detail: '词汇复习与练习记录',
    features: Object.freeze([
      Object.freeze({ id: 'vocabulary', title: '词汇', detail: '记忆与复习', tone: 'vocabulary', kind: 'web', hash: '#vocabulary' }),
      Object.freeze({ id: 'mine', title: '我的记录', detail: '练习报告与词汇本', tone: 'mine', kind: 'web', hash: '#mine' }),
      Object.freeze({ id: 'subscription', title: '会员', detail: '查看权益与方案', tone: 'subscription', kind: 'web', hash: '#subscription' }),
    ]),
  }),
  Object.freeze({
    id: 'full',
    label: 'IELTSist',
    detail: '真题与学习记录',
    features: Object.freeze([
      Object.freeze({ id: 'full-workspace', title: 'IELTSist', detail: '真题与学习记录', tone: 'full', kind: 'web', hash: '#home' }),
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
