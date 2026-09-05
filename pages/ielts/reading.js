const { makeTextSkillPage } = require('../../utils/skillPage')

Page(makeTextSkillPage({
  skill: 'reading',
  eyebrow: 'IELTSIST · READING WITH AI',
  title: '阅读',
  subtitle: '',
  contextTitle: '阅读记录',
  contextText: '',
  placeholder: '填写题号、答案和不确定的地方…',
  emptyError: '请先输入答案或证据',
  prompt: (text) => `请根据我的 IELTS Reading 文本答案检查证据链和错误，并给出下一步练习建议。\n\n学生记录：\n${text}`,
}))
