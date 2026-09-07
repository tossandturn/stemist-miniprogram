function normalizeSourceRegion(value, routeId, questionId) {
  const fail = () => { throw new Error('题目原图或裁剪信息不完整，请重新组卷。') }
  if (!value || value.schemaVersion !== 'native-source-region-v1') fail()
  const { region, imageSize, page } = value
  if (!Number.isInteger(page) || page < 1 || page > 1000 || !Array.isArray(region) || region.length !== 4 ||
    !region.every(Number.isFinite) || region[0] < 0 || region[1] < 0 || region[2] > 1 || region[3] > 1 || region[0] >= region[2] || region[1] >= region[3] ||
    !Array.isArray(imageSize) || imageSize.length !== 2 || !imageSize.every(n => Number.isInteger(n) && n > 0 && n <= 10000) || imageSize[0] * imageSize[1] > 24000000) fail()
  const prefix = '/api/stem/practice-source-image?routeId=' + encodeURIComponent(routeId) + '&sourceQuestionId=' + encodeURIComponent(questionId)
  const url = String(value.url || '')
  if (!url.startsWith(prefix) || !/^&region=(?:[0-9]|1[0-9])&v=[a-f0-9]{64}$/.test(url.slice(prefix.length))) fail()
  return { url, page, region: region.slice(), imageSize: imageSize.slice() }
}

function sourceRegionStyle(value) {
  const [x0, y0, x1, y1] = value.region, [width, height] = value.imageSize
  const dx = x1 - x0, dy = y1 - y0, percent = n => (n * 100).toFixed(6) + '%'
  return { cropped: true, clipStyle: 'padding-top:' + percent(height * dy / (width * dx)) + ';',
    imageStyle: 'width:' + percent(1 / dx) + ';height:' + percent(1 / dy) + ';left:' + percent(-x0 / dx) + ';top:' + percent(-y0 / dy) + ';' }
}

module.exports = { normalizeSourceRegion, sourceRegionStyle }
