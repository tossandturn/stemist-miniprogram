import fs from 'node:fs'
import assert from 'node:assert/strict'
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8')
function rule(css,selector){const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),match=css.match(new RegExp(escaped+'\\s*\\{([^}]+)\\}'));assert.ok(match,`Missing rule: ${selector}`);return match[1]}
const hub=read('bundles/coach/index.wxss'),panel=read('components/coach-panel/index.wxss'),marking=read('bundles/marking/index.wxss')
for(const [css,selector] of [[hub,'.coach-hub-page button.mode-card'],[panel,'.coach-panel .coach-help-actions button']]){
 const style=rule(css,selector)
 for(const pattern of [/box-sizing:\s*border-box/,/(?:^|;)\s*width:\s*100%/,/min-width:\s*0/,/max-width:\s*100%/])assert.match(style,pattern)
}
assert.match(rule(panel,'.coach-panel textarea'),/box-sizing:\s*border-box/)
assert.match(rule(panel,'.coach-panel .coach-help-actions button'),/min-height:\s*44px/)
assert.doesNotMatch(panel,/\d+rpx/,'shared Coach typography and controls must not scale up with iPad rpx')
assert.match(read('bundles/coach/index.wxml'),/compact="{{true}}"/)
assert.match(read('pages/coach/index.wxml'),/streamlined="{{true}}"/)
assert.match(read('pages/coach/index.wxml'),/submit-label="发送"/)
assert.match(rule(hub,'.mode-title'),/font-size:\s*16px/)
assert.match(marking,/\.marking-page button\.history-item\s*\{[^}]*width:\s*100%/)
assert.match(marking,/\.marking-page button\.optional-toggle\s*\{[^}]*font-size:\s*13px/)
for(const id of ['steps','answers','pdf','tavern','admissions']){
 const svg=read(`bundles/coach/mode-icons/${id}.svg`)
 assert.match(svg,/viewBox="0 0 48 48"/)
 assert.match(svg,/stroke-linecap="round"/)
 assert.doesNotMatch(svg,/<script|<text|href=|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i)
 assert.ok(Buffer.byteLength(svg)<2500,'keep original vector artwork light')
}
const template=read('components/coach-panel/index.wxml')
for(const handler of ['onIntent','onSubmit','onRetry','onAccount','onInput'])assert.ok(template.includes(handler))
assert.match(template,/solutionDisabled/)
const paper=read('bundles/marking/index.wxml')
for(const id of ['marking-primary-action','marking-submit-primary','marking-optional-toggle','marking-history'])assert.ok(paper.includes(`id="${id}"`))
assert.match(paper,/请选择作答 PDF 或图片/)
assert.match(paper,/不计入正式成绩/)
console.log('Coach artwork, native button containment, fixed typography and recovery affordances passed.')
