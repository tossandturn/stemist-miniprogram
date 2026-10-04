// Opt-in real Mini Program + production API acceptance. Only generated QA
// identities and public Cambridge source questions are used. User storage is
// restored in finally; credentials never leave the Mini Program closure.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { call, evaluate, until } = require('./helpers/wechat-cli.cjs')
const account = require('./helpers/native-qa-account.cjs')
if (!process.argv.includes('--run-production')) throw Error('Explicit --run-production required.')
const oi = process.argv.indexOf('--output')
if (oi < 0 || !process.argv[oi + 1]) throw Error('Pass --output <new evidence directory>.')
const output = path.resolve(process.argv[oi + 1])
const routeId = 'cie-9700-as-biology', topicId = '9700-as-topic-08'
// Chapter-study exposes 1/3/5/10/15 sizes, not the legacy six-question chip.
// Exercise five real UI-selected questions while asserting all six are published.
const exerciseCount = 5
// Independent source checks use published official MS answers, not API keys.
const officialKeys = {
  'cie-9700-9700_s25_qp_12:q32': 'A', 'cie-9700-9700_s25_qp_12:q33': 'B',
  'cie-9700-9700_s25_qp_12:q34': 'C', 'cie-9700-9700_s25_qp_13:q32': 'B',
  'cie-9700-9700_s25_qp_14:q32': 'D', 'cie-9700-9700_s25_qp_14:q33': 'B',
}
const tap = selector => call('automation_element_action', { action: 'tap', selector, 'wait-for-selector': selector })
async function scrollTo(selector, datasetId = '') {
  const source = `function(){return new Promise(resolve=>{const p=getCurrentPages().at(-1),q=wx.createSelectorQuery().in(p);q.selectAll(${JSON.stringify(selector)}).boundingClientRect();q.selectViewport().scrollOffset();q.exec(r=>{const rows=r[0]||[],hit=${JSON.stringify(datasetId)}?rows.find(x=>x.dataset?.id===${JSON.stringify(datasetId)}):rows[0];resolve(Math.max(0,(hit?.top||0)+(r[1]?.scrollTop||0)-120))})})}`
  await call('automation_viewport_action', { action: 'pageScrollTo', 'scroll-top': await evaluate(source) })
}
async function geometry(selector) {
  return evaluate(`function(){return new Promise(resolve=>{const p=getCurrentPages().at(-1),q=wx.createSelectorQuery().in(p);q.selectAll(${JSON.stringify(selector)}).boundingClientRect();q.exec(r=>{const w=wx.getWindowInfo();resolve({width:w.windowWidth,height:w.windowHeight,rects:r[0]||[]})})})}`)
}
async function shot(name) { await call('simulator_screenshot', { path: path.join(output, name + '.png'), optimize: false }) }

