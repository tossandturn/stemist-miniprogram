function compressImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality: 82,
      success: ({ tempFilePath }) => resolve(tempFilePath || filePath),
      fail: () => resolve(filePath),
    })
  })
}

function readAsJpegDataUrl(filePath) {
  return compressImage(filePath).then((compressedPath) => new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: compressedPath,
      encoding: 'base64',
      success: ({ data }) => {
        if (!data) {
          reject(new Error('照片内容为空，请重新拍摄'))
          return
        }
        // Keep the client aligned with the server's per-image limit. Base64 is
        // roughly 4/3 the binary size, so reject before an oversized request.
        const byteLength = Math.floor(data.length * 3 / 4)
        if (byteLength > 4 * 1024 * 1024) {
          reject(new Error('照片太大，请重新拍摄更清晰且更紧凑的单题照片'))
          return
        }
        resolve(`data:image/jpeg;base64,${data}`)
      },
      fail: (error) => reject(new Error(error.errMsg || '图片读取失败')),
    })
  }))
}

module.exports = { compressImage, readAsJpegDataUrl }
