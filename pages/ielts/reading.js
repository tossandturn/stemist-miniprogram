const { makeTextSkillPage } = require('../../utils/skillPage')

Page(makeTextSkillPage({
  skill: 'reading',
  eyebrow: 'IELTSIST · READING WITH AI',
  title: 'Reading with AI',
  subtitle: '写清定位和依据，再检查答案',
  contextTitle: '阅读记录',
  contextText: '记录题号、答案、原文定位和你的理由，再让 Coach 检查证据链。题型只是反馈元数据，Topic 仍按文章语义主题管理。',
  placeholder: '例如：Q27 False；证据在 paragraph 4 line 3；我把 “only” 忽略了…',
  emptyError: '请先输入答案或证据',
  prompt: (text) => `请根据我的 IELTS Reading 文本答案检查证据链和错误，并给出下一步练习建议。\n\n学生记录：\n${text}`,
}))
