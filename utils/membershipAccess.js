let dialogOpen = false
function offerMembership() {
  if (dialogOpen || typeof wx.showModal !== 'function') return
  const current = typeof getCurrentPages === 'function' ? getCurrentPages().slice(-1)[0] : null
  if (current?.route === 'bundles/account/membership') return
  const owner = String(wx.getStorageSync('stemistUser')?.id || 'guest')
  const epoch = Number(wx.getStorageSync('stemistPrivacyEpoch')) || 0
  dialogOpen = true
  const complete = () => { dialogOpen = false }
  try {
    wx.showModal({ title: '需要全功能会员', content: '当前内容已保留。可前往会员中心查看开通方式。', confirmText: '查看会员', cancelText: '稍后',
      success(result) {
        if (result.confirm && owner === String(wx.getStorageSync('stemistUser')?.id || 'guest') && epoch === (Number(wx.getStorageSync('stemistPrivacyEpoch')) || 0)) wx.navigateTo({ url: '/bundles/account/membership' })
      }, complete,
    })
  } catch { complete() }
}
module.exports = { offerMembership }
