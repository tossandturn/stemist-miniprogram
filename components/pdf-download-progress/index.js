Component({
 properties:{state:{type:Object,value:null},compact:{type:Boolean,value:false}},
 methods:{
  cancel(){this.triggerEvent('cancel')},
  retry(){this.triggerEvent('retry')},
  toggle(){this.triggerEvent('toggle')},
 }
})
