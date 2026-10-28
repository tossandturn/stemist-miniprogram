const HOME_ROUTE='/pages/index/index'

function openHome(){
 const relaunch=()=>{if(typeof wx.reLaunch==='function')wx.reLaunch({url:HOME_ROUTE})}
 try{if(typeof wx.redirectTo==='function'){wx.redirectTo({url:HOME_ROUTE,fail:relaunch});return}}catch{}
 relaunch()
}

function leaveAccount(){
 let depth=0
 try{depth=typeof getCurrentPages==='function'?getCurrentPages().length:0}catch{}
 if(depth>1&&typeof wx.navigateBack==='function')try{wx.navigateBack({fail:openHome});return}catch{}
 openHome()
}

function createAccountAttempt(){
 let rejectCancel
 const cancelPromise=new Promise((resolve,reject)=>{rejectCancel=reject})
 return{cancelled:false,done:false,task:null,cancelPromise,current(){if(this.cancelled)throw Object.assign(new Error('已取消账号登录。'),{code:'account_login_cancelled'})},isCancelled(){return this.cancelled},onTask(task){this.task=task;if(this.cancelled)try{task?.abort()}catch{}},cancel(){if(this.cancelled||this.done)return false;this.cancelled=true;try{this.task?.abort()}catch{};rejectCancel(Object.assign(new Error('已取消账号登录。'),{code:'account_login_cancelled'}));return true},finish(){this.done=true}}
}

module.exports={HOME_ROUTE,createAccountAttempt,leaveAccount}
