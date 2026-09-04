import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'components/ai-fab/index.js'), 'utf8')
let componentConfig
let navigated = ''
const wx = {
  navigateTo: ({ url }) => { navigated = url },
  redirectTo: ({ url }) => { navigated = url },
}
vm.runInNewContext(source, { Component: (config) => { componentConfig = config }, wx, encodeURIComponent, String, Error })
const instance = { data: { source: 'competition', routeId: 'bpho-admissions-physics', stage: 'Competition', subjectCode: 'bpho', category: 'competition', family: 'competition' } }
componentConfig.methods.openCoach.call(instance)
assert.match(navigated, /^\/pages\/coach\/index\?/)
assert.match(navigated, /source=competition/)
assert.match(navigated, /routeId=bpho-admissions-physics/)
assert.match(navigated, /category=competition/)
assert.match(navigated, /family=competition/)
assert.doesNotMatch(navigated, /token|access_token|session/i)
console.log('Persistent AI Coach entry contract passed.')
