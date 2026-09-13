const SUBJECTS={ielts:'IELTS Core',physics:'Physics · 物理',mathematics:'Mathematics · 数学',chemistry:'Chemistry · 化学',biology:'Biology · 生物',economics:'Economics · 经济','computer-science':'Computer Science · 计算机',business:'Business · 商务',geography:'Geography · 地理',accounting:'Accounting · 会计',psychology:'Psychology · 心理',law:'Law · 法律',sociology:'Sociology · 社会学',politics:'Politics · 政治',history:'History · 历史','exam-language':'Exam Language · 考试用语'}
const subjectLabel=id=>SUBJECTS[id]||String(id||'').split('-').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' ')
const identifier=value=>String(value||'').normalize('NFKC').trim().toLowerCase()
function inPack(item,pack){return pack==='ielts'?item.bank==='ielts':pack==='igcse'?item.bank==='stem'&&item.stage==='IGCSE':pack==='alevel'?item.bank==='stem'&&['AS','A2'].includes(item.stage):false}
function packCards(index){return ['ielts','igcse','alevel','competition','admissions'].map(id=>({id,label:{ielts:'IELTS Core',igcse:'IGCSE 学科词汇',alevel:'A-Level 学科词汇',competition:'竞赛词汇',admissions:'入学考试词汇'}[id],count:index.filter(x=>inPack(x,id)).length,pending:['competition','admissions'].includes(id)}))}
function subjectCards(index,pack){const counts=new Map();for(const item of index.filter(x=>inPack(x,pack)))counts.set(item.subject,(counts.get(item.subject)||0)+1);return [...counts].map(([id,count])=>({id,label:subjectLabel(id),count})).sort((a,b)=>a.label.localeCompare(b.label))}
function isDue(progress,id,saved,now){const entry=progress[id];return entry?Number(entry.due||0)<=now:saved.has(id)}
function wordView(item){return {...item,phonetic:item.phonetic||'',definition:item.definition||'',explanation:item.conceptExplanation||item.cn||item.knowledgePoint||'',example:item.example||'',translation:item.translation||'',formula:item.formula||'',formulaExplanation:item.formulaExplanation||'',methodSteps:Array.isArray(item.methodSteps)?item.methodSteps:[],collocations:Array.isArray(item.collocations)?item.collocations:[],mistake:item.commonMistake||(item.commonMistakes||[]).join('\n'),examFocus:item.examFocus||item.examUsage?.focus||'',workedExample:item.workedExample&&typeof item.workedExample==='object'?{...item.workedExample,steps:Array.isArray(item.workedExample.steps)?item.workedExample.steps:[]}:null,subjectLabel:subjectLabel(item.subject),typeLabel:{term:'单词 / 术语',command:'指令词',phrase:'题目句'}[item.type]||'单词 / 术语'}}
function notebookPayload(item){
 // Existing web marker; retain identity and stay within the server's 3,000-char
 // field limit without truncating JSON. Full source fields remain saved locally.
 const structured={id:item.id,termId:item.termId||item.id,term:item.word,word:item.word,subject:item.subject,stage:item.stage||'',topic:item.topic||'',topicLabel:item.topicLabel||'',type:item.type||'term',meaning:item.meaning||'',definition:String(item.definition||'').slice(0,700),conceptExplanation:String(item.conceptExplanation||item.cn||'').slice(0,700),example:String(item.example||'').slice(0,400),translation:String(item.translation||'').slice(0,400)}
 const encode=()=> '__IELTS_VOCAB_IMPORT__'+JSON.stringify(structured)
 for(const field of ['conceptExplanation','translation','example','definition'])if(encode().length>3000)delete structured[field]
 if(encode().length>3000)throw Error('词条内容过长，本机收藏已保留。')
 return {term:item.word,context:item.example||'',explanation:encode(),source:'Vocabulary:'+item.subject}
}
function savedIds(rows,index){const result=new Set();for(const row of Array.isArray(rows)?rows:[]){let source;const marker='__IELTS_VOCAB_IMPORT__';try{if(String(row.explanation||'').startsWith(marker))source=JSON.parse(row.explanation.slice(marker.length))}catch{}
 const subject=source?.subject||String(row.source||'').replace(/^Vocabulary:/,''),term=identifier(source?.term||row.term)
 const found=index.find(x=>(source?.id===x.id||source?.termId===x.id)||x.subject===subject&&identifier(x.word)===term);if(found)result.add(found.id)
 }return result}
module.exports={subjectLabel,identifier,inPack,packCards,subjectCards,isDue,wordView,notebookPayload,savedIds}
