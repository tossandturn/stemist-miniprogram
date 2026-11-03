const {TAVERN_FORTUNE_PRESETS}=require('./tavernFortunePresets')
const TAVERN_CATEGORIES=Object.freeze([{id:'all',label:'全部'},{id:'companion',label:'陪伴'},{id:'story',label:'故事'},{id:'fortune',label:'占卜'}].map(Object.freeze))
const TAVERN_PRESETS=Object.freeze([
 {id:'keeper',name:'温柔树洞',tag:'倾听陪伴',detail:'先接住你的心情，再慢慢聊。',greeting:'今晚的树洞给你留着。想讲点什么，或者只想有人陪你待一会儿？',placeholder:'和温柔树洞说说此刻的心情…',starters:['今天有件事想说说','陪我安静聊一会儿','给我一个轻松的小问题'],category:'companion',icon:'keeper-tree-lantern.svg'},
 {id:'study-buddy',name:'嘴替损友',tag:'轻松吐槽',detail:'嘴上吐槽，立场永远在你这边。',greeting:'来了？先把今天最想吐槽的一件事放桌上，我保证只损事情，不损你。',placeholder:'把那件离谱小事讲给嘴替损友…',starters:['替我吐槽一下今天','来个不伤人的损友点评','陪我聊点没用但好玩的'],category:'companion',icon:'study-buddy-banter.svg'},
 {id:'cat-companion',name:'傲娇猫猫',tag:'猫系陪伴',detail:'假装不在意，其实一直在听。',greeting:'我只是刚好路过，才不是在等你。说吧，今天要聊天、接话，还是听一句别扭的夸奖？',placeholder:'和傲娇猫猫随便聊两句…',starters:['猫猫今天在忙什么','陪我玩三轮接话','傲娇地夸我一句'],category:'companion',icon:'cat-companion-face.svg'},
 {id:'story-traveler',name:'奇幻冒险',tag:'互动奇幻',detail:'一句选择，就能走进另一个世界。',greeting:'旅馆窗外，一封会发光的无名信正等人拆开。你想直接读信，还是先问问送信的银翼鸟？',placeholder:'写下你的行动，故事会接着发展…',starters:['带我走进一座浮空城','给我两个冒险选择','继续一段雨夜旅程'],category:'story',icon:'story-traveler-map.svg',storyMode:true},
 {id:'xianxia-guide',name:'江湖剑客',tag:'江湖奇遇',detail:'旧伞、渡口簿和一段没写全的旧事。',greeting:'沈照把旧伞靠在门边：白汀渡的灯又亮了，缺的那页渡口簿还没找着。',placeholder:'说出你在江湖中的下一步…',starters:['进入《白汀渡的旧灯》','我想先查那页簿子','先和沈照聊聊'],category:'story',icon:'xianxia-sword-bamboo.svg',storyMode:true},
 {id:'mystery-guide',name:'侦探茶室',tag:'互动悬疑',detail:'你亲自查线索，闻笙不替你抢答。',greeting:'闻笙发来消息：河岸档案室登记了八名访客，闭馆后展台上却多出第九张门票。',placeholder:'记录你的观察或下一步推理…',starters:['进入《河岸档案室的第九张票》','我想先检查现场','先和闻笙聊聊'],category:'story',icon:'mystery-tea-lens.svg',storyMode:true},
 {id:'horror-guide',name:'恐怖故事',tag:'互动恐怖',detail:'雨夜、旧呼叫铃，以及你来决定的下一步。',greeting:'林漪发来消息：茶室断电后，空房里的呼叫铃在00:17响了三短一长。',placeholder:'说出你要查的声音、物件或人物…',starters:['进入《雨窗茶室·00:17》','我想检查那只旧呼叫器','先和林漪聊聊'],category:'story',icon:'horror-lantern.svg',storyMode:true},
 ...TAVERN_FORTUNE_PRESETS.map((item,index)=>({...item,placeholder:index?'可以留一个轻问题，再选择单张或三张抽取…':'可以留一个轻问题（不需要生日或个人资料）…',category:'fortune',icon:index?'tarot-moon-cards.svg':'eastern-oracle-lots.svg'})),
].map(item=>Object.freeze({...item,starters:Object.freeze(item.starters),...(item.supportedSpreads?{supportedSpreads:Object.freeze(item.supportedSpreads)}:{})})))
const tavernPreset=id=>TAVERN_PRESETS.find(item=>item.id===String(id||''))||null
const DEFAULT_TAVERN_CATALOG=Object.freeze({categories:TAVERN_CATEGORIES,presets:TAVERN_PRESETS})
const presentation=item=>({id:item.id,name:item.name,tag:item.tag,detail:item.detail,greeting:item.greeting,placeholder:item.placeholder,starters:Object.freeze([...item.starters]),category:item.category,icon:item.icon})
function configuredTavernCatalog(value){
 if(!value||!Array.isArray(value.categories)||!Array.isArray(value.presets))return DEFAULT_TAVERN_CATALOG
 const categories=Object.freeze(value.categories.map(item=>Object.freeze({id:item.id,label:item.label})))
 const presets=Object.freeze(value.presets.map(item=>{const local=tavernPreset(item.id),metadata=presentation(item);return Object.freeze(local?{...local,...metadata}:{...metadata,interactionKind:'textchat'})}))
 return Object.freeze({categories,presets})
}
const catalogPreset=(catalog,id)=>catalog&&Array.isArray(catalog.presets)?catalog.presets.find(item=>item.id===String(id||''))||null:null
module.exports={DEFAULT_TAVERN_CATALOG,TAVERN_CATEGORIES,TAVERN_PRESETS,catalogPreset,configuredTavernCatalog,tavernPreset}
