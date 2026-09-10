import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'

const copied = []
const removed = []
const fileSystem = {
  mkdirSync() {},
  accessSync() {},
  copyFile(options) { copied.push(options.destPath); options.success() },
  unlink({ filePath }) { removed.push(filePath) },
}

const requests = []
const runtime = miniRuntime({
  wx: {
    env: { USER_DATA_PATH: '/owned' },
    getFileSystemManager: () => fileSystem,
  },
  modules: {
    'utils/image': {
      compressImage: async (path) => path,
      readAsJpegDataUrl: async (path) => `data:image/jpeg;base64,${path}`,
    },
    'utils/coach': {
      runCoach: async (request) => {
        requests.push(request)
        return { mode: 'ai', providerStatus: 'connected', answer: 'Image understood.', coachState: { label: 'AI 已连接' } }
      },
    },
  },
})
runtime.storage.set('stemistUser', { id: 'ielts:photo' })
runtime.storage.set('stemistCoachPhoto', '/owned/native-coach/coach-existing.jpg')
runtime.storage.set('stemistCoachPhotoMeta', { owner: 'ielts:photo', epoch: 0, path: '/owned/native-coach/coach-existing.jpg', contextId: 'ielts' })

const page = runtime.page('pages/coach/index')
page.onLoad({ source: 'ielts', category: 'ielts' })
page.onShow()
assert.equal(page.data.imagePath, '/owned/native-coach/coach-existing.jpg')
await page.submit()
assert.equal(requests.length, 1, 'an image alone is a complete Coach question')
assert.equal(requests[0].context.product, 'IELTSist')
assert.equal(requests[0].context.inputMode, 'photo')
assert.deepEqual(Array.from(requests[0].imageDataUrls), ['data:image/jpeg;base64,/owned/native-coach/coach-existing.jpg'])
assert.match(requests[0].message, /图片/)

page.chooseContext({ currentTarget: { dataset: { context: 'stem-photo' } } })
assert.equal(page.data.imagePath, '', 'switching products must not carry an IELTS image into STEM')
assert.equal(runtime.storage.has('stemistCoachPhoto'), false)
assert.ok(removed.includes('/owned/native-coach/coach-existing.jpg'))

let albumOptions
const album = miniRuntime({ wx: { chooseMedia: (options) => { albumOptions = options } } })
album.storage.set('stemistUser', { id: 'ielts:album' })
const albumPage = album.page('pages/coach/index')
albumPage.onLoad({ source: 'writing', category: 'ielts' })
albumPage.uploadImage()
assert.deepEqual(Array.from(albumOptions.sourceType), ['album'])
assert.deepEqual(Array.from(albumOptions.mediaType), ['image'])
albumOptions.success({ tempFiles: [{ tempFilePath: '/album/essay.jpg' }] })
assert.equal(album.storage.get('stemistCropReturn').route, 'coach-home')
assert.equal(album.storage.get('stemistCropReturn').context.contextId, 'writing')
assert.match(album.calls.at(-1).url, /^\/pages\/crop\/crop\?src=/)

const camera = miniRuntime()
camera.storage.set('stemistUser', { id: 'stem:camera' })
const cameraPage = camera.page('pages/coach/index')
cameraPage.onLoad({ source: 'alevel', category: 'alevel', routeId: 'cie-9702-as-physics' })
cameraPage.takePhoto()
assert.equal(camera.storage.get('stemistCameraReturn').route, 'coach-home')
assert.equal(camera.storage.get('stemistCameraReturn').context.contextId, 'stem-photo')
assert.equal(camera.storage.get('stemistCameraReturn').context.routeContext.routeId, 'cie-9702-as-physics')
assert.equal(camera.calls.at(-1).url, '/pages/stem/camera')
const nativeCameraPage=camera.page('pages/stem/camera')
nativeCameraPage.onLoad()
assert.equal(nativeCameraPage.data.returnPage,'coach-home')
assert.equal(nativeCameraPage.data.routeId,'cie-9702-as-physics')
nativeCameraPage.onUnload()

for (const source of ['speaking', 'vocabulary']) {
  const ieltsEntry = miniRuntime().page('pages/coach/index')
  ieltsEntry.onLoad({ source, category: 'ielts' })
  assert.equal(ieltsEntry.data.contextId, 'ielts', `${source} must open the IELTS image Coach, not STEM`)
  ieltsEntry.onUnload()
}

const late = miniRuntime({ wx: { chooseMedia: (options) => { albumOptions = options } } })
const latePage = late.page('pages/coach/index')
latePage.onLoad({ source: 'ielts' })
latePage.uploadImage()
latePage.onUnload()
albumOptions.success({ tempFiles: [{ tempFilePath: '/album/late.jpg' }] })
assert.equal(late.storage.has('stemistCropReturn'), false, 'a late album callback cannot attach after leaving Coach')

const crop = miniRuntime({
  wx: {
    env: { USER_DATA_PATH: '/owned' },
    getFileSystemManager: () => fileSystem,
  },
  modules: { 'utils/image': { compressImage: async (path) => path } },
})
crop.storage.set('stemistUser', { id: 'ielts:crop' })
crop.storage.set('stemistCropReturn', { route: 'coach-home', captureId: 'coach-photo-1', context: { contextId: 'ielts', routeContext: { category: 'ielts' } } })
const cropPage = crop.page('pages/crop/crop')
cropPage.onLoad({ src: '/album/source.jpg' })
await cropPage.finish('/album/cropped.jpg')
assert.match(crop.storage.get('stemistCoachPhoto'), /^\/owned\/native-coach\/coach-[a-z0-9-]+\.jpg$/)
assert.equal(crop.storage.get('stemistCoachPhotoMeta').owner, 'ielts:crop')
assert.equal(crop.storage.get('stemistCoachPhotoMeta').contextId, 'ielts')
assert.match(crop.calls.at(-1).url, /^\/pages\/coach\/index\?source=ielts/)

console.log('Native Coach photo: camera and album entry, crop return, photo-only multimodal submit, account ownership and cross-product isolation passed.')
