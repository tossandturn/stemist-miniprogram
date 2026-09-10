const { compressImage } = require('./image')

const PHOTO_KEY = 'stemistCoachPhoto'
const META_KEY = 'stemistCoachPhotoMeta'
const owner = () => String((wx.getStorageSync('stemistUser') || {}).id || 'guest')
const epoch = () => Number(wx.getStorageSync('stemistPrivacyEpoch')) || 0
const folder = () => `${wx.env?.USER_DATA_PATH || ''}/native-coach`

function sameIdentity(expected) {
  return expected && String(expected.owner) === owner() && Number(expected.epoch) === epoch()
}

function ownedPhoto(path) {
  const prefix = `${folder()}/`
  return String(path).startsWith(prefix) && /^coach-[a-z0-9-]+\.jpg$/.test(String(path).slice(prefix.length))
}

function removeCoachPhoto(path) {
  if (!path || !ownedPhoto(path) || !wx.getFileSystemManager) return
  wx.getFileSystemManager().unlink({ filePath: path, fail() {} })
}

function readCoachPhoto(expected, contextId) {
  const path = String(wx.getStorageSync(PHOTO_KEY) || '')
  const meta = wx.getStorageSync(META_KEY) || {}
  if (!path || meta.path !== path) return ''
  if (String(meta.owner) !== String(expected.owner) || Number(meta.epoch) !== Number(expected.epoch)) return ''
  if (String(meta.contextId || '') !== String(contextId || '')) {
    clearCoachPhoto(expected)
    return ''
  }
  return path
}

function clearCoachPhoto(expected) {
  const path = String(wx.getStorageSync(PHOTO_KEY) || '')
  const meta = wx.getStorageSync(META_KEY) || {}
  if (expected && (String(meta.owner) !== String(expected.owner) || Number(meta.epoch) !== Number(expected.epoch))) return false
  wx.removeStorageSync(PHOTO_KEY)
  wx.removeStorageSync(META_KEY)
  removeCoachPhoto(path)
  return true
}

async function persistCoachPhoto(path, expected, metadata = {}, { cancelled = () => false } = {}) {
  const current = () => !cancelled() && sameIdentity(expected)
  if (!current()) throw new Error('账号已变化，请返回 AI Coach 重新选择图片。')
  const source = await compressImage(path)
  if (!current()) throw new Error('账号已变化，请返回 AI Coach 重新选择图片。')
  const fs = wx.getFileSystemManager()
  const directory = folder()
  const destination = `${directory}/coach-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.jpg`
  try { fs.mkdirSync(directory, true) } catch { fs.accessSync(directory) }
  await new Promise((resolve, reject) => fs.copyFile({
    srcPath: source,
    destPath: destination,
    success: resolve,
    fail: () => reject(new Error('图片尚未保存，请检查本机空间后重试。')),
  }))
  if (!current()) {
    removeCoachPhoto(destination)
    throw new Error('账号已变化，图片未写入其他账号。')
  }

  const previousPath = String(wx.getStorageSync(PHOTO_KEY) || '')
  const previousMeta = wx.getStorageSync(META_KEY) || {}
  const meta = { owner: String(expected.owner), epoch: Number(expected.epoch), path: destination, contextId: String(metadata.contextId || ''), savedAt: Date.now() }
  try {
    wx.setStorageSync(META_KEY, meta)
    wx.setStorageSync(PHOTO_KEY, destination)
  } catch {
    removeCoachPhoto(destination)
    try {
      if(previousPath)wx.setStorageSync(PHOTO_KEY,previousPath);else wx.removeStorageSync(PHOTO_KEY)
      if(previousMeta?.path===previousPath)wx.setStorageSync(META_KEY,previousMeta);else wx.removeStorageSync(META_KEY)
    } catch { /* The caller receives the storage failure below. */ }
    throw new Error('图片尚未保存，请检查本机空间后重试。')
  }
  if (previousPath && previousPath !== destination && String(previousMeta.owner) === String(expected.owner) && Number(previousMeta.epoch) === Number(expected.epoch)) removeCoachPhoto(previousPath)
  return destination
}

module.exports = { PHOTO_KEY, META_KEY, readCoachPhoto, clearCoachPhoto, persistCoachPhoto, removeCoachPhoto }
