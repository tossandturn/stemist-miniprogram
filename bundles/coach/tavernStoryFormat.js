const HEADER=/^\s*【([^】]{1,24})】\s*(.*)$/
const PLAYER_LABEL=/^(?:我|本人|玩家|用户|你|player|user)(?:[：:（(].*)?$/i
const NARRATION_LABEL=/^(?:旁白|场景|环境|动作|线索|已知线索|已知事实|narrator|narration)$/i
const CHOICE_HEADER=/^(?:可选行动|可选选择|choices)$/i
const OPTION=/^\s*(?:(?:[-*•])\s*|(?:\d+|[A-Ca-c])[.)、]\s*)(.{1,100})\s*$/
const MAX_SEGMENTS=16,MAX_CHOICES=3,MAX_MESSAGE_CHARS=6000

function cleanLine(value){return String(value||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim()}

function parseTavernStoryMessage(value){
 const source=typeof value==='string'?value.slice(0,MAX_MESSAGE_CHARS).replace(/\*{0,2}(【[^】]{1,24}】)\*{0,2}/g,'\n$1'):''
 const segments=[],choices=[]
 let label='旁白',kind='narration',lines=[],recognized=false
 const flush=()=>{
  const text=lines.join('\n').trim();lines=[]
  if(!text||!kind||kind==='ignore')return
  if(kind==='choices'){
   for(const line of text.replace(/\s+(?=(?:[1-3]|[A-Ca-c])[.)、]\s*)/g,'\n').split(/\r?\n/)){
    const match=line.match(OPTION),choice=cleanLine(match?.[1])
    if(match&&choice&&!choices.includes(choice))choices.push(choice)
    if(choices.length>=MAX_CHOICES)break
   }
   return
  }
  segments.push({kind,label,text})
 }
 for(const line of source.split(/\r?\n/)){
  const match=line.match(HEADER)
  if(match){
   flush();recognized=true;label=cleanLine(match[1]);lines=[]
   if(PLAYER_LABEL.test(label)){kind='ignore';continue}
   if(CHOICE_HEADER.test(label)){kind='choices';label='';if(match[2])lines.push(cleanLine(match[2]));continue}
   kind=NARRATION_LABEL.test(label)?'narration':'dialogue'
   if(match[2])lines.push(cleanLine(match[2]))
   continue
  }
  if(kind==='ignore')continue
  if(kind)lines.push(line)
 }
 flush()
 if(!recognized)return{segments:[],choices:[]}
 return{segments:segments.slice(0,MAX_SEGMENTS),choices:choices.slice(0,MAX_CHOICES)}
}

module.exports={parseTavernStoryMessage}
