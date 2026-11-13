const { responseFor } = require('../navigation')

module.exports = async function openLearningDestination(input = {}) {
  return responseFor(input)
}
