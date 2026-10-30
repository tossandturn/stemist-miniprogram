const KEY='stemistCoachEffort:v1',LEVELS=['low','high','max']
const identity=()=>({owner:String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch:Number(wx.getStorageSync('stemistPrivacyEpoch'))||0})
function readCoachEffort(){try{const saved=wx.getStorageSync(KEY),who=identity();return saved?.owner===who.owner&&saved?.epoch===who.epoch&&LEVELS.includes(saved.value)?saved.value:'low'}catch{return'low'}}
function saveCoachEffort(value){if(!LEVELS.includes(value))throw Error('请选择有效的思考强度。');try{wx.setStorageSync(KEY,{...identity(),value})}catch{throw Error('设置未能保存，请释放小程序存储后重试。')}return value}
const coachEffortTimeout=(value,fallback=55000)=>value==='max'?130000:value==='high'?105000:fallback
module.exports={readCoachEffort,saveCoachEffort,coachEffortTimeout}
