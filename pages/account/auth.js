Page({
 onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
 data:{error:''},
 onLoad(){this.openAccount()},
 openAccount(){wx.redirectTo({url:'/bundles/account/auth',fail:()=>this.setData({error:'账号页面未能打开，请重试。'})})},
})
