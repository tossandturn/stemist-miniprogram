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
const instance = { data: { source: 'reading', routeId: 'cie-9702-as-physics', stage: 'AS', subjectCode: '9702' } }
componentConfig.methods.openCoach.call(instance)
assert.match(navigated, /^\/pages\/coach\/index\?/)
assert.match(navigated, /source=reading/)
assert.match(navigated, /routeId=cie-9702-as-physics/)
assert.doesNotMatch(navigated, /token|access_token|session/i)
console.log('Persistent AI Coach entry contract passed.')
