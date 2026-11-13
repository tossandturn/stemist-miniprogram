import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { buildAiLearningRegistry } from './lib/ai-learning-registry.mjs'
import { AI_LEARNING_EVALUATION_CASES } from './lib/ai-learning-evaluation.mjs'
import { generateAiLearningArtifacts,platformKnowledgeMatches } from './generate-ai-learning-assets.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const registeredPages = new Set([
  ...app.pages,
  ...(app.subPackages || []).flatMap(pkg => (pkg.pages || []).map(page => `${pkg.root}/${page}`)),
])

const registry = buildAiLearningRegistry()
assert.equal(registry.schemaVersion, 'stemist-ai-learning-registry-v1')
assert.equal(registry.version, '2026-11-13')
assert.ok(registry.destinations.length >= 60, 'registry must cover the real course and tool surface')
assert.deepEqual(registry.officialReferences.map(item => item.sha), [
  '240d61873714c0e488df95529df160a12d4f131f',
  '9bd1f25a7051ff137206f15251f716536f8409e9',
])

for (const destination of registry.destinations) {
  const route = destination.pagePath.replace(/^\//, '').split('?')[0]
  assert.ok(registeredPages.has(route), `${destination.id} points to registered native page ${route}`)
  assert.equal(destination.autoStart, false, `${destination.id} must require a user tap`)
  assert.equal(destination.readsPrivateData, false, `${destination.id} must not read private data`)
  assert.equal(destination.startsPaidAction, false, `${destination.id} must not start paid actions`)
  assert.equal(destination.opensDeviceInput, false, `${destination.id} must not open camera or microphone`)
}

const runtimeDir = path.join(root, 'bundles', 'ai-entry')
generateAiLearningArtifacts(root)
const runtimeModule = { exports: {} }
vm.runInNewContext(fs.readFileSync(path.join(runtimeDir, 'registry.generated.js'), 'utf8'), { module: runtimeModule, exports: runtimeModule.exports })
const runtime = runtimeModule.exports

const physicsMissingStage = runtime.resolveNavigation({ courseSystem: 'cambridge', subjectCode: '9702', task: 'topics' })
assert.equal(physicsMissingStage.status, 'choose')
assert.deepEqual([...new Set(physicsMissingStage.choices.map(item => item.stage))].sort(), ['A2', 'AS'])

const mathsMissingRoute = runtime.resolveNavigation({ courseSystem: 'cambridge', subjectCode: '9709', stage: 'AS', task: 'papers' })
assert.equal(mathsMissingRoute.status, 'choose')
assert.equal(mathsMissingRoute.choices.length, 3)

const broadPapers = runtime.resolveNavigation({ task: 'papers' })
assert.equal(broadPapers.status, 'choose')
assert.equal(broadPapers.choiceDimension, 'courseSystem')
assert.deepEqual([...broadPapers.choices].map(item => item.filters.courseSystem).sort(), ['ap', 'cambridge', 'competition', 'edexcel', 'ib', 'ielts', 'oxfordaqa'])
const apAfterChoice = runtime.resolveNavigation({ ...broadPapers.request, ...broadPapers.choices.find(item => item.filters.courseSystem === 'ap').filters })
assert.equal(apAfterChoice.status, 'ready')
assert.equal(apAfterChoice.destination.id, 'ap-papers')

for (const [input, expectedPath] of [
  [{ courseSystem: 'cambridge', subjectCode: '9702', stage: 'A2', task: 'topics' }, '/pages/stem/topics?routeId=cie-9702-a2-physics'],
  [{ courseSystem: 'ap', task: 'papers' }, '/bundles/curricula/index?board=ap'],
  [{ courseSystem: 'ib', task: 'papers' }, '/bundles/curricula/index?board=ib'],
  [{ courseSystem: 'edexcel', subjectCode: 'physics', task: 'papers' }, '/bundles/curricula/index?board=edexcel&course=edexcel-ial-physics'],
  [{ courseSystem: 'oxfordaqa', subjectCode: 'maths', task: 'papers' }, '/bundles/curricula/index?board=oxfordaqa&course=oxfordaqa-ial-maths'],
  [{ courseSystem: 'ielts', task: 'listening' }, '/pages/ielts/library?module=listening'],
  [{ courseSystem: 'competition', subjectCode: 'bpho', task: 'papers' }, '/pages/papers/index?category=competition&subject=bpho&stage=Competition&routeId=bpho-admissions-physics'],
  [{ courseSystem: 'tools', task: 'calculator' }, '/pages/calculator/index'],
]) {
  const result = runtime.resolveNavigation(input)
  assert.equal(result.status, 'ready', JSON.stringify(input))
  assert.equal(result.destination.pagePath, expectedPath)
}

assert.equal(runtime.resolveNavigation({ courseSystem: 'cambridge', routeId: 'cie-9702-a2-physics', subjectCode: '0580', task: 'papers' }).status, 'unsupported')
assert.equal(runtime.resolveNavigation({ destinationId: 'ielts-listening', courseSystem: 'cambridge' }).status, 'unsupported')
assert.equal(runtime.resolveNavigation({ courseSystem: 'tools', task: 'camera' }).status, 'unsupported')

const uploadManifest = JSON.parse(fs.readFileSync(path.join(root, 'knowledge-base', 'manifest.json'), 'utf8'))
assert.equal(uploadManifest.schemaVersion, 'stemist-ai-knowledge-manifest-v1')
assert.equal(uploadManifest.version, 'stemist-ai-knowledge-v1.1.0-2026-11-13')
assert.deepEqual(uploadManifest.officialUploadFormats, ['PDF', 'DOC', 'DOCX', 'PPT', 'PPTX', 'TXT', 'MD', 'XLSX'])
assert.equal(uploadManifest.maxFiles, 10)
assert.equal(uploadManifest.maxBytesPerFile, 10 * 1024 * 1024)
assert.equal(uploadManifest.files.length, 4)
const publishedEvidence=JSON.parse(fs.readFileSync(path.join(root,'knowledge-base','platform-verification.json'),'utf8'))
assert.equal(platformKnowledgeMatches(publishedEvidence,uploadManifest.files),true)
assert.equal(uploadManifest.actualPlatformUploadVerified,true)
assert.equal(uploadManifest.actualPlatformParsingVerified,true)
const changedFiles=structuredClone(uploadManifest.files);changedFiles[0].sha256='0'.repeat(64)
assert.equal(platformKnowledgeMatches(publishedEvidence,changedFiles),false,'old platform evidence cannot certify changed knowledge content')
assert.equal(platformKnowledgeMatches({...publishedEvidence,files:[...publishedEvidence.files.slice(1),publishedEvidence.files[1]]},uploadManifest.files),false)
assert.equal(platformKnowledgeMatches(null,uploadManifest.files),false)
for (const item of uploadManifest.files) {
  assert.match(item.path, /^knowledge-base\/stemist-0[1-4]-.+\.txt$/)
  const bytes = fs.readFileSync(path.join(root, item.path))
  assert.ok(bytes.length > 300 && bytes.length < 10 * 1024 * 1024)
  assert.notEqual(bytes[0], 0xef, `${item.path} must be UTF-8 without BOM`)
  assert.equal(item.bytes, bytes.length)
  assert.equal(item.sha256, crypto.createHash('sha256').update(bytes).digest('hex'))
  const text = bytes.toString('utf8')
  assert.doesNotMatch(text, /API[_ -]?KEY|Bearer\s|session[_ -]?token|Cookie:/i)
  assert.doesNotMatch(text, /\bToken\b|\bCookie\b|session_key|routeId|注册表|\bSkill\b/i)
  assert.doesNotMatch(text, /保证录取|官方授权|完整覆盖|题量共|结算日/)
}
const productText = fs.readFileSync(path.join(root, 'knowledge-base', 'stemist-01-product-and-scope.txt'), 'utf8')
const navigationText = fs.readFileSync(path.join(root, 'knowledge-base', 'stemist-02-course-navigation.txt'), 'utf8')
const faqText = fs.readFileSync(path.join(root, 'knowledge-base', 'stemist-03-operations-faq.txt'), 'utf8')
const privacyText = fs.readFileSync(path.join(root, 'knowledge-base', 'stemist-04-account-privacy-ai-boundaries.txt'), 'utf8')
assert.match(productText, /适合/)
assert.match(navigationText, /AP Physics|IB Physics/)
assert.ok((faqText.match(/^问：/gm) || []).length >= 15)
assert.ok((faqText.match(/^问：/gm) || []).length <= 20)
assert.match(privacyText, /主动提交/)
assert.match(privacyText, /主动开始/)
assert.match(privacyText, /第三方 AI/)
assert.match(privacyText, /AI 导航选择页.*可以先查看/)
assert.match(privacyText, /目标页面.*登录.*隐私.*会员/)
const allKnowledge=[productText,navigationText,faqText,privacyText].join('\n')
assert.match(allKnowledge,/每天.*2\s*份/)
assert.match(allKnowledge,/同日同一文件.*不重复/)
assert.match(allKnowledge,/28\.80\s*元.*30\s*天.*手动续费/)
assert.match(allKnowledge,/服务端.*为准/)
assert.match(allKnowledge,/计算器.*免费/)
assert.match(allKnowledge,/先.*文字.*补.*受力图/)
assert.match(allKnowledge,/校园共鸣/)
assert.match(allKnowledge,/世界探索/)
assert.match(allKnowledge,/悬疑与轻恐/)
assert.match(allKnowledge,/最后一道选做题/)
assert.match(allKnowledge,/倒悬天文馆/)
assert.match(allKnowledge,/第十三次落幕/)
assert.match(allKnowledge,/18 岁同龄角色/)
assert.match(allKnowledge,/不需要天文课外知识/)
assert.match(allKnowledge,/非血腥、无突然惊吓/)
assert.match(allKnowledge,/实际可用状态以当前发布版本和服务端目录为准/)
assert.match(allKnowledge,/免费酒馆普通人格列表不受/)
assert.match(allKnowledge,/旧.*房间.*继续/)
assert.doesNotMatch(allKnowledge,/雨窗茶室|河岸档案室|无名信与银翼鸟|白汀渡/)
assert.match(navigationText,/Edexcel/)
assert.match(navigationText,/OxfordAQA/)

assert.equal(AI_LEARNING_EVALUATION_CASES.length, 50)
assert.equal(AI_LEARNING_EVALUATION_CASES.filter(item => item.tags.includes('negative')).length, 8)
assert.equal(AI_LEARNING_EVALUATION_CASES.filter(item => !item.tags.includes('negative')).length, 42)
assert.ok(AI_LEARNING_EVALUATION_CASES.filter(item => item.complex).length >= 13)
assert.equal(AI_LEARNING_EVALUATION_CASES.filter(item => item.tags.includes('unregistered')).length, 2)
assert.ok(AI_LEARNING_EVALUATION_CASES.some(item => item.tags.includes('private_data')))
assert.ok(AI_LEARNING_EVALUATION_CASES.some(item => item.tags.includes('product_service')))
assert.equal(AI_LEARNING_EVALUATION_CASES.some(item => item.tags.includes('location') || item.tags.includes('time')), false)
const evaluationSources = new Set(AI_LEARNING_EVALUATION_CASES.flatMap(item => item.entities || []).map(item => item.source).filter(Boolean))
assert.deepEqual([...evaluationSources].sort(), ['discoverLearningOptions', 'openLearningDestination'])
assert.ok(AI_LEARNING_EVALUATION_CASES.some(item=>/Edexcel/.test(item.intent)))
assert.ok(AI_LEARNING_EVALUATION_CASES.some(item=>/OxfordAQA/.test(item.intent)))

const evaluation = JSON.parse(fs.readFileSync(path.join(root, 'evaluation', 'ai-mode-learning-navigation.json'), 'utf8'))
assert.equal(evaluation.cases.length, 50)
assert.ok(evaluation.cases.every(item => Object.keys(item).every(key => ['intent', 'tags', 'entities'].includes(key))))
assert.ok(evaluation.cases.every(item => !Object.hasOwn(item, 'complex')))

console.log(JSON.stringify({
  status: 'passed',
  destinations: registry.destinations.length,
  knowledgeFiles: uploadManifest.files.length,
  evaluationCases: evaluation.cases.length,
  positiveCases: 42,
  negativeCases: 8,
}))
