const { responseFor } = require('../navigation')

module.exports = async function discoverLearningOptions(input = {}) {
  return responseFor(input)
}
