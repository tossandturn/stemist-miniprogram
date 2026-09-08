Component({
 properties:{state:{type:Object,value:null}},
 methods:{
  cancel(){this.triggerEvent('cancel')},
  retry(){this.triggerEvent('retry')},
  toggle(){this.triggerEvent('toggle')},
 }
})
