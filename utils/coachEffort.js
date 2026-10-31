const KEY='stemistCoachEffort:v1',LEVELS=['low','high','max'],SCOPES=['academic','steps','answers','check','tavern','admissions','ielts-teacher','pdf']
const identity=()=>({owner:String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch:Number(wx.getStorageSync('stemistPrivacyEpoch'))||0})
function preferences(){try{const saved=wx.getStorageSync(KEY),who=identity();return saved?.owner===who.owner&&saved?.epoch===who.epoch?saved:{}}catch{return{}}}
function coachEffortPreference(scope='academic'){const saved=preferences(),value=saved.scopes?.[scope]||(scope==='academic'?saved.value:'');return LEVELS.includes(value)?value:'auto'}
function recommendedEffort(scope,message=''){if(scope==='pdf')return'high';if(['admissions','ielts-teacher'].includes(scope)&&(String(message).trim().length>=800||/规划|计划|竞争力|选校|文书|作文|逐段|批改|对比|分析.{0,10}(背景|申请|文章)|personal statement|study plan|essay|compare|proofread/i.test(String(message))))return'high';return'low'}
function readCoachEffort(scope='academic',message=''){const value=coachEffortPreference(scope);return value==='auto'?recommendedEffort(scope,message):value}
function saveCoachEffort(value,scope='academic'){if(![...LEVELS,'auto'].includes(value)||!SCOPES.includes(scope))throw Error('请选择有效的思考强度。');try{const saved=preferences();wx.setStorageSync(KEY,{...identity(),scopes:{...(saved.scopes||{}),[scope]:value}})}catch{throw Error('设置未能保存，请释放小程序存储后重试。')}return value}
const academicEffortScope=(intent,feature='')=>intent==='hint'||feature==='steps'?'steps':intent==='check-work'?'check':intent==='worked-solution'||feature==='answers'?'answers':'academic'
const coachEffortTimeout=(value,fallback=55000)=>value==='max'?130000:value==='high'?105000:fallback
module.exports={readCoachEffort,saveCoachEffort,coachEffortPreference,academicEffortScope,coachEffortTimeout}
