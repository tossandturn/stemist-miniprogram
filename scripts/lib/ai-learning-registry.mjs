import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function loadCommonJs(relative) {
  const filename = path.join(root, relative)
  const module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module,
    exports: module.exports,
    require() { throw new Error(`${relative} must stay dependency-free for registry generation`) },
  }, { filename })
  return module.exports
}

const clean = value => String(value || '').trim()
const query = fields => Object.entries(fields).filter(([, value]) => clean(value)).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(clean(value))}`).join('&')
const page = (pathname, fields = {}) => `/${pathname}${Object.keys(fields).length ? `?${query(fields)}` : ''}`

function destination(value) {
  return Object.freeze({
    ...value,
    autoStart: false,
    readsPrivateData: false,
    startsPaidAction: false,
    opensDeviceInput: false,
  })
}

function routeDestinations(routes) {
  const values = []
  for (const route of routes) {
    const competition = route.qualification === 'Competition' || route.qualification === 'Admissions'
    const courseSystem = competition ? 'competition' : 'cambridge'
    const category = competition ? 'competition' : 'alevel'
    const base = {
      courseSystem,
      subjectCode: route.subjectCode,
      subjectLabel: route.subjectLabel,
      stage: route.stage,
      routeId: route.routeId,
      routeLabel: `${route.stage} · ${route.components}`,
      qualification: route.qualification,
    }
    if (competition) {
      values.push(destination({
        ...base,
        id: `${courseSystem}-${route.routeId}-papers`,
        task: 'papers',
        title: `${route.subjectLabel} 真题目录`,
        detail: `${route.stage} · ${route.components}`,
        pagePath: page('pages/papers/index', { category, subject: route.subjectCode, stage: route.stage, routeId: route.routeId }),
      }))
      continue
    }
    const common = { category, routeId: route.routeId }
    values.push(
      destination({ ...base, id: `${courseSystem}-${route.routeId}-workspace`, task: 'workspace', title: `${route.subjectLabel} 学习工作区`, detail: `${route.stage} · ${route.components}`, pagePath: page('pages/practice/index', common) }),
      destination({ ...base, id: `${courseSystem}-${route.routeId}-photo`, task: 'photo', title: `${route.subjectLabel} 拍题入口`, detail: '进入工作区后由学生点击拍照', pagePath: page('pages/practice/index', common) }),
      destination({ ...base, id: `${courseSystem}-${route.routeId}-topics`, task: 'topics', title: `${route.subjectLabel} 章节练习`, detail: `${route.stage} · ${route.components}`, pagePath: page('pages/stem/topics', { routeId: route.routeId }) }),
      destination({ ...base, id: `${courseSystem}-${route.routeId}-papers`, task: 'papers', title: `${route.subjectLabel} 历年真题`, detail: `${route.stage} · ${route.components}`, pagePath: page('pages/papers/index', { category, subject: route.subjectCode, stage: route.stage, routeId: route.routeId }) }),
      destination({ ...base, id: `${courseSystem}-${route.routeId}-exam`, task: 'exam', title: `${route.subjectLabel} 模拟考试`, detail: `${route.stage} · ${route.components}`, pagePath: page('pages/papers/index', { category, subject: route.subjectCode, stage: route.stage, routeId: route.routeId, mode: 'exam-simulation' }) }),
      destination({ ...base, id: `${courseSystem}-${route.routeId}-coach`, task: 'coach', title: `${route.subjectLabel} AI Coach`, detail: '进入 Coach 后由学生确认问题和材料', pagePath: page('pages/coach/index', { source: 'ai-navigator', category, routeId: route.routeId, stage: route.stage, subjectCode: route.subjectCode }) }),
    )
  }
  return values
}

function internationalBoardDestinations(){
 const boards=[{id:'edexcel',label:'Edexcel IAL',detail:'Pearson 国际 A-Level'},{id:'oxfordaqa',label:'OxfordAQA',detail:'OxfordAQA 国际 A-Level'}]
 const subjects=[{id:'physics',label:'Physics'},{id:'maths',label:'Mathematics'},{id:'further-maths',label:'Further Mathematics'}]
 return boards.flatMap(board=>subjects.map(subject=>destination({id:`${board.id}-${subject.id}-papers`,courseSystem:board.id,task:'papers',subjectCode:subject.id,subjectLabel:subject.label,stage:'IAL',qualification:'International A-Level',title:`${board.label} ${subject.label} 真题资料`,detail:'当前仅开放已核对的国际单元卷目录',pagePath:page('bundles/curricula/index',{board:board.id,course:`${board.id}-ial-${subject.id}`})})))
}

function overviewDestinations() {
  return [
    destination({ id: 'cambridge-overview', courseSystem: 'cambridge', task: 'overview', title: 'A-Level / IGCSE 学习入口', detail: '先选择学科、阶段和课程路线', pagePath: page('pages/practice/index', { category: 'alevel' }) }),
    destination({ id: 'edexcel-overview', courseSystem: 'edexcel', task: 'overview', title: 'Edexcel IAL 学习入口', detail: '选择 Physics、Mathematics 或 Further Mathematics 真题', pagePath: page('pages/practice/index', { category: 'alevel',board:'edexcel' }) }),
    destination({ id: 'oxfordaqa-overview', courseSystem: 'oxfordaqa', task: 'overview', title: 'OxfordAQA 国际 A-Level 入口', detail: '选择 Physics、Mathematics 或 Further Mathematics 真题', pagePath: page('pages/practice/index', { category: 'alevel',board:'oxfordaqa' }) }),
    destination({ id: 'ap-overview', courseSystem: 'ap', task: 'overview', title: 'AP 学习入口', detail: '查看课程、真题和已开放练习', pagePath: page('bundles/curricula/index', { board: 'ap' }) }),
    destination({ id: 'ib-overview', courseSystem: 'ib', task: 'overview', title: 'IB 学习入口', detail: '查看课程与真题资料', pagePath: page('bundles/curricula/index', { board: 'ib' }) }),
    destination({ id: 'ielts-overview', courseSystem: 'ielts', task: 'overview', title: 'IELTS 学习入口', detail: '听说读写、模考、词汇与资料', pagePath: page('pages/ielts/home') }),
    destination({ id: 'competition-overview', courseSystem: 'competition', task: 'overview', title: '竞赛 / 入学考试入口', detail: 'BPhO、AMC 12、ESAT、TMUA 真题', pagePath: page('pages/papers/index', { category: 'competition' }) }),
    destination({ id: 'tools-overview', courseSystem: 'tools', task: 'overview', title: '学习工具入口', detail: 'AI Coach、进度、笔记与计算器', pagePath: page('pages/index/index') }),
  ]
}

function staticDestinations(ieltsFeatures) {
  const byId = new Map(ieltsFeatures.map(item => [item.id, item]))
  const ielts = [
    ['dashboard', 'home', 'IELTS 今日学习', '今日计划和学习入口'],
    ['listening', 'listening', 'IELTS Listening', '进入听力资料与练习'],
    ['reading', 'reading', 'IELTS Reading', '进入阅读资料与练习'],
    ['writing', 'writing', 'IELTS Writing', '进入写作题库，学生选择打字或照片'],
    ['speaking', 'speaking', 'IELTS Speaking', '进入口语页后由学生主动开麦'],
    ['same-test', 'same-test', 'IELTS 剑桥套题', '按书册与 Test 进入整套练习'],
    ['random-exam', 'random-exam', 'IELTS 随机模考', '进入页面后由学生确认开始'],
    ['vocabulary', 'vocabulary', 'IELTS 词汇', '记忆、复习和词汇本'],
    ['coach', 'coach', 'IELTS AI Coach', '进入 Coach 后由学生确认发送'],
  ].map(([featureId, task, title, detail]) => {
    const feature = byId.get(featureId)
    if (!feature?.nativePage) throw new Error(`Missing native IELTS feature ${featureId}`)
    return destination({ id: `ielts-${task}`, courseSystem: 'ielts', task, title, detail, pagePath: feature.nativePage })
  })
  ielts.push(
    destination({ id: 'ielts-papers', courseSystem: 'ielts', task: 'papers', title: 'IELTS 真题与答案下载', detail: '进入目录后由学生选择文件', pagePath: page('bundles/curricula/ieltsPapers') }),
    destination({ id: 'ielts-audio', courseSystem: 'ielts', task: 'audio', title: 'IELTS 配套音频下载', detail: '进入目录后由学生选择音频', pagePath: page('bundles/curricula/ieltsAudio') }),
  )
  return [
    destination({ id: 'ap-papers', courseSystem: 'ap', task: 'papers', title: 'AP 真题资料', detail: '选择课程、年份和卷别', pagePath: page('bundles/curricula/index', { board: 'ap' }) }),
    destination({ id: 'ap-practice', courseSystem: 'ap', task: 'practice', title: 'AP 已开放练习', detail: '先在 AP 目录选择真实可用路线', pagePath: page('bundles/curricula/index', { board: 'ap' }) }),
    destination({ id: 'ib-papers', courseSystem: 'ib', task: 'papers', title: 'IB 真题资料', detail: '选择课程、级别、年份和卷别', pagePath: page('bundles/curricula/index', { board: 'ib' }) }),
    ...ielts,
    destination({ id: 'tools-coach', courseSystem: 'tools', task: 'coach', title: 'AI Coach', detail: '选择答疑方式后由学生确认发送', pagePath: page('bundles/coach/index') }),
    destination({ id: 'tools-progress', courseSystem: 'tools', task: 'progress', title: '学习进度', detail: '登录后由原生页面读取账号记录', pagePath: page('pages/progress/index'), privacyBoundary: 'page-login-gated' }),
    destination({ id: 'tools-notebook', courseSystem: 'tools', task: 'notebook', title: '学习笔记本', detail: '登录后由原生页面读取笔记', pagePath: page('pages/notebook/index'), privacyBoundary: 'page-login-gated' }),
    destination({ id: 'tools-calculator', courseSystem: 'tools', task: 'calculator', title: 'Casio 计算器', detail: '科学计算与本机历史', pagePath: page('pages/calculator/index') }),
  ]
}

export function buildAiLearningRegistry() {
  const { STEM_ROUTES } = loadCommonJs('utils/stemRoutes.js')
  const { IELTS_FEATURES } = loadCommonJs('utils/ieltsCatalog.js')
  if (!Array.isArray(STEM_ROUTES) || !Array.isArray(IELTS_FEATURES)) throw new Error('Native route sources are unavailable')
  const systems = Object.freeze([
    { id: 'cambridge', label: 'A-Level / IGCSE', detail: 'Cambridge 学科、阶段和路线' },
    { id: 'edexcel', label: 'Edexcel IAL', detail: 'Pearson 国际 A-Level 真题资料' },
    { id: 'oxfordaqa', label: 'OxfordAQA', detail: 'OxfordAQA 国际 A-Level 真题资料' },
    { id: 'ap', label: 'AP', detail: '课程资料、真题和已开放练习' },
    { id: 'ib', label: 'IB', detail: '课程与真题资料' },
    { id: 'ielts', label: 'IELTS', detail: '听说读写、模考、词汇与资料' },
    { id: 'competition', label: '竞赛 / 入学考试', detail: 'BPhO、AMC 12、ESAT、TMUA' },
    { id: 'tools', label: '学习工具', detail: 'AI Coach、进度、笔记与计算器' },
  ])
  return Object.freeze({
    schemaVersion: 'stemist-ai-learning-registry-v1',
    version: '2026-11-13',
    knowledgeVersion: 'stemist-ai-knowledge-v1.1.0-2026-11-13',
    systems,
    destinations: Object.freeze([...overviewDestinations(), ...routeDestinations(STEM_ROUTES), ...internationalBoardDestinations(), ...staticDestinations(IELTS_FEATURES)]),
    officialReferences: Object.freeze([
      { repository: 'wechat-miniprogram/ai-mode-demo', sha: '240d61873714c0e488df95529df160a12d4f131f', license: 'MIT' },
      { repository: 'wechat-miniprogram/ai-mode-skills', sha: '9bd1f25a7051ff137206f15251f716536f8409e9', license: 'MIT' },
    ]),
  })
}
