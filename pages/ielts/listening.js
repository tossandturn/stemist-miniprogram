const { makeTextSkillPage } = require('../../utils/skillPage')

Page(makeTextSkillPage({
  skill: 'listening',
  eyebrow: 'IELTSIST · LISTENING WITH AI',
  title: '听力',
  subtitle: '',
  contextTitle: '听力记录',
  contextText: '',
  placeholder: '填写题号、答案和没听清的地方…',
  emptyError: '请先输入答案或复盘内容',
  prompt: (text) => `请根据我的 IELTS Listening 文本答案给出纠错和下一步练习建议。\n\n学生记录：\n${text}`,
}))
