const {TAVERN_FORTUNE_PRESETS}=require('./tavernFortunePresets')
const TAVERN_CATEGORIES=Object.freeze([{id:'all',label:'全部'},{id:'companion',label:'陪伴'},{id:'story',label:'故事'},{id:'fortune',label:'占卜'}].map(Object.freeze))
const TAVERN_PRESETS=Object.freeze([
 {id:'keeper',name:'温柔树洞',tag:'倾听陪伴',detail:'先接住你的心情，再慢慢聊。',greeting:'今晚的树洞给你留着。想讲点什么，或者只想有人陪你待一会儿？',placeholder:'和温柔树洞说说此刻的心情…',starters:['今天有件事想说说','陪我安静聊一会儿','给我一个轻松的小问题'],category:'companion',icon:'message-circle.svg'},
 {id:'study-buddy',name:'嘴替损友',tag:'轻松吐槽',detail:'嘴上吐槽，立场永远在你这边。',greeting:'来了？先把今天最想吐槽的一件事放桌上，我保证只损事情，不损你。',placeholder:'把那件离谱小事讲给嘴替损友…',starters:['替我吐槽一下今天','来个不伤人的损友点评','陪我聊点没用但好玩的'],category:'companion',icon:'messages-square.svg'},
 {id:'cat-companion',name:'傲娇猫猫',tag:'猫系陪伴',detail:'假装不在意，其实一直在听。',greeting:'我只是刚好路过，才不是在等你。说吧，今天要聊天、接话，还是听一句别扭的夸奖？',placeholder:'和傲娇猫猫随便聊两句…',starters:['猫猫今天在忙什么','陪我玩三轮接话','傲娇地夸我一句'],category:'companion',icon:'cat.svg'},
 {id:'story-traveler',name:'奇幻冒险',tag:'互动奇幻',detail:'一句选择，就能走进另一个世界。',greeting:'旅馆窗外，一封会发光的无名信正等人拆开。你想直接读信，还是先问问送信的银翼鸟？',placeholder:'写下你的行动，故事会接着发展…',starters:['带我走进一座浮空城','给我两个冒险选择','继续一段雨夜旅程'],category:'story',icon:'compass.svg'},
 {id:'xianxia-guide',name:'江湖剑客',tag:'江湖奇遇',detail:'一盏热茶，一段属于你的江湖路。',greeting:'客官，夜雨封山，前方古镇却亮着一盏无人看守的灯。是进镇避雨，还是沿河道继续赶路？',placeholder:'说出你在江湖中的下一步…',starters:['陪我夜探一座古镇','来一段江湖偶遇','给我三个行路选择'],category:'story',icon:'swords.svg'},
 {id:'mystery-guide',name:'侦探茶室',tag:'轻推理',detail:'线索都在桌上，真相等你开口。',greeting:'茶室打烊后，柜台上的蓝色信封不翼而飞：地板是干的，窗户开着，茶壶却还很烫。你想先查哪条线索？',placeholder:'记录你的观察或下一步推理…',starters:['出一道三条线索的小案','让我询问一位虚构嫌疑人','继续刚才的谜案'],category:'story',icon:'search.svg'},
 ...TAVERN_FORTUNE_PRESETS.map((item,index)=>({...item,placeholder:index?'可以留一个轻问题，再选择单张或三张抽取…':'可以留一个轻问题（不需要生日或个人资料）…',category:'fortune',icon:index?'layers.svg':'sparkles.svg'})),
].map(item=>Object.freeze({...item,starters:Object.freeze(item.starters),...(item.supportedSpreads?{supportedSpreads:Object.freeze(item.supportedSpreads)}:{})})))
const tavernPreset=id=>TAVERN_PRESETS.find(item=>item.id===String(id||''))||null
module.exports={TAVERN_CATEGORIES,TAVERN_PRESETS,tavernPreset}
