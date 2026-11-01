import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const r=miniRuntime(),parse=r.load('utils/academicAnswer').modularAnswer
const diagram={version:'stem-diagram-v1',title:'受力图',description:'示意图，箭头表示力的方向。',width:400,height:260,elements:[{type:'rect',x:170,y:100,width:60,height:40,label:'m'},{type:'line',x1:200,y1:100,x2:200,y2:40,arrow:true,label:'N'},{type:'line',x1:200,y1:140,x2:200,y2:220,arrow:true,label:'mg'}]}
const answer='## 答案\na=2 m/s²\n## 解题步骤\n1. 合力满足 F=ma。\n```stem-diagram\n'+JSON.stringify(diagram)+'\n```\n2. 代入并检查单位。'
const content=parse(answer),blocks=content.sections.flatMap(x=>x.blocks)
assert.equal(blocks.filter(x=>x.kind==='diagram').length,1,'a real diagram must appear within the steps instead of raw JSON')
assert.doesNotMatch(JSON.stringify(blocks.filter(x=>x.kind!=='diagram')),/stem-diagram-v1|"x1"/)
const {normalizeDiagram,extractDiagrams,drawDiagram}=r.load('utils/coachDiagram')
assert.ok(normalizeDiagram(diagram))
for(const invalid of [{...diagram,elements:[{type:'html',text:'<script/>'}]},{...diagram,width:Infinity},{...diagram,elements:[{type:'line',x1:-1,y1:1,x2:40,y2:50}]},{...diagram,elements:Array(61).fill(diagram.elements[0])},{...diagram,elements:[{type:'polyline',points:Array(101).fill([1,2])}]},{...diagram,url:'https://arbitrary.invalid/img'}])assert.equal(normalizeDiagram(invalid),null)
const incomplete=extractDiagrams('before\n```stem-diagram\n{"version":');assert.doesNotMatch(incomplete.text,/version/);assert.match(incomplete.text,/整理/)
const bad=extractDiagrams('before\n```stem-diagram\n{"bad":true}\n```\nafter');assert.match(bad.text,/after/);assert.equal(bad.diagrams.length,0)
const calls=[],ctx=new Proxy({measureText:t=>({width:t.length*8})},{get(o,k){return o[k]||(o[k]=(...args)=>calls.push({name:k,args}))},set(o,k,v){o[k]=v;return true}})
drawDiagram(ctx,normalizeDiagram(diagram),320,208)
assert.ok(calls.some(x=>x.name==='lineTo'));assert.ok(calls.some(x=>x.name==='fillText'&&x.args[0]==='mg'))
assert.ok(calls.every(x=>x.args.every(v=>typeof v!=='number'||Number.isFinite(v))))
console.log('PASS Coach diagrams: validated native shapes, inline placement, malformed/partial fallback and bounded drawing')
