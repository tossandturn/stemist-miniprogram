const {stageCoachEntry}=require('../../utils/coachEntry')
Component({
  properties: {
    source: { type: String, value: 'unknown' },
    mode: { type: String, value: 'fixed' },
    routeId: { type: String, value: '' },
    stage: { type: String, value: '' },
    subjectCode: { type: String, value: '' },
    category: { type: String, value: '' },
    family: { type: String, value: '' },
  },
  methods: {
    openCoach() {
      const parent=typeof getCurrentPages==='function'?getCurrentPages().slice(-1)[0]:null
      let entry=''
      try{if(typeof parent?.getCoachContext==='function')entry=stageCoachEntry(parent.getCoachContext())}catch{wx.showToast?.({title:'上下文暂未保存，请重试',icon:'none'});return}
      const params = [
        ['source', String(this.data.source || 'unknown').slice(0, 40)],
        ['routeId', String(this.data.routeId || '').slice(0, 120)],
        ['stage', String(this.data.stage || '').slice(0, 30)],
        ['subjectCode', String(this.data.subjectCode || '').slice(0, 20)],
        ['category', String(this.data.category || '').slice(0, 20)],
        ['family', String(this.data.family || '').slice(0, 20)],
        ['entry',entry],
      ].filter(([, value]) => value).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
      wx.navigateTo({
        url: `/pages/coach/index?${params}`,
        fail: () => wx.redirectTo({ url: '/pages/coach/index' }),
      })
    },
  },
})
