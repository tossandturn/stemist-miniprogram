import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'
const routeId = 'cie-0625-igcse-physics', questionId = 'cie-0625-0625_s25_qp_22:q38'
const url = '/api/stem/practice-source-image?routeId=' + routeId + '&sourceQuestionId=' + encodeURIComponent(questionId) + '&region=0&v=' + 'a'.repeat(64)
const descriptor = { url, schemaVersion: 'native-source-region-v1', page: 15, imageSize: [1488, 2105], region: [.075, .58, .9, .713] }
const runtime = miniRuntime(), service = runtime.load('utils/sourceRegion')
const normalized = service.normalizeSourceRegion(descriptor, routeId, questionId), style = service.sourceRegionStyle(normalized)
assert.equal(style.clipStyle, 'padding-top:22.805881%;', '279.965px high / 1227.6px wide, not just normalized coordinates')
for (const edit of [d => d.url = 'https://evil.test/x', d => d.url = d.url.replace(routeId, 'cie-9702-as-physics'), d => d.region[3] = 2, d => d.imageSize[0] = 0, d => d.page = 0, d => d.url += '&file=ms.pdf']) {
  const bad = structuredClone(descriptor); edit(bad); assert.throws(() => service.normalizeSourceRegion(bad, routeId, questionId))
}
const native = runtime.load('utils/nativePractice'), spec = { routeId, stage: 'IGCSE', subjectCode: '0625', syllabusTopicIds: ['space'], components: [2], questionCount: 6 }
const payload = { schemaVersion: 'syllabus-practice-set-v1', ...spec, practiceMode: 'study-only', formalProgressEligible: false,
  questionGroups: Array.from({ length: 6 }, (_, i) => {
    const id = questionId + i
    return { id, routeId, stage: 'IGCSE', subjectCode: '0625', paperComponent: 2, questionNumber: String(i + 1), totalMarks: 1, studentStudyEligible: true,
      sourceRef: { paperId: 'cie-0625-0625_s25_qp_22', paper: '0625_s25_qp_22.pdf' }, sourceContent: { schemaVersion: 'ai-verified-coordinate-source-v1', complete: true, fileComplete: true, pages: [15], assetUrls: [] },
      syllabusMapping: { topicIds: ['space'] }, parts: [{ partId: id + ':a', label: 'main', marks: 1 }], nativeSourceImages: [{ ...descriptor, url: url.replace(encodeURIComponent(questionId), encodeURIComponent(id)) }] }
  }) }
const session = native.createSession(payload, spec), view = native.questionView(session, 0)
assert.equal(view.question.images.length, 1); assert.equal(view.question.images[0].cropped, true); assert.equal(view.question.images[0].clipStyle, style.clipStyle)
assert.equal(view.question.partsLabel, '', 'internal main-part identifiers are not learner copy')
assert.match(view.question.images[0].url, /^https:\/\/stem\.ieltsist\.com\/api\/stem\/practice-source-image\?/)
native.saveSession(session); assert.equal(native.questionView(native.readSession(session.id), 0).question.images[0].clipStyle, style.clipStyle)
const missingPage = structuredClone(payload); missingPage.questionGroups[0].sourceContent.pages.push(16); assert.throws(() => native.validatePracticeSet(missingPage, spec))
const v2 = { ...descriptor, schemaVersion: 'native-source-region-v2', url: url + '&view=region', renderedImageSize: [1229, 281] }
const normalizedV2 = service.normalizeSourceRegion(v2, routeId, questionId)
assert.deepEqual([...normalizedV2.renderedImageSize], [1229, 281])
const v2Style = service.sourceRegionStyle(normalizedV2)
assert.equal(v2Style.imageStyle, 'width:100%;height:100%;left:0;top:0;', 'server-cropped pixels must not be cropped a second time')
assert.equal(v2Style.clipStyle, 'padding-top:22.864117%;', 'reserve the exact integer-pixel crop ratio before download')
for (const edit of [d => d.renderedImageSize[0]++, d => d.url = url, d => d.url += '&region=2', d => d.schemaVersion = 'native-source-region-v1']) {
  const bad = structuredClone(v2); edit(bad); assert.throws(() => service.normalizeSourceRegion(bad, routeId, questionId))
}
const v2Payload = structuredClone(payload)
v2Payload.questionGroups.forEach(g => { g.nativeSourceImages = [{ ...v2, url: v2.url.replace(encodeURIComponent(questionId), encodeURIComponent(g.id)) }] })
const v2Session = native.createSession(v2Payload, spec)
native.saveSession(v2Session)
assert.equal(native.questionView(native.readSession(v2Session.id), 0).question.images[0].imageStyle, v2Style.imageStyle)
console.log('Native source regions: exact route/question URLs, bounded crop geometry, pixel aspect, multi-page completeness and saved-session recovery passed.')
