import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'utils/image.js'), 'utf8')

function load(readData) {
  const qualities = []
  const module = { exports: {} }
  const wx = {
    compressImage: ({ quality, success }) => { qualities.push(quality); success({ tempFilePath: 'compressed.jpg' }) },
    getFileSystemManager: () => ({ readFile: ({ success }) => success({ data: readData }) }),
  }
  vm.runInNewContext(source, { module, exports: module.exports, wx, Promise, Math, Error })
  return { api: module.exports, qualities }
}

const jpeg = Buffer.from([255,216,255,224,0,16,74,70,73,70]).toString('base64')
const normal = load(jpeg)
assert.equal(await normal.api.readAsJpegDataUrl('photo.jpg'), 'data:image/jpeg;base64,'+jpeg)
assert.deepEqual(normal.qualities, [82])
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64')
assert.equal(await load(png).api.readAsJpegDataUrl('camera.png'),'data:image/png;base64,'+png,'the payload MIME must match the actual compressed bytes')
const webp=Buffer.from('RIFF....WEBP','ascii').toString('base64')
assert.equal(await load(webp).api.readAsJpegDataUrl('camera.webp'),'data:image/webp;base64,'+webp)
await assert.rejects(()=>load('aGVsbG8=').api.readAsJpegDataUrl('not-an-image'),/格式/)

const oversized = load('A'.repeat(Math.ceil((4 * 1024 * 1024) * 4 / 3) + 20))
await assert.rejects(() => oversized.api.readAsJpegDataUrl('photo.jpg'), /照片太大/)
assert.deepEqual(oversized.qualities, [82, 65, 50, 35])
console.log('Image compression/data-url checks passed.')
