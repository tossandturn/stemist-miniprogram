const CHOICES=['A','B','C','D']
const CHOICE_COMPONENTS={'9700':[1],'9701':[1],'9702':[1],'9708':[1,3],'0610':[1,2],'0620':[1,2],'0625':[1,2]}
function isSingleChoice(value={}){
 if(value.answerFormat)return value.answerFormat==='single-choice'&&(!value.choiceLabels||Array.isArray(value.choiceLabels)&&value.choiceLabels.join('')==='ABCD')
 return Boolean(CHOICE_COMPONENTS[String(value.subjectCode||value.subject)]?.includes(Number(value.component||value.paperComponent)))
}
function hasChoice(answer){return answer?.inputMode==='choice'&&CHOICES.includes(answer.choice)}
function nextChoiceAnswer(previous={},choice){
 if(!CHOICES.includes(choice))throw Error('请选择 A、B、C 或 D。')
 if(hasChoice(previous)&&previous.choice===choice)return previous
 const oldAssessment=previous.assessment||previous.studentAssessment
 return {...previous,...(oldAssessment?{previousAssessments:[...(previous.previousAssessments||[]),{revision:previous.revision,assessment:previous.assessment,studentAssessment:previous.studentAssessment}]}:{}),inputMode:'choice',choice,revision:(Number(previous.revision)||0)+1,objectiveResult:null,assessment:null,studentAssessment:null,selfDraft:null,at:Date.now()}
}
module.exports={CHOICES,isSingleChoice,hasChoice,nextChoiceAnswer}
