// Isolated native camera handoff/crop/filesystem regression. A synthetic image
// replaces the camera sensor; this is not physical-device or AI-provider QA.
const assert = require('node:assert/strict')
const automator = require(process.env.WECHAT_AUTOMATOR_MODULE || 'D:/CodexWork/qa-artifacts/stemist-devtools/node_modules/miniprogram-automator')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
;(async () => {
  const app = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
  let sessionId, fixture
  async function current(route) {
    for (let i = 0; i < 120; i++) { const page = await app.currentPage(); if (page?.path === route) return page; await sleep(100) }
    const p = await app.currentPage()
    throw new Error(`Expected ${route}, got ${p?.path}; error=${await p?.data('error')}`)
  }
  try {
    const setup = await app.evaluate(() => {
      const sessionId = `mini-set-qa-photo-${Date.now().toString(36)}`
      const fixture = `${wx.env.USER_DATA_PATH}/qa-native-camera-${Date.now()}.png`
      wx.getFileSystemManager().writeFileSync(fixture, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1UAAAAASUVORK5CYII=', 'base64')
      const recentKey = 'stemistNativeRecent:cie-9702-as-physics'
      getApp().__photoQaRecent = { exists: wx.getStorageInfoSync().keys.includes(recentKey), value: wx.getStorageSync(recentKey) }
      wx.setStorageSync(`stemistNativePractice:${sessionId}`, { id: sessionId, schema: 1, privacyEpoch: Number(wx.getStorageSync('stemistPrivacyEpoch')) || 0,
        owner: '', routeId: 'cie-9702-as-physics', stage: 'AS', subjectCode: '9702', index: 0, answers: {},
        questions: [{ id: 'qa-photo-only', number: 'QA', sourceLabel: 'Synthetic camera test', marks: 0,
          images: ['/question-assets/cie-9702-9702_w25_qp_24/qp-12.jpg'], parts: [{ id: 'qa', label: '', marks: 0, canMark: false }] }] })
      return { sessionId, fixture }
    })
    sessionId = setup.sessionId; fixture = setup.fixture
    let page = await app.reLaunch(`/pages/stem/practice?sessionId=${sessionId}`)
    await page.waitFor('.capture-answer')
    await (await page.$('.capture-answer')).tap()
    const camera = await current('pages/stem/camera')
    assert.equal((await camera.data('context')).questionId, 'qa-photo-only')
    await camera.callMethod('usePhoto', fixture)
    const crop = await current('pages/crop/crop')
    await crop.waitFor(async () => Number((await (await crop.$('.crop-box')).size()).height) > 0)
    await crop.callMethod('confirm')
    page = await current('pages/stem/practice')
    await page.waitFor(async () => Boolean(await page.data('photo')))
    const photo = await page.data('photo')
    assert.match(photo, /\/native-practice\/mini-set-/)
    assert.equal(await page.data('answeredCount'), 1)
    const durable = await app.evaluate(path => { const fs = wx.getFileSystemManager(); try { fs.accessSync(path); return true } catch { return false } }, photo)
    assert.equal(durable, true)
    page = await app.reLaunch(`/pages/stem/practice?sessionId=${sessionId}`)
    await page.waitFor('.answer-image')
    assert.equal(await page.data('photo'), photo)
    assert.equal(await page.data('answeredCount'), 1)
    assert.equal(await page.$('.mark-answer'), null)
    console.log(JSON.stringify({ status: 'pass', nativeCropExport: true, durablePhoto: true, coldPageRestore: true, physicalCamera: false, providerCalls: 0 }))
  } finally {
    await app.reLaunch('/pages/index/index')
    if (sessionId) await app.evaluate((id, image) => {
      const key = `stemistNativePractice:${id}`
      const photo = wx.getStorageSync(key)?.answers?.['qa-photo-only']?.photo
      if (String(photo || '').startsWith(`${wx.env.USER_DATA_PATH}/native-practice/${id}-`)) wx.getFileSystemManager().unlink({ filePath: photo, fail() {} })
      if (String(image || '').startsWith(`${wx.env.USER_DATA_PATH}/qa-native-camera-`)) wx.getFileSystemManager().unlink({ filePath: image, fail() {} })
      wx.removeStorageSync(key)
      const restore = getApp().__photoQaRecent
      if (restore?.exists) wx.setStorageSync('stemistNativeRecent:cie-9702-as-physics', restore.value)
      else wx.removeStorageSync('stemistNativeRecent:cie-9702-as-physics')
      wx.removeStorageSync('stemistCameraReturn'); wx.removeStorageSync('stemistCropReturn')
      delete getApp().__photoQaRecent
    }, sessionId, fixture)
    app.disconnect()
  }
})().catch(error => { console.error(error.message); process.exitCode = 1 })
