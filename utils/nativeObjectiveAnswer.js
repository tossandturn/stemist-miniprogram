const {requestJson}=require('./api')
const {CHOICES}=require('./nativeChoice')
function validateObjectiveResult(value,expected){
 if(value?.schemaVersion!=='stem-objective-result-v1'||typeof value.available!=='boolean'||value.maxScore!==1)throw Error('未收到有效的选择题核对结果。')
 for(const key of ['attemptId','mode','routeId','stage','paperId','sourceQuestionId','selectedOption'])if(value[key]!==expected[key])throw Error('选择题结果与当前作答不匹配。')
 if(value.available){
  if(value.source!=='mark-scheme'||value.sourceStatus!=='reviewed-official-key'||!CHOICES.includes(value.correctOption)||![0,1].includes(value.score)||value.score!==(value.correctOption===expected.selectedOption?1:0))throw Error('标准答案核对结果无效。')
 }else if(value.source!=='unavailable'||value.score!==null||value.correctOption!==null)throw Error('待核验题目不能显示得分。')
 return {available:value.available,source:value.source,score:value.score,maxScore:1,correctOption:value.correctOption,selectedOption:expected.selectedOption,sourceQuestionId:expected.sourceQuestionId}
}
async function gradeObjectiveAnswer(expected){return validateObjectiveResult(await requestJson('/api/stem/objective-answers',expected,{timeout:20000}),expected)}
module.exports={gradeObjectiveAnswer,validateObjectiveResult}
