import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const {answerContent}=miniRuntime().load('utils/nativeAnswer')
const result=answerContent('## Evidence\n\n**Check** this [Reading](https://ieltsist.com/?module=reading#single) and [reference](https://example.com/paper).\n\n<script>not executable</script>')
assert.equal(result.links[0].target,'/pages/ielts/library?module=reading')
assert.equal(result.links[1].target,'');assert.match(result.links[1].label,/复制链接/)
assert.ok(result.nodes.every(node=>['p','h3'].includes(node.name)))
assert.equal(answerContent('[bad](javascript:alert(1))').links.length,0)
assert.equal(answerContent('https://user:password@example.com https://example.com/?token=private').links.length,0)
assert.ok(answerContent(Array.from({length:20},(_,i)=>'https://example.com/'+i).join(' ')).links.length<=8)
const math=JSON.stringify(answerContent('Correct: \\(2x + 3 = 7\\).\n\n\\[x = 2\\]'))
assert.match(math,/2x \+ 3 = 7/);assert.match(math,/x = 2/);assert.doesNotMatch(math,/\\\\[()[\]]/,'native feedback must not display raw math delimiters')
console.log('Native answer rendering: safe text nodes, native study links, explicit external-copy actions and bounded link parsing passed.')
