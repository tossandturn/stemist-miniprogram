// Live WeChat rendering + public production API. No AI provider call or login
// mutation; camera optics/permissions remain a separate physical-device test.
const assert = require('node:assert/strict')
const automator = require(process.env.WECHAT_AUTOMATOR_MODULE || 'D:/CodexWork/qa-artifacts/stemist-devtools/node_modules/miniprogram-automator')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const bound = (promise, ms = 30000) => { let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('QA operation timed out')), ms) })]).finally(() => clearTimeout(timer)) }
;(async () => {
  const app = await bound(automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' }))
  const exceptions = []; const report = []; let sessionId = ''
  app.on('exception', e => exceptions.push(String(e.message || e).slice(0, 200)))
  const log = (name, details) => { report.push({ name, ...details }); console.log(JSON.stringify(report.at(-1))) }
  async function current(route) {
    for (let i = 0; i < 50; i++) { const p = await app.currentPage(); if (p?.path === route) return p; await delay(100) }
    throw new Error('Expected native page ' + route)
  }
  async function readyButton(page, selector) {
    await page.waitFor(async () => { const button = await page.$(selector); return button && Number((await button.size()).height) >= 44 })
    return page.$(selector)
  }
  try {
    if (process.env.STEM_NATIVE_QA_ORIGIN) await app.evaluate(origin => { getApp().__nativeQaOrigin = getApp().globalData.apiBaseUrl; getApp().globalData.apiBaseUrl = origin }, process.env.STEM_NATIVE_QA_ORIGIN)
    await app.evaluate(() => {
      const keys = wx.getStorageInfoSync().keys.filter(k => /^stemistNative(?:Practice|Recent):/.test(k))
      getApp().__nativeQaRestore = keys.map(key => ({ key, value: wx.getStorageSync(key) }))
    })
    let page = await bound(app.reLaunch('/pages/practice/index?category=alevel&routeId=cie-9702-as-physics'))
    await (await readyButton(page, '[data-tool="topics"]')).tap()
    page = await current('pages/stem/topics')
    await bound(page.waitFor(async () => !(await page.data('loading'))))
    assert.equal(await page.data('error'), '')
    assert.equal(await page.$('web-view'), null)
    for (const n of ['01', '02', '03']) await (await readyButton(page, `[data-id="physics-9702-topic-${n}"]`)).tap()
    await page.waitFor(async () => (await page.data('selected')).length === 3)
    assert.equal(await page.data('availableCount'), 35)
    assert.equal(await page.data('canStart'), true)
    await (await readyButton(page, '[data-count="10"]')).tap()
    log('native topic selection', { uniqueQuestions: 35, selectedTopics: 3, count: await page.data('questionCount') })
    const started = Date.now()
    const previousRecent = await page.data('recentId')
    await (await readyButton(page, '.start-native-practice')).tap()
    await bound(page.waitFor(async () => (await page.data('busy')) || (await page.data('recentId')) !== previousRecent || Boolean(await page.data('error'))))
    await bound(page.waitFor(async () => !(await page.data('busy'))))
    const assemblyError = await page.data('error')
    assert.equal(assemblyError, '', 'Assembly error: ' + assemblyError)
    page = await current('pages/stem/practice')
    sessionId = await page.data('sessionId')
    assert.equal(await page.data('total'), 10)
    assert.equal(await page.$('web-view'), null)
    await page.waitFor('.question-image')
    const renderedBytes = Buffer.byteLength(JSON.stringify(await page.data()))
    log('production assembly to native question', { total: 10, elapsedMs: Date.now() - started, renderedStateBytes: renderedBytes })
    assert.ok(renderedBytes < 16000, 'Only current question and navigation summaries belong in page data')
    await bound(page.waitFor(async () => (await page.data('question')).images.every(image => image.loaded || image.failed)))
    const images = (await page.data('question')).images
    if (images.some(i => !i.loaded)) log('image load failure', { question: (await page.data('question')).number, urls: images.filter(i => !i.loaded).map(i => i.url) })
    assert.ok(images.every(i => i.loaded), 'Original question image must actually load')
    log('complete original images', { loadedPages: images.length, question: (await page.data('question')).number })
    if (process.env.STEM_NATIVE_QA_SCREENSHOT) {
      const { execFileSync } = require('node:child_process')
      // The bundled wechatide screenshot command, not a generated mockup.
      execFileSync('powershell.exe', ['-NoProfile', '-Command', "& 'D:\\微信web开发者工具\\wechatide.cmd' -c Codex simulator_screenshot --project 'D:\\CodexWork\\stemist-miniprogram' --path '" + process.env.STEM_NATIVE_QA_SCREENSHOT.replace(/'/g, "''") + "' --optimize false"], { windowsHide: true, timeout: 20000, stdio: 'pipe' })
    }
    await (await readyButton(page, '[data-index="1"]')).tap()
    await page.waitFor(async () => await page.data('index') === 1)
    const questionId = (await page.data('question')).id
    await (await readyButton(page, '.capture-answer')).tap()
    const camera = await current('pages/stem/camera')
    const context = await camera.data('context')
    assert.equal(context.questionId, questionId)
    assert.equal(context.sessionId, sessionId)
    assert.equal(await camera.data('returnPage'), 'native-practice')
    await camera.callMethod('cancel')
    page = await current('pages/stem/practice')
    assert.equal(await page.data('index'), 1)
    log('camera context and cancel', { questionPreserved: true, photoUploaded: false })
    // Synthetic image exercises native crop/export/file persistence, not the
    // physical camera sensor. Never submit this fixture to a grading provider.
    const fixture = await app.evaluate(() => {
      const path = `${wx.env.USER_DATA_PATH}/qa-native-camera-${Date.now()}.png`
      wx.getFileSystemManager().writeFileSync(path, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1UAAAAASUVORK5CYII=', 'base64')
      getApp().__nativeQaFixture = path
      return path
    })
    await (await readyButton(page, '.capture-answer')).tap()
    await (await current('pages/stem/camera')).callMethod('usePhoto', fixture)
    const crop = await current('pages/crop/crop')
    await crop.waitFor(async () => { const box = await crop.$('.crop-box'); return box && (await box.size()).height > 0 })
    await crop.callMethod('confirm')
    page = await current('pages/stem/practice')
    await page.waitFor(async () => Boolean(await page.data('photo')))
    assert.equal(await page.data('answeredCount'), 1)
    assert.match(await page.data('photo'), /\/native-practice\/mini-set-/)
    assert.equal(await page.data('results').then(r => r.length), 0)
    log('native crop/export/durable save with synthetic fixture', { savedQuestions: 1, providerCalls: 0 })
    page = await app.reLaunch(`/pages/stem/practice?sessionId=${encodeURIComponent(sessionId)}`)
    await page.waitFor('.question-image')
    assert.equal(await page.data('index'), 1)
    assert.equal((await page.data('question')).id, questionId)
    assert.equal(await page.data('answeredCount'), 1)
    const nav = await page.$$('.question-tab')
    for (const element of nav.slice(0, 3)) { const size = await element.size(); assert.ok(size.width >= 44 && size.width <= 56 && size.height >= 44, 'Question index button must remain compact, not WeChat default width') }
    log('cold page restore and touch geometry', { index: 1, questions: nav.length })
    assert.equal(exceptions.length, 0, exceptions.join('; '))
    log('summary', { status: 'pass', steps: report.length, runtimeExceptions: 0, cameraSensorTested: false, aiProviderTested: false })
  } finally {
    // Remove only sessions made by this script; restore the learner's native
    // drafts without touching authentication, notebooks or other product data.
    await app.reLaunch('/pages/index/index')
    await app.evaluate(() => {
      const backup = getApp().__nativeQaRestore
      if (!Array.isArray(backup)) return
      const before = new Set(backup.map(x => x.key))
      wx.getStorageInfoSync().keys.filter(k => /^stemistNative(?:Practice|Recent):/.test(k) && !before.has(k)).forEach(k => {
        if (k.startsWith('stemistNativePractice:')) {
          Object.values(wx.getStorageSync(k)?.answers || {}).forEach(answer => {
            const prefix = `${wx.env.USER_DATA_PATH}/native-practice/`
            if (String(answer.photo || '').startsWith(prefix) && !answer.photo.includes('..')) wx.getFileSystemManager().unlink({ filePath: answer.photo, fail() {} })
          })
        }
        wx.removeStorageSync(k)
      })
      backup.forEach(({ key, value }) => wx.setStorageSync(key, value))
      delete getApp().__nativeQaRestore
      if (String(getApp().__nativeQaFixture || '').startsWith(`${wx.env.USER_DATA_PATH}/qa-native-camera-`)) wx.getFileSystemManager().unlink({ filePath: getApp().__nativeQaFixture, fail() {} })
      delete getApp().__nativeQaFixture
      if (Object.prototype.hasOwnProperty.call(getApp(), '__nativeQaOrigin')) { getApp().globalData.apiBaseUrl = getApp().__nativeQaOrigin; delete getApp().__nativeQaOrigin }
    })
    app.disconnect()
  }
})().catch(error => { console.error(error.message); process.exitCode = 1 })
