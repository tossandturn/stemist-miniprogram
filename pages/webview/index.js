const {deviceState,syncDevice}=require('../../utils/page')
const {legacyUrlToNative}=require('../../utils/nativeNavigation')
Page({
 data:deviceState({error:'',loaded:false}),
 onLoad(options={}){const target=legacyUrlToNative(options.url);if(!target){this.setData({error:'这个链接暂时无法在小程序内打开。'});return}wx.redirectTo({url:target,fail:()=>this.setData({error:'对应页面未能打开，请返回重试。'})})},
 onShow(){syncDevice(this)},onResize(){syncDevice(this)},
 back(){wx.navigateBack()}
})
