const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const COMPRESSION_QUALITIES = [82, 65, 50, 35]

function compressImage(filePath, quality = COMPRESSION_QUALITIES[0]) {
  if (typeof wx.compressImage !== 'function') return Promise.resolve(filePath)
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality,
      success: ({ tempFilePath }) => resolve(tempFilePath || filePath),
      fail: () => resolve(filePath),
    })
  })
}

function readBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: ({ data }) => {
        resolve(String(data || ''))
      },
      fail: (error) => reject(new Error(error.errMsg || '图片读取失败')),
    })
  })
}

function base64ByteLength(data) {
  const clean = String(data || '').replace(/\s+/g, '')
  if (!clean) return 0
  const padding = /==$/.test(clean) ? 2 : /=$/.test(clean) ? 1 : 0
  return Math.max(0, Math.floor(clean.length * 3 / 4) - padding)
}

async function readAsJpegDataUrl(filePath) {
  let lastData = ''
  for (const quality of COMPRESSION_QUALITIES) {
    const compressedPath = await compressImage(filePath, quality)
    const data = await readBase64(compressedPath)
    if (!data) throw new Error('照片内容为空，请重新拍摄')
    lastData = data
    if (base64ByteLength(data) <= MAX_IMAGE_BYTES) return `data:image/jpeg;base64,${data}`
  }
  // Keep this error deterministic and actionable after the bounded quality
  // ladder; never send an oversized payload to the Coach endpoint.
  if (lastData) throw new Error('照片太大，请重新拍摄更清晰且更紧凑的单题照片')
  throw new Error('照片内容为空，请重新拍摄')
}

module.exports = { MAX_IMAGE_BYTES, COMPRESSION_QUALITIES, compressImage, readAsJpegDataUrl }
