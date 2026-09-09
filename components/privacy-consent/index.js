Component({
 properties:{contractName:{type:String,value:'用户隐私保护指引'},purpose:{type:String,value:''},buttonText:{type:String,value:'同意并继续'}},
 data:{checked:false,busy:false,error:''},
 lifetimes:{attached(){this.__disposed=false;this.__verification=0},detached(){this.__disposed=true;this.__verification++;clearTimeout(this.__verificationTimer)}},
 methods:{
  changeChecked(event){if(!this.data.busy)this.setData({checked:Array.isArray(event.detail?.value)&&event.detail.value.includes('agree'),error:''})},
  openContract(){
   if(typeof wx.openPrivacyContract!=='function')return this.setData({error:'当前微信版本无法打开隐私指引，请更新微信。'})
   wx.openPrivacyContract({fail:()=>{if(!this.__disposed)this.setData({error:'隐私指引未能打开，请稍后重试。'})}})
  },
  agree(){
   if(this.__disposed||!this.data.checked||this.data.busy)return
   const verification=++this.__verification
   this.setData({busy:true,error:''})
   const fail=()=>{if(this.__disposed||verification!==this.__verification)return;this.__verification++;clearTimeout(this.__verificationTimer);this.setData({busy:false,error:'微信尚未确认隐私授权，请重试；不会启动相机或录音。'})}
   if(typeof wx.getPrivacySetting!=='function')return fail()
   this.__verificationTimer=setTimeout(fail,6000)
   try{wx.getPrivacySetting({success:result=>{
    if(this.__disposed||verification!==this.__verification||!this.data.checked)return
    if(result.needAuthorization!==false)return fail()
    this.__verification++;clearTimeout(this.__verificationTimer)
    this.setData({busy:false});this.triggerEvent('agreed')
   },fail})}catch{fail()}
  },
 },
})