async function main() {
  assert.equal(fs.existsSync(path.join(output, 'chapter-checked-native-live.json')), false)
  fs.mkdirSync(output, { recursive: true })
  const report = { status: 'pending', routeId, topicId, client: 'SHA-frozen-development-runtime',
    account: 'generated-isolated', source: 'public-official-QP-MS', physicalDeviceVerified: false,
    formalProgressEligible: false, questions: [] }
  try {
    await account.begin()
    await evaluate(function () { require('utils/inventory.js').clearInventoryCache(); return true })
    await call('automation_navigate', { action: 'navigateTo', url: '/pages/stem/topics?routeId=' + routeId })
    const builder = await until(function () {
      const p = getCurrentPages().at(-1)
      if (p?.route !== 'pages/stem/topics' || p.data.loading || !p.data.topics?.length) return null
      return { studyMode: p.data.studyMode, foundationCatalog: p.data.foundationCatalog, error: p.data.error,
        device: p.data.deviceClass, orientation: p.data.orientation,
        window: { width: wx.getWindowInfo().windowWidth, height: wx.getWindowInfo().windowHeight },
        topics: p.data.topics.map(t => ({ id: t.id, official: t.officialAvailable, original: t.originalAvailable })) }
    }, 'real checked chapter inventory', 30000)
    report.builder = builder
    assert.equal(builder.error, '')
    assert.equal(builder.studyMode, 'chapter-study')
    assert.equal(builder.foundationCatalog, 'v2')
    assert.equal(builder.device, 'device-phone', 'test must use the actual phone simulator, not spoofed classes')
    assert.ok(builder.window.width < 768 && builder.window.height > builder.window.width, 'actual phone portrait geometry is required')
    assert.equal(builder.topics.find(t => t.id === topicId)?.official, 6, 'six source-checked official questions must really be published')
    await scrollTo('.topic-choice', topicId)
    await tap('.topic-choice[data-id="' + topicId + '"]')
    await scrollTo('.component-shortcuts')
    await tap('.component-shortcuts .option-chip[data-value="1"]')
    await scrollTo('.start-native-practice')
    await tap('.option-chip[data-count="' + exerciseCount + '"]')
    const selection = await evaluate(function () {
      const p = getCurrentPages().at(-1)
      return { topics: p.data.selected, components: p.data.components, count: p.data.questionCount,
        canStart: p.data.canStart, error: p.data.error }
    })
    assert.deepEqual(selection, { topics: [topicId], components: [1], count: exerciseCount, canStart: true, error: '' })
    await shot('checked-chapter-builder')
    await tap('.start-native-practice')
    const ready = await until(function () {
      const p = getCurrentPages().at(-1)
      if (p?.route !== 'pages/stem/practice' || !p.data.question) return null
      const s = require('utils/nativePractice.js').readSession(p.data.sessionId)
      return { sessionId: p.data.sessionId, ids: s.questions.map(q => q.id), count: p.data.total,
        studyMode: s.studyMode, sourcePreference: s.sourcePreference, formal: s.formalProgressEligible,
        ownerMatches: s.owner === getApp().__nativeQa.id, error: p.data.error }
    }, 'real checked MCQ chapter set', 30000)
    assert.equal(ready.error, '')
    assert.equal(ready.count, exerciseCount)
    assert.equal(ready.formal, false)
    assert.equal(ready.studyMode, 'chapter-study')
    assert.equal(ready.sourcePreference, 'official-first')
    assert.equal(ready.ownerMatches, true)
    assert.equal(new Set(ready.ids).size, exerciseCount)
    assert.ok(ready.ids.every(id => Object.hasOwn(officialKeys, id)), 'no unrelated or original replacement question')
    report.publishedSourceQuestions = Object.keys(officialKeys).length
    report.uiExerciseCount = exerciseCount
    for (let index = 0; index < exerciseCount; index++) {
      await tap('.question-tab[data-index="' + index + '"]')
      const q = await until(function () {
        const p = getCurrentPages().at(-1), q = p?.data.question
        return q && q.images.length && q.images.every(i => i.loaded && !i.failed) ? {
          id: q.id, index: p.data.index, original: q.original, choice: q.choiceMode,
          labels: q.options.map(o => o.label).join(''), reviewLabel: q.reviewLabel,
          reviewNotice: q.reviewNotice, images: q.images.map(i => ({ url: i.url, loaded: i.loaded, failed: i.failed })),
          photo: p.data.photo, error: p.data.error,
        } : null
      }, 'loaded exact question image ' + index, 30000)
      assert.equal(q.index, index)
      assert.equal(q.id, ready.ids[index])
      assert.equal(q.original, false)
      assert.equal(q.choice, true, 'official P1 must not ask for a photo')
      assert.equal(q.labels, 'ABCD')
      assert.equal(q.reviewLabel, 'AI 审核')
      assert.match(q.reviewNotice, /不计正式进度/)
      assert.equal(q.photo, '')
      assert.equal(q.error, '')
      const expected = officialKeys[q.id]
      await scrollTo('.mcq-options')
      await tap('.mcq-option[data-value="' + expected + '"]')
      await scrollTo('.answer-panel .primary')
      const buttons = await geometry('.answer-panel .primary')
      assert.ok(buttons.rects.length && buttons.rects.every(r => r.height >= 44 && r.left >= 0 && r.right <= buttons.width + 1))
      await tap('.answer-panel .primary')
      const result = await until(function () {
        const p = getCurrentPages().at(-1)
        return !p.data.busy && (p.data.objectiveResult || p.data.error) ? {
          result: p.data.objectiveResult, error: p.data.error, photo: p.data.photo,
          imagesUnchanged: p.data.question.images.every(i => i.loaded && !i.failed),
        } : null
      }, 'submitted official checked answer ' + index, 30000)
      assert.equal(result.error, '')
      assert.equal(result.photo, '')
      assert.equal(result.result.available, true)
      assert.equal(result.result.score, 1)
      assert.equal(result.result.maxScore, 1)
      assert.equal(result.result.correctOption, expected)
      assert.equal(result.result.qualityFlag, 'aicheck')
      assert.equal(result.result.formalProgressEligible, false)
      assert.equal(result.imagesUnchanged, true)
      report.questions.push({ sourceQuestionId: q.id, images: q.images.length, exactOfficialAnswerMatched: true,
        score: 1, maxScore: 1, labelledAiChecked: true, photoRequested: false, imageStatePreserved: true })
      if (index === 0 || /q32$/.test(q.id) && /qp_12/.test(q.id)) {
        await shot('checked-answer-' + index)
      }
    }
    const restored = await evaluate(function () {
      const p = getCurrentPages().at(-1), n = require('utils/nativePractice.js'), s = n.readSession(p.data.sessionId)
      return { ownerMatches: s.owner === getApp().__nativeQa.id,
        answered: s.questions.filter(q => s.answers[q.id]?.choice).length,
        scored: s.questions.filter(q => s.answers[q.id]?.objectiveResult?.qualityFlag === 'aicheck').length,
        allNonformal: s.questions.every(q => s.answers[q.id]?.objectiveResult?.formalProgressEligible === false) }
    })
    assert.deepEqual(restored, { ownerMatches: true, answered: exerciseCount, scored: exerciseCount, allNonformal: true })
    report.restored = restored
    await call('automation_navigate', { action: 'navigateBack' })
    const resume = await until(function () {
      const p = getCurrentPages().at(-1)
      return p?.route === 'pages/stem/topics' && p.data.recentId ? { mode: p.data.studyMode, label: p.data.recentLabel } : null
    }, 'owned source chapter resume', 15000)
    assert.equal(resume.mode, 'chapter-study')
    assert.ok(resume.label.includes(exerciseCount + '/' + exerciseCount))
    assert.match(resume.label, /真题章节练习/)
    report.resume = resume
    await shot('checked-chapter-resume')
    report.status = 'pass'
  } catch (error) {
    report.status = 'fail'
    report.error = String(error.message || 'chapter native acceptance failed')
    throw error
  } finally {
    await account.end()
    fs.writeFileSync(path.join(output, 'chapter-checked-native-live.json'), JSON.stringify(report, null, 2), 'utf8')
  }
  console.log(JSON.stringify(report))
}
main().catch(error => { console.error(String(error.message)); process.exitCode = 1 })
