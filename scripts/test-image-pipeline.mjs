import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'utils/image.js'), 'utf8')

function load(readData) {
  const module = { exports: {} }
  const wx = {
    compressImage: ({ success }) => success({ tempFilePath: 'compressed.jpg' }),
    getFileSystemManager: () => ({ readFile: ({ success }) => success({ data: readData }) }),
  }
  vm.runInNewContext(source, { module, exports: module.exports, wx, Promise, Math, Error })
  return module.exports
}

const normal = load('aGVsbG8=')
assert.equal(await normal.readAsJpegDataUrl('photo.jpg'), 'data:image/jpeg;base64,aGVsbG8=')

const oversized = load('A'.repeat(Math.ceil((4 * 1024 * 1024) * 4 / 3) + 20))
await assert.rejects(() => oversized.readAsJpegDataUrl('photo.jpg'), /照片太大/)
console.log('Image compression/data-url checks passed.')
