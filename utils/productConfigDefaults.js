function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const item of Object.values(value)) deepFreeze(item)
  return Object.freeze(value)
}

// Mechanically mirrored from the committed native presentation metadata by
// backend-driven-foundation-20261011T012618/defaults.json. Keep this fallback
// dependency-free and inside the Mini Program package.
const DEFAULT_PRODUCT_CONFIG = deepFreeze({
  schemaVersion: 'stemist-product-config-v1',
  revision: 'foundation-v1',
  publishedAt: '2026-10-11T01:32:03.802+08:00',
  minCapabilityVersion: 1,
  home: {
    heading: '今天想学什么？',
    entries: [
      { id: 'alevel', title: 'A-Level 学科', detail: 'IGCSE · AS · A2', tone: 'alevel' },
      { id: 'ap', title: 'AP', detail: '历年真题', tone: 'ap' },
      { id: 'ib', title: 'IB', detail: '历年真题', tone: 'ib' },
      { id: 'ielts', title: 'IELTS', detail: '听说读写 · 模考 · 词汇', tone: 'ielts' },
      { id: 'competition', title: '竞赛 / 入学考试', detail: 'BPhO · AMC · ESAT · TMUA 真题', tone: 'competition' },
      { id: 'calculator', title: 'Casio 计算器', detail: '科学计算 · 历史记录', tone: 'calculator' },
    ],
    secondary: [
      { id: 'university-directory', label: '大学排名与官网', action: { kind: 'page', target: 'university-directory' } },
    ],
  },
  coach: {
    modes: [
      { id: 'steps', title: '步骤提示', detail: '理清思路，提示下一步。' },
      { id: 'answers', title: '答案询问', detail: '拍下题目，获取完整解答。' },
      { id: 'pdf', title: 'PDF 阅卷', detail: '上传 PDF 或图片，生成批改报告。' },
      { id: 'tavern', title: 'AI 休闲酒馆', detail: '选个角色，聊聊学习以外的事。' },
    ],
  },
  tavern: {
    categories: [
      { id: 'all', label: '全部' },
      { id: 'companion', label: '陪伴' },
      { id: 'story', label: '故事' },
      { id: 'fortune', label: '占卜' },
    ],
    presets: [
      {
        id: 'keeper', name: '温柔树洞', tag: '倾听陪伴', detail: '先接住你的心情，再慢慢聊。',
        greeting: '今晚的树洞给你留着。想讲点什么，或者只想有人陪你待一会儿？', placeholder: '和温柔树洞说说此刻的心情…',
        starters: ['今天有件事想说说', '陪我安静聊一会儿', '给我一个轻松的小问题'], category: 'companion', icon: 'keeper-tree-lantern.svg',
      },
      {
        id: 'study-buddy', name: '嘴替损友', tag: '轻松吐槽', detail: '嘴上吐槽，立场永远在你这边。',
        greeting: '来了？先把今天最想吐槽的一件事放桌上，我保证只损事情，不损你。', placeholder: '把那件离谱小事讲给嘴替损友…',
        starters: ['替我吐槽一下今天', '来个不伤人的损友点评', '陪我聊点没用但好玩的'], category: 'companion', icon: 'study-buddy-banter.svg',
      },
      {
        id: 'cat-companion', name: '傲娇猫猫', tag: '猫系陪伴', detail: '假装不在意，其实一直在听。',
        greeting: '我只是刚好路过，才不是在等你。说吧，今天要聊天、接话，还是听一句别扭的夸奖？', placeholder: '和傲娇猫猫随便聊两句…',
        starters: ['猫猫今天在忙什么', '陪我玩三轮接话', '傲娇地夸我一句'], category: 'companion', icon: 'cat-companion-face.svg',
      },
      {
        id: 'story-traveler', name: '奇幻冒险', tag: '互动奇幻', detail: '一句选择，就能走进另一个世界。',
        greeting: '旅馆窗外，一封会发光的无名信正等人拆开。你想直接读信，还是先问问送信的银翼鸟？', placeholder: '写下你的行动，故事会接着发展…',
        starters: ['带我走进一座浮空城', '给我两个冒险选择', '继续一段雨夜旅程'], category: 'story', icon: 'story-traveler-map.svg',
      },
      {
        id: 'xianxia-guide', name: '江湖剑客', tag: '江湖奇遇', detail: '一盏热茶，一段属于你的江湖路。',
        greeting: '客官，夜雨封山，前方古镇却亮着一盏无人看守的灯。是进镇避雨，还是沿河道继续赶路？', placeholder: '说出你在江湖中的下一步…',
        starters: ['陪我夜探一座古镇', '来一段江湖偶遇', '给我三个行路选择'], category: 'story', icon: 'xianxia-sword-bamboo.svg',
      },
      {
        id: 'mystery-guide', name: '侦探茶室', tag: '轻推理', detail: '线索都在桌上，真相等你开口。',
        greeting: '茶室打烊后，柜台上的蓝色信封不翼而飞：地板是干的，窗户开着，茶壶却还很烫。你想先查哪条线索？', placeholder: '记录你的观察或下一步推理…',
        starters: ['出一道三条线索的小案', '让我询问一位虚构嫌疑人', '继续刚才的谜案'], category: 'story', icon: 'mystery-tea-lens.svg',
      },
      {
        id: 'eastern-oracle', name: '东方玄学', tag: '东方卦签', detail: '随机起一卦，换个角度看当下。',
        greeting: '这里的卦签只作休闲启发，不替你决定人生。想带着一个轻问题抽一卦，还是直接看看今天的随机提示？', placeholder: '可以留一个轻问题（不需要生日或个人资料）…',
        starters: ['为我随机抽一卦', '用卦签换个角度想想', '解释我刚抽到的卦'], category: 'fortune', icon: 'eastern-oracle-lots.svg',
      },
      {
        id: 'tarot-reader', name: '西方塔罗', tag: '塔罗娱乐', detail: '抽一张牌，把问题换个角度摆上桌。',
        greeting: '牌面只是休闲联想的镜子，不是预言。你想抽单张提示，还是三张看看过去主题、当下主题和可能的方向？', placeholder: '可以留一个轻问题，再选择单张或三张抽取…',
        starters: ['抽一张当下提示', '抽三张主题牌', '解读我刚抽到的牌'], category: 'fortune', icon: 'tarot-moon-cards.svg',
      },
    ],
  },
  pages: [],
})

module.exports = { DEFAULT_PRODUCT_CONFIG }
