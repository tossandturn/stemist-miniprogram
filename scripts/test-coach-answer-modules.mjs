import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const runtime=miniRuntime(),api=runtime.load('utils/academicAnswer')
assert.equal(typeof api.modularAnswer,'function','worked responses need an answer/steps module adapter')
const visible=nodes=>(nodes||[]).map(n=>n.type==='text'?n.text:visible(n.children)).join('')
const body=s=>s.blocks.map(b=>visible(b.nodes)).join(' ')
const solution=String.raw`**解题步骤**
1. 两边减去 3。
\[2x=8\]
2. 两边除以 2。
**最终答案**
\[x=4\]
**检验**
\[2(4)+3=11\]`
const result=api.modularAnswer(solution)
assert.deepEqual(Array.from(result.sections,s=>s.title),['答案','解题步骤'])
assert.equal(result.sections[0].kind,'answer')
assert.match(body(result.sections[0]),/x = 4/)
assert.doesNotMatch(body(result.sections[0]),/两边/)
assert.match(body(result.sections[1]),/两边减去 3/)
assert.match(body(result.sections[1]),/检验/)
assert.doesNotMatch(body(result.sections[1]),/x = 4/,'do not duplicate final answer in steps')
const physics=api.modularAnswer('**结论**\n面积等于路程。\n\n**解题步骤**\n计算梯形面积。\n\n**最终答案**\n\\[s=50\\,\\mathrm{m}\\]\n\n**检验**\n单位正确。')
assert.match(body(physics.sections[0]),/50/)
assert.doesNotMatch(body(physics.sections[0]),/面积等于/)
assert.match(body(physics.sections[1]),/面积等于/)
for(const source of ['**Solution**\nSubtract 3, then divide by 2.\n\n**Final answer:** \\(x=4\\)','解题步骤：先减去 3，再除以 2。\n\n答案：\\(x=4\\)']){
 const modules=api.modularAnswer(source)
 assert.equal(modules.sections[0].title,'答案','inline Chinese/English answer labels form the same modules')
 assert.match(body(modules.sections[0]),/x = 4/)
}
const hints='**关键概念**\n等式两边保持平衡。\n\n**下一步动作**\n先减去 3。'
assert.equal(JSON.stringify(api.modularAnswer(hints)),JSON.stringify(api.academicAnswer(hints)),'hint never gets an invented answer module')
const multi=api.modularAnswer('## (a)\n\n**解题步骤**\n先算甲。\n\n**最终答案**\n$x=4$\n\n## (b)\n\n**解题步骤**\n再算乙。\n\n**最终答案**\n$y=5$')
assert.deepEqual(Array.from(multi.sections,s=>s.title),['(a) · 答案','(a) · 解题步骤','(b) · 答案','(b) · 解题步骤'])
assert.match(body(multi.sections[0]),/x = 4/);assert.match(body(multi.sections[2]),/y = 5/)
assert.doesNotMatch(body(multi.sections[1]),/算乙/)
const labelled=api.modularAnswer('## (a) 求 x\n\n**答案**\n$x=4$\n\n## Part (b): Find y\n\n**答案**\n$y=5$')
assert.deepEqual(Array.from(labelled.sections,s=>s.title),['(a) 求 x · 答案','Part (b): Find y · 答案'])
const ambiguous='**最终答案**\n$x=4$\n\n**最终答案**\n$y=5$'
assert.equal(JSON.stringify(api.modularAnswer(ambiguous)),JSON.stringify(api.academicAnswer(ambiguous)),'do not guess question correspondence')
const legacy='图片不清楚，请重新拍摄。'
assert.equal(JSON.stringify(api.modularAnswer(legacy)),JSON.stringify(api.academicAnswer(legacy)))
const component=runtime.load('components/answer-content/index')
assert.equal(component.properties.modular.value,false)
const view={data:{text:solution,academic:true,modular:true,compact:false},setData(patch){Object.assign(this.data,patch)}}
component.methods.updateContent.call(view);assert.equal(view.data.sections[0].title,'答案')
view.data.modular=false;component.methods.updateContent.call(view);assert.equal(view.data.sections[0].title,'解题步骤','plain academic reports retain original ordering')
const wxml=fs.readFileSync(new URL('../components/coach-panel/index.wxml',import.meta.url),'utf8')
assert.match(wxml,/modular="\{\{academic\}\}"/)
console.log('Coach answer modules: answer first, separate steps, verification, hints and question pairing PASS')
