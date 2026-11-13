const discoverLearningOptions = require('./apis/discoverLearningOptions')
const openLearningDestination = require('./apis/openLearningDestination')

const skill = wx.modelContext.createSkill('/skills/learning-navigator')
skill.registerAPI('discoverLearningOptions', discoverLearningOptions)
skill.registerAPI('openLearningDestination', openLearningDestination)
