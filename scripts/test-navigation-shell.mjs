import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'
const root=path.resolve(import.meta.dirname,'..')
const runtime=miniRuntime({modules:{'utils/wechatAuth':{ensureWeChatSession:async()=>({})}}})
const home=runtime.page('pages/index/index')
const expected=['alevel','ielts','competition','calculator']
assert.equal(JSON.stringify(home.data.entryPoints.map(e=>e.id)),JSON.stringify(expected))
for(const entry of home.data.entryPoints) {
  home.openEntry({currentTarget:{dataset:{entry:entry.id}}})
  assert.equal(runtime.calls.at(-1).url,entry.url)
  assert.ok(fs.existsSync(path.join(root,entry.url.split('?')[0]+'.js')))
}
const template=fs.readFileSync(path.join(root,'components/app-nav/index.wxml'),'utf8')
assert.doesNotMatch(template,/<block wx:if/,'active item must still allow returning from child pages')
assert.match(template,/pages\/papers\/index\?category=competition/)
console.log('Four home entry clicks and child-to-workspace navigation passed.')
