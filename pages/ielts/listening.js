const { makeTextSkillPage } = require('../../utils/skillPage')

Page(makeTextSkillPage({
  skill: 'listening',
  eyebrow: 'IELTSIST · LISTENING WITH AI',
  title: 'Listening with AI',
  subtitle: '记录答案，找出听力陷阱，再练一题',
  contextTitle: '听力记录',
  contextText: '听完 Cambridge 音频后，在这里记录题号、答案、听不清的片段和关键词。小程序保留文本工作区；音频与完整题库仍以 IELTSist 为准。',
  placeholder: '例如：Q12 C；不确定单复数；Section 3 speaker changed topic…',
  emptyError: '请先输入答案或复盘内容',
  prompt: (text) => `请根据我的 IELTS Listening 文本答案给出纠错和下一步练习建议。\n\n学生记录：\n${text}`,
}))
