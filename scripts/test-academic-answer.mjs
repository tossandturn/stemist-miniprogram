import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const runtime=miniRuntime(),{answerContent}=runtime.load('utils/nativeAnswer')
// The legacy entry must stay byte-for-byte equivalent for IELTS and Tavern.
const legacy=JSON.stringify(answerContent('## Feedback\n\nKeep source_id and $5.'))
assert.ok(fs.existsSync(new URL('../utils/academicAnswer.js',import.meta.url)),'STEM needs a delimiter-preserving academic answer renderer')
const {academicAnswer}=runtime.load('utils/academicAnswer')
const walk=(nodes,fn)=>{for(const node of nodes||[]){fn(node);walk(node.children,fn)}}
const visible=value=>{let text='';for(const section of value.sections)for(const block of section.blocks)walk(block.nodes,n=>{if(n.type==='text')text+=n.text});return text}
const allBlocks=value=>value.sections.flatMap(section=>section.blocks)
const text=String.raw`**解题步骤**

1. 两边减 3：
\[2x=11-3\]
\[2x=8\]
2. 两边除以 2：
\[x=\frac{8}{2}\]

**最终答案：**
\[\boxed{x=4}\]

**检验**
代回 \(x=4\)，\(2(4)+3=11\)。`
const answer=academicAnswer(text)
assert.equal(answer.sections.length,3)
assert.equal(answer.sections[1].kind,'result')
assert.equal(answer.sections[2].kind,'check')
assert.equal(answer.sections[0].title,'解题步骤')
assert.equal(allBlocks(answer).filter(b=>b.kind==='step').length,2)
assert.equal(allBlocks(answer)[1].kind,'formula')
assert.equal(allBlocks(answer)[1].rows,2,'adjacent display equations share one readable block')
assert.doesNotMatch(visible(answer),/\\[()[\]]|\*\*|\\frac/)
assert.match(JSON.stringify(answer),/border-bottom:1px/)

const mixed=academicAnswer(String.raw`**结论：** 路程为 \(50\,\mathrm{m}\)。

## 解题步骤
- 时间 \(0\sim 7\,\text{s}\)，保留 source_id、well-being 和 US$5。
\[s=\frac12\times2\times10+3\times10=40\]
\[\theta=90^\circ,\quad \sigma_x=\frac\pi2\]

## 检验
\[\begin{aligned}a&=b+c\\d&=e\end{aligned}\]`)
assert.match(visible(mixed),/∼/)
assert.match(visible(mixed),/ × 2/,'operator spacing also works when the next TeX token is a digit')
assert.match(visible(mixed),/source_id/)
assert.match(visible(mixed),/US\$5/)
assert.doesNotMatch(visible(mixed),/\\(?:sim|circ|sigma|pi|begin|end|quad)/)
assert.match(JSON.stringify(mixed),/"name":"table"/)
assert.match(JSON.stringify(mixed),/vertical-align:super/)
assert.match(JSON.stringify(mixed),/vertical-align:sub/)

const complex=academicAnswer(String.raw`\[A=\begin{pmatrix}1&2\\3&4\end{pmatrix}\]
\[f(x)=\begin{cases}x^2&x\geq0\\-x&x<0\end{cases}\]
\[x=\frac{-b\pm\sqrt{b^2-4ac}}{2a},\quad \int_0^1 x^2\,dx=\frac13\]`)
let rows=0,cells=0;for(const block of allBlocks(complex))walk(block.nodes,n=>{if(n.name==='tr')rows++;if(n.name==='td')cells++})
assert.ok(rows>=4);assert.ok(cells>=8)
assert.doesNotMatch(visible(complex),/\\(?:begin|end|sqrt|frac)/)
assert.match(visible(complex),/±/)

const inline=academicAnswer(String.raw`普通 a_b 保留；\(x_i\) 正确下标；$x_j$ 也是；$5 和 $10 是价格。`)
assert.match(visible(inline),/a_b/);assert.match(visible(inline),/\$5 和 \$10/)
assert.equal((JSON.stringify(inline).match(/vertical-align:sub/g)||[]).length,2)
assert.match(visible(academicAnswer(String.raw`\(\text{well-being and source_id}\)`)),/well-being and source_id/,'text inside math is not an equation or identifier')
assert.match(visible(academicAnswer(String.raw`费用 \$5，变量 \(x\)。`)),/\$5/)
const table=academicAnswer('| 物理量 | 数值 |\n| --- | --- |\n| 速度 | $10\\,\\mathrm{m/s}$ |')
assert.equal(allBlocks(table)[0].kind,'table');assert.doesNotMatch(visible(table),/---|\$/)
assert.doesNotThrow(()=>academicAnswer('| a | b |\n| --- | --- |\n| | |'))
const unsafe=academicAnswer('[答案](https://example.com/?access_token=fixtureSecret123)\n\n<img onerror="alert(1)">')
assert.equal(unsafe.links.length,0);assert.doesNotMatch(JSON.stringify(unsafe),/fixtureSecret123/)
for(const block of allBlocks(unsafe))walk(block.nodes,n=>assert.ok(!['script','img','iframe','a'].includes(n.name)))
const source='## (a)\n\n**最终答案**\n$x=4$\n\n## (b)\n\n**最终答案**\n$y=5$'
assert.equal(academicAnswer(source).sections.map(s=>s.title).join('|'),'(a)|最终答案|(b)|最终答案','do not reorder results across subquestions')
const start=Date.now(),huge=academicAnswer(('\\[x_1^2=\\frac{1}{2}\\]\n').repeat(15000))
assert.ok(Date.now()-start<2000);assert.ok(JSON.stringify(huge).length<250000);assert.ok(huge.truncated)
const malformed=academicAnswer('未完成公式 \\[x=\\frac{1}{2}')
assert.match(visible(malformed),/未完成公式/)
assert.equal(JSON.stringify(answerContent('## Feedback\n\nKeep source_id and $5.')),legacy)
const componentRuntime=runtime.load('components/answer-content/index')
assert.equal(componentRuntime.properties.academic.value,false)
const view={data:{text,academic:true,compact:false},setData(patch){Object.assign(this.data,patch)}}
componentRuntime.methods.updateContent.call(view)
assert.equal(view.data.sections.length,3)
view.data.academic=false;componentRuntime.methods.updateContent.call(view)
assert.equal(view.data.sections.length,0,'switching to IELTS clears academic sections')
assert.ok(view.data.nodes.length>0)
const component=fs.readFileSync(new URL('../components/coach-panel/index.wxml',import.meta.url),'utf8')
assert.match(component,/academic="\{\{academic\}\}"/)
const page=fs.readFileSync(new URL('../pages/coach/index.wxml',import.meta.url),'utf8')
assert.match(page,/academic="\{\{contextId === 'stem-photo'\}\}"/,'IELTS context must not opt into academic display')
console.log('Academic answer formatting: modules, delimiters, formulas, matrices, tables, safety and IELTS isolation PASS')
