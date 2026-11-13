const DIAGRAM_INTENTS=Object.freeze({ASK:'ask',DRAW:'draw',DECLINE:'decline'}),VALID_INTENTS=new Set(Object.values(DIAGRAM_INTENTS))

function normalizeDiagramIntent(value,fallback=DIAGRAM_INTENTS.ASK){
 const intent=String(value||fallback||'').trim().toLowerCase()
 if(!VALID_INTENTS.has(intent))throw Object.assign(new Error('绘图意图无效，请重新选择。'),{code:'diagram_intent_invalid'})
 return intent
}

function normalizeDiagramOffer(value,completed){
 if(completed!==true||!value||value.type!=='force')return null
 const question=String(value.question||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,160)
 return question?{type:'force',question}:null
}

function diagramRequestKey({message='',helpIntent='',feature='',context={},imagePaths=[]}={}){
 const scope=context&&typeof context==='object'?context:{}
 return JSON.stringify({message:String(message||'').trim(),helpIntent:String(helpIntent||''),feature:String(feature||''),routeId:String(scope.routeId||''),subjectCode:String(scope.subjectCode||''),stage:String(scope.stage||''),attemptId:String(scope.attemptId||scope.paperAttemptId||''),questionId:String(scope.questionId||''),partId:String(scope.partId||''),images:(Array.isArray(imagePaths)?imagePaths:[]).map(String).filter(Boolean).slice(0,4)})
}

module.exports={DIAGRAM_INTENTS,normalizeDiagramIntent,normalizeDiagramOffer,diagramRequestKey}
