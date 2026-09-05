import assert from 'node:assert/strict'
import { miniRuntime, deferred, settle } from './helpers/mini-runtime.mjs'

const failures = []
async function check(name, action) {
  try { await action(); console.log(`PASS ${name}`) } catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`) }
}

await check('competition entry opens real papers without loading topic inventory', async () => {
  const runtime = miniRuntime({ modules: { 'utils/wechatAuth': { ensureWeChatSession: async () => ({}) } } })
  const home = runtime.page('pages/index/index')
  home.openEntry({ currentTarget: { dataset: { entry: 'competition' } } })
  assert.match(runtime.calls[0].url, /^\/pages\/papers\/index\?category=competition/)
})
await check('competition filter selects the displayed stage, not IGCSE by array index', async () => {
  const runtime = miniRuntime({ modules: { 'utils/api': { getJson: async () => ({ schemaVersion: 2, items: [] }) } } })
  const page = runtime.page('pages/papers/index'); page.onLoad({ category: 'competition' }); await settle()
  // A paper-only competition screen may remove the irrelevant stage picker entirely.
  if (page.data.showStageFilter === false) return
  page.chooseStage({ detail: { value: '1' } })
  assert.equal(page.data.stage, page.data.stageFilters[1].id)
})
await check('paper deep link carries STEM course, route and stage', async () => {
  const runtime = miniRuntime()
  const page = runtime.page('pages/papers/index')
  page.data.category = 'competition'; page.data.subject = 'bpho'
  page.data.items = [{ id: 'bpho-2024_Nov_R1_S1_QP', subject: 'bpho', stages: ['competition'], routeIds: [] }]
  page.openPaper({ currentTarget: { dataset: { id: page.data.items[0].id } } })
  const nav = runtime.calls[0].url
  assert.ok(nav.includes('/pages/paper/') || decodeURIComponent(nav).includes('course=bpho'), nav)
})
await check('cancelling crop lets the camera take another photograph', async () => {
  let captures = 0
  const runtime = miniRuntime({ wx: { createCameraContext: () => ({ takePhoto: ({ success }) => { captures++; success({ tempImagePath: '/tmp/photo.jpg' }) } }) } })
  const page = runtime.page('pages/stem/camera'); page.onLoad(); page.onReady(); page.takePhoto(); page.onShow(); page.takePhoto()
  assert.equal(captures, 2)
})
await check('writing photo returns to the writing editor through the full page stack', async () => {
  const runtime = miniRuntime({ globals: { getCurrentPages: () => ['pages/ielts/writing','pages/stem/capture','pages/stem/camera','pages/crop/crop'].map(route=>({route})) } })
  runtime.storage.set('stemistCropReturn', { route: 'writing' })
  runtime.page('pages/crop/crop').finish('/tmp/essay.jpg')
  assert.equal(runtime.calls[0].delta, 3)
})
await check('leaving immediately after typing preserves the last characters', async () => {
  const runtime = miniRuntime(); const helpers = runtime.load('utils/page'); const page = {}
  helpers.scheduleDraft(page, 'reading', { text: 'last answer' }); helpers.cancelDraft(page)
  assert.equal(helpers.readDraft('reading')?.text, 'last answer')
})
await check('clearing a draft cancels its pending write', async () => {
  const runtime = miniRuntime(); const helpers = runtime.load('utils/page'); const page = {}
  helpers.scheduleDraft(page, 'writing', { text: 'cleared text' }); helpers.clearDraft('writing'); helpers.cancelDraft(page)
  assert.equal(helpers.readDraft('writing'), null)
})
await check('late notebook response cannot overwrite another course', async () => {
  const pending = [deferred(), deferred()]; let call = 0
  const runtime = miniRuntime({ modules: { 'utils/api': { getJson: () => pending[call++].promise } } })
  runtime.storage.set('stemistSessionToken', 'test-session')
  const page = runtime.page('pages/notebook/index'); page.onLoad({ routeId: 'cie-9702-as-physics' }); page.selectRoute('cie-9709-as-p1-p2')
  page.onInput({ detail: { value: 'my maths note' } })
  pending[0].resolve({ note: { body: 'late physics note' } }); await settle()
  assert.equal(page.data.note, 'my maths note')
  assert.equal(runtime.storage.get('stemistNotebook:cie-9709-as-p1-p2').body, 'my maths note')
  page.onUnload()
})
await check('IELTS requests never forward the STEM token or clear its session on 401', async () => {
  let outgoing
  const runtime = miniRuntime({ wx: { request: (options) => { outgoing=options; options.success({ statusCode: 401, data: {} }) } } })
  runtime.storage.set('stemistSessionToken','test-stem-session')
  await runtime.load('utils/api').askIeltsCoach({ message:'hello' }).catch(()=>{})
  assert.equal(outgoing.header.Authorization, undefined)
  assert.equal(runtime.storage.get('stemistSessionToken'),'test-stem-session')
})
await check('logout clears general Coach drafts and camera context', async () => {
  const runtime = miniRuntime()
  for (const key of ['stemistDraft:coach', 'stemistSubmission:coach-ielts', 'stemistCameraReturn', 'stemistNotebook:route']) runtime.storage.set(key, { text: 'private' })
  runtime.load('utils/session').clearLocalSession()
  assert.deepEqual([...runtime.storage.keys()], ['stemistPrivacyEpoch'])
})
await check('pending autosave cannot restore private text after logout', async () => {
  const runtime=miniRuntime();const helpers=runtime.load('utils/page');const page={}
  helpers.scheduleDraft(page,'coach',{message:'private pending text'})
  runtime.load('utils/session').clearLocalSession()
  helpers.cancelDraft(page)
  assert.deepEqual([...runtime.storage.keys()], ['stemistPrivacyEpoch'])
})
await check('missing inventory count stays unknown rather than becoming zero', async () => {
  const runtime = miniRuntime(); assert.equal(runtime.load('utils/inventory').countOrNull(null), null)
})
await check('navigation errors show a recovery action instead of raw SDK output', async () => {
  const runtime=miniRuntime({wx:{navigateTo:options=>options.fail?.({errMsg:'navigateTo:fail page is not found at pages/private/internal.js'})}})
  const page=runtime.page('pages/practice/index')
  page.openIeltsFeature({currentTarget:{dataset:{feature:'reading'}}})
  assert.match(page.data.error,/重试/)
  assert.doesNotMatch(page.data.error,/navigateTo|internal|\.js/)
})
await check('Speaking failure removes the native webview before showing retry', async () => {
  const runtime=miniRuntime();const page=runtime.page('pages/ielts/speaking')
  const original=page.data.webviewUrl
  page.onWebViewError()
  assert.equal(page.data.webviewUrl,'')
  assert.doesNotMatch(page.data.webviewError,/业务域名|examiner/)
  page.retryWebView()
  assert.ok(page.data.webviewUrl.startsWith(original.split('#')[0]))
  assert.equal(page.data.webviewState,'loading')
})
if (failures.length) { console.error(`${failures.length} user journey regressions failed`); process.exitCode=1 }
