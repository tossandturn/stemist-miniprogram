const {makeObjectivePage}=require('../../utils/ieltsObjectivePage')
Page({onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},...makeObjectivePage('listening' )})
