const TAVERN_FORTUNE_PRESETS=Object.freeze([
 Object.freeze({id:'eastern-oracle',name:'东方玄学',tag:'东方卦签',detail:'随机起一卦，换个角度看当下。',greeting:'这里的卦签只作休闲启发，不替你决定人生。想带着一个轻问题抽一卦，还是直接看看今天的随机提示？',starters:Object.freeze(['为我随机抽一卦','用卦签换个角度想想','解释我刚抽到的卦']),divinationKind:'hexagram',supportedSpreads:Object.freeze(['single'])}),
 Object.freeze({id:'tarot-reader',name:'西方塔罗',tag:'塔罗娱乐',detail:'抽一张牌，把问题换个角度摆上桌。',greeting:'牌面只是休闲联想的镜子，不是预言。你想抽单张提示，还是三张看看过去主题、当下主题和可能的方向？',starters:Object.freeze(['抽一张当下提示','抽三张主题牌','解读我刚抽到的牌']),divinationKind:'tarot',supportedSpreads:Object.freeze(['single','three'])}),
])
module.exports={TAVERN_FORTUNE_PRESETS}
